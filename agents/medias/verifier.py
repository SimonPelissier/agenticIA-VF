#!/usr/bin/env python3
"""Agent de veille médias de MarIAn, étape 3 : vérifier les déclarations relevées par Claude.

Pour chaque déclaration de agents/medias/.cache/declarations.json (fichier de travail de la routine,
jamais publié) pas encore vérifiée :
  - contrôle du format (candidat, type, sujet, longueur de la citation...) ;
  - téléchargement de l'article et recherche de la citation MOT POUR MOT
    (espaces, apostrophes et guillemets normalisés).

Statut écrit dans chaque déclaration :
  verifiee     la citation figure telle quelle dans le corps de l'article, ou, si l'article est
               inaccessible, dans le chapô de son flux RSS (champ verifieDans : article ou flux RSS)
  a-verifier   article payant ou inaccessible : un humain doit vérifier
  rejetee      article lisible mais citation introuvable : à corriger ou supprimer

Publication automatique (décision du 12 novembre 2026, médias reconnus) : les déclarations retenues
(vérifiées ou à vérifier) sont envoyées dans Supabase déjà « validee » et apparaissent aussitôt sur le site,
sauf si elles échouent aux règles de qualité ou dépassent le plafond par candidat : elles sont alors
enregistrées « refusee », jamais publiées. Une décision déjà prise sur une déclaration n'est jamais changée,
sauf pour les anciennes déclarations restées « a-valider », auxquelles les mêmes règles sont appliquées.

Produit aussi un rapport d'équilibre (par candidat, par média) dans
agents/medias/.cache/rapport.md, repris dans le compte rendu de la routine.

Aucune IA, aucune clé, aucune librairie à installer.

Usage : python3 agents/medias/verifier.py [--tout]   (--tout : revérifie aussi les déclarations déjà vérifiées)
Code de sortie 1 si une déclaration est mal formée ou rejetée.
"""

import collections
import datetime
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOSSIER = os.path.dirname(os.path.abspath(__file__))
DECLARATIONS = os.path.join(DOSSIER, ".cache", "declarations.json")   # écrit par la routine, jamais publié
RAPPORT = os.path.join(DOSSIER, ".cache", "rapport.md")
CHAPOS = os.path.join(DOSSIER, ".cache", "chapos.json")      # écrit par veille.py, jamais publié
ARTICLES = os.path.join(DOSSIER, ".cache", "articles.json")   # copie de travail écrite par veille.py
AGENT = "Mozilla/5.0 (compatible; marIAn-veille; +https://github.com/SimonPelissier/agenticIA-VF)"

TYPES = {"engagement", "position"}
SUJETS = {"logement", "travail", "ecologie", "sante", "securite", "education", "retraites", "numerique"}
CITATION_MAX = 400          # caractères : une à deux phrases
MOTS_MIN_ARTICLE = 250      # en dessous, l'article est sans doute coupé (abonnement) : vérification humaine
PART_MAX = 0.4              # au-delà de 40 % des déclarations du jour pour un candidat, le rapport alerte
MOTS_MIN_CITATION = 8       # en dessous, la citation est trop courte pour être comprise seule
PLAFOND_CANDIDAT = 6        # déclarations publiées au plus par candidat et par jour (équilibre)
AUTOMATIQUE = "automatique (verifier.py)"


def normaliser(texte):
    """Rend la comparaison indifférente aux espaces, apostrophes, guillemets et tirets typographiques."""
    texte = html.unescape(texte)
    texte = unicodedata.normalize("NFC", texte)
    for a, b in (("’", "'"), ("‘", "'"), ("ʼ", "'"), ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
                 ("–", "-"), ("—", "-"), ("…", "..."), (" ", " "), (" ", " ")):
        texte = texte.replace(a, b)
    texte = re.sub(r'\s*"\s*', '"', texte)
    return re.sub(r"\s+", " ", texte).strip().lower()


def corps_article(url):
    """Paragraphes du corps de l'article, tels quels : (liste de paragraphes, None) ou (None, code d'erreur)."""
    try:
        requete = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept-Language": "fr-FR,fr;q=0.9"})
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            brut = reponse.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as erreur:
        return None, "HTTP %d" % erreur.code
    except OSError as erreur:
        return None, str(erreur)
    brut = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", brut)
    # Le corps des articles : paragraphes, citations, listes. Jamais les titres ni les intertitres :
    # une citation prise dans un titre (souvent raccourcie par la rédaction) n'est pas acceptée.
    blocs = re.findall(r"(?is)<(?:p|blockquote|li)[^>]*>(.*?)</(?:p|blockquote|li)>", brut)
    paragraphes = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", b))).strip() for b in blocs]
    return [x for x in paragraphes if x], None


def texte_article(url):
    """Renvoie (texte normalisé, nombre de mots) ou (None, code d'erreur)."""
    paragraphes, erreur = corps_article(url)
    if paragraphes is None:
        return None, erreur
    texte = " ".join(paragraphes)
    return normaliser(texte), len(texte.split())


def controler_format(d, candidats, medias):
    erreurs = []
    for champ in ("id", "candidat", "date", "media", "url", "citation", "resume", "type"):
        if not d.get(champ):
            erreurs.append("champ « %s » manquant" % champ)
    if d.get("candidat") and d["candidat"] not in candidats:
        erreurs.append("candidat inconnu : %s" % d["candidat"])
    if d.get("media") and d["media"] not in medias:
        erreurs.append("média hors liste : %s" % d["media"])
    if d.get("type") and d["type"] not in TYPES:
        erreurs.append("type interdit : %s (engagement ou position)" % d["type"])
    if d.get("theme") not in SUJETS and d.get("theme") is not None:
        erreurs.append("sujet inconnu : %s" % d.get("theme"))
    if len(d.get("citation") or "") > CITATION_MAX:
        erreurs.append("citation trop longue (%d caractères, maximum %d)" % (len(d["citation"]), CITATION_MAX))
    if len((d.get("resume") or "").split()) > 12:
        erreurs.append("résumé trop long (12 mots maximum)")
    erreurs += controler_qualite(d)
    return erreurs


def controler_qualite(d):
    """Règles qui remplacent la relecture humaine : une citation doit se comprendre seule."""
    erreurs = []
    citation = (d.get("citation") or "").strip()
    if len(citation.split()) < MOTS_MIN_CITATION:
        erreurs.append("citation trop courte pour être comprise seule (%d mots, minimum %d)" % (len(citation.split()), MOTS_MIN_CITATION))
    debut = citation.lstrip("«»\"“”'‘’ .…[(")
    if debut and not (debut[0].isupper() or debut[0].isdigit()):
        erreurs.append("citation commencée en milieu de phrase")
    return erreurs


def decider(declarations, deja_publiees):
    """Décision automatique : « validee », ou « refusee » avec le motif (qualité, plafond par candidat).
    deja_publiees : nombre de déclarations déjà publiées par (candidat, jour)."""
    compte = collections.Counter(deja_publiees)
    for d in declarations:
        erreurs = controler_qualite(d)
        jour = (d.get("candidat"), d.get("ajouteLe") or datetime.date.today().isoformat())
        if not erreurs and compte[jour] >= PLAFOND_CANDIDAT:
            erreurs.append("plafond de %d déclarations par candidat et par jour atteint" % PLAFOND_CANDIDAT)
        if erreurs:
            d["validation"], d["motifRefus"] = "refusee", " ; ".join(erreurs)
        else:
            d["validation"] = "validee"
            compte[jour] += 1
    return declarations


def envoyer_supabase(declarations):
    """Envoie les déclarations dans Supabase. Une nouvelle déclaration arrive avec sa décision automatique
    (« validee » ou « refusee ») ; une déclaration déjà en base garde sa décision.

    Une déclaration déjà en base n'est jamais remplacée par une autre : si son identifiant est pris
    par une citation différente (routine relancée le même jour), elle reçoit le numéro libre suivant ;
    si la même citation existe déjà sous un autre identifiant, elle n'est pas renvoyée."""
    sys.path.insert(0, os.path.join(RACINE, "agents", "supabase"))
    import client
    if not client.disponible():
        print("Supabase : variables absentes, aucune déclaration envoyée.")
        return
    if not declarations:
        return
    lignes_base = client.lire("declarations", select="id,candidat,citation,validation,ajoute_le")
    existantes = {l["id"]: (l["candidat"], normaliser(l["citation"])) for l in lignes_base}
    deja = {v: k for k, v in existantes.items()}
    gardees = []
    for d in declarations:
        cle = (d["candidat"], normaliser(d["citation"]))
        if cle in deja and deja[cle] != d["id"]:
            print("Déjà en base sous %s, pas renvoyée : %s" % (deja[cle], d["id"]))
            continue
        if d["id"] in existantes and existantes[d["id"]] != cle:
            base, n = d["id"].rsplit("-", 1)[0], 1
            while "%s-%d" % (base, n) in existantes:
                n += 1
            print("Identifiant %s déjà pris : renommée %s-%d" % (d["id"], base, n))
            d["id"] = "%s-%d" % (base, n)
        existantes[d["id"]] = cle
        deja[cle] = d["id"]
        gardees.append(d)
    declarations = gardees
    if not declarations:
        return
    ids_base = {l["id"] for l in lignes_base}
    nouvelles = [d for d in declarations if d["id"] not in ids_base]
    publiees = [(l["candidat"], l["ajoute_le"]) for l in lignes_base if l["validation"] == "validee"]
    decider(nouvelles, publiees)
    maintenant = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    lignes = [{
        "id": d["id"], "candidat": d["candidat"], "date": d["date"], "media": d["media"], "url": d["url"],
        "titre_article": d.get("titreArticle"), "citation": d["citation"], "resume": d.get("resume"), "type": d["type"],
        "theme": d.get("theme"), "vote_lie": d.get("voteLie"), "factcheck": d.get("factcheck"),
        "verification": d["statut"], "verifie_dans": d.get("verifieDans"), "motif": d.get("motif"), "ajoute_le": d.get("ajouteLe"),
    } for d in declarations]
    for ligne, d in zip(lignes, declarations):
        if d["id"] not in ids_base:
            ligne.update(validation=d["validation"], valide_par=AUTOMATIQUE, valide_le=maintenant)
            if d["validation"] == "refusee":
                ligne["motif"] = d["motifRefus"]
    # Deux envois : les colonnes doivent être les mêmes dans un lot, et une décision déjà prise ne change pas.
    client.upsert("declarations", [l for l in lignes if "validation" in l])
    client.upsert("declarations", [l for l in lignes if "validation" not in l])
    for d in nouvelles:
        print("%s : %s%s" % (d["id"], "publiée" if d["validation"] == "validee" else "refusée", "" if d["validation"] == "validee" else " (" + d["motifRefus"] + ")"))
    print("Supabase : %d déclaration(s) envoyée(s), dont %d publiée(s) sur le site." % (len(lignes), sum(1 for d in nouvelles if d["validation"] == "validee")))


def decider_en_attente():
    """Applique les règles automatiques aux anciennes déclarations restées « a-valider » (avant le 12 novembre 2026)."""
    sys.path.insert(0, os.path.join(RACINE, "agents", "supabase"))
    import client
    if not client.disponible():
        return
    lignes = client.lire("declarations", select="*")
    attente = [l for l in lignes if l["validation"] == "a-valider"]
    if not attente:
        return
    publiees = [(l["candidat"], l["ajoute_le"]) for l in lignes if l["validation"] == "validee"]
    decl = [{"id": l["id"], "candidat": l["candidat"], "citation": l["citation"], "ajouteLe": l["ajoute_le"]} for l in attente]
    decider(decl, publiees)
    maintenant = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    for l, d in zip(attente, decl):
        l.update(validation=d["validation"], valide_par=AUTOMATIQUE, valide_le=maintenant)
        if d["validation"] == "refusee":
            l["motif"] = d["motifRefus"]
        print("En attente %s : %s" % (d["id"], "publiée" if d["validation"] == "validee" else "refusée (" + d["motifRefus"] + ")"))
    client.upsert("declarations", attente)


def main():
    with open(os.path.join(DOSSIER, "sources.json"), encoding="utf-8") as f:
        sources = json.load(f)
    candidats = {c["id"]: c["nom"] for c in sources["candidats"]}
    medias = {m["id"]: m["nom"] for m in sources["medias"]}
    tout = "--tout" in sys.argv
    aujourdhui = datetime.date.today().isoformat()

    problemes, verifiees_ce_jour = [], []
    try:
        with open(CHAPOS, encoding="utf-8") as f:
            chapos = json.load(f)
    except (OSError, ValueError):
        chapos = {}
    try:
        with open(ARTICLES, encoding="utf-8") as f:
            id_par_url = {a["url"]: a["id"] for a in json.load(f)}
    except (OSError, ValueError):
        id_par_url = {}
    cache_articles = {}
    for chemin in [DECLARATIONS] if os.path.exists(DECLARATIONS) else []:
        with open(chemin, encoding="utf-8") as f:
            fichier = json.load(f)
        modifie = False
        for d in fichier.get("declarations", []):
            if d.get("statut") in ("verifiee", "a-verifier") and not tout:
                continue
            erreurs = controler_format(d, candidats, medias)
            if erreurs:
                d["statut"] = "rejetee"
                d["motif"] = " ; ".join(erreurs)
            else:
                if d["url"] not in cache_articles:
                    cache_articles[d["url"]] = texte_article(d["url"])
                    time.sleep(1)  # politesse envers les sites des médias
                texte, info = cache_articles[d["url"]]
                citation = normaliser(d["citation"])
                chapo = chapos.get(id_par_url.get(d["url"]), "")
                if texte is not None and citation in texte:
                    d["statut"], d["verifieDans"] = "verifiee", "article"
                    d.pop("motif", None)
                elif chapo and citation in normaliser(chapo):
                    # Repli : article payant, bloqué ou sans texte, mais la citation est dans le chapô du flux RSS.
                    d["statut"], d["verifieDans"] = "verifiee", "flux RSS"
                    d.pop("motif", None)
                elif texte is None:
                    d["statut"], d["motif"] = "a-verifier", "article inaccessible (%s) et citation absente du chapô RSS : vérifier à la main" % info
                elif info < MOTS_MIN_ARTICLE:
                    d["statut"], d["motif"] = "a-verifier", "article incomplet (%d mots lisibles, abonnement ?) : vérifier à la main" % info
                else:
                    d["statut"], d["motif"] = "rejetee", "citation introuvable mot pour mot dans l'article"
            d["verifieLe"] = aujourdhui
            modifie = True
            verifiees_ce_jour.append(d)
            if d["statut"] == "rejetee":
                problemes.append("%s (%s) : %s" % (d.get("id"), os.path.basename(chemin), d["motif"]))
        if modifie:
            with open(chemin, "w", encoding="utf-8") as f:
                json.dump(fichier, f, ensure_ascii=False, indent=2)
                f.write("\n")

    # Rapport d'équilibre
    statuts = collections.Counter(d["statut"] for d in verifiees_ce_jour)
    par_candidat = collections.Counter(d.get("candidat") for d in verifiees_ce_jour if d["statut"] != "rejetee")
    par_media = collections.Counter(d.get("media") for d in verifiees_ce_jour if d["statut"] != "rejetee")
    retenues = sum(par_candidat.values())
    lignes = ["## Vérification des déclarations", "",
              "- Vérifiées mot pour mot : **%d** (dans l'article : %d ; dans le chapô du flux RSS : %d)" % (
                  statuts.get("verifiee", 0),
                  sum(1 for d in verifiees_ce_jour if d["statut"] == "verifiee" and d.get("verifieDans") != "flux RSS"),
                  sum(1 for d in verifiees_ce_jour if d.get("verifieDans") == "flux RSS")),
              "- À vérifier à la main (article payant ou inaccessible) : **%d**" % statuts.get("a-verifier", 0),
              "- Rejetées : **%d**" % statuts.get("rejetee", 0), "",
              "## Équilibre", "", "| Candidat | Déclarations |", "| --- | --- |"]
    lignes += ["| %s | %d |" % (nom, par_candidat.get(cid, 0)) for cid, nom in candidats.items()]
    lignes += ["", "| Média | Déclarations |", "| --- | --- |"]
    lignes += ["| %s | %d |" % (nom, par_media.get(mid, 0)) for mid, nom in medias.items() if par_media.get(mid)]
    alertes = ["%s concentre %d %% des déclarations : vérifier que les autres candidats ne sont pas oubliés." % (candidats[c], round(100.0 * n / retenues))
               for c, n in par_candidat.items() if retenues >= 5 and n / retenues > PART_MAX]
    if alertes:
        lignes += ["", "## Alertes", ""] + ["- " + a for a in alertes]
    if problemes:
        lignes += ["", "## Rejets à corriger", ""] + ["- " + p for p in problemes]
    os.makedirs(os.path.dirname(RAPPORT), exist_ok=True)
    with open(RAPPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")
    print("\n".join(lignes))
    envoyer_supabase([d for d in verifiees_ce_jour if d["statut"] != "rejetee"])
    decider_en_attente()
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.exit(main())
