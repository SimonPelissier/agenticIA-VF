#!/usr/bin/env python3
"""Agent de veille médias de MarIAn, étape 3 : vérifier les déclarations relevées par Claude.

Pour chaque déclaration de contenu/declarations/*.json pas encore vérifiée :
  - contrôle du format (candidat, type, sujet, longueur de la citation...) ;
  - téléchargement de l'article et recherche de la citation MOT POUR MOT
    (espaces, apostrophes et guillemets normalisés).

Statut écrit dans chaque déclaration :
  verifiee     la citation figure telle quelle dans l'article
  a-verifier   article payant ou inaccessible : un humain doit vérifier
  rejetee      article lisible mais citation introuvable : à corriger ou supprimer

Produit aussi un rapport d'équilibre (par candidat, par média) dans
agents/medias/.cache/rapport.md, repris dans la pull request.

Aucune IA, aucune clé, aucune librairie à installer.

Usage : python3 agents/medias/verifier.py [--tout]   (--tout : revérifie aussi les déclarations déjà vérifiées)
Code de sortie 1 si une déclaration est mal formée ou rejetée.
"""

import collections
import datetime
import glob
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
DECLARATIONS = os.path.join(RACINE, "contenu", "declarations")
RAPPORT = os.path.join(DOSSIER, ".cache", "rapport.md")
AGENT = "Mozilla/5.0 (compatible; marIAn-veille; +https://github.com/SimonPelissier/agenticIA-VF)"

TYPES = {"engagement", "position"}
SUJETS = {"logement", "travail", "ecologie", "sante", "securite", "education", "retraites", "numerique"}
CITATION_MAX = 400          # caractères : une à deux phrases
MOTS_MIN_ARTICLE = 250      # en dessous, l'article est sans doute coupé (abonnement) : vérification humaine
PART_MAX = 0.4              # au-delà de 40 % des déclarations du jour pour un candidat, le rapport alerte


def normaliser(texte):
    """Rend la comparaison indifférente aux espaces, apostrophes, guillemets et tirets typographiques."""
    texte = html.unescape(texte)
    texte = unicodedata.normalize("NFC", texte)
    for a, b in (("’", "'"), ("‘", "'"), ("ʼ", "'"), ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
                 ("–", "-"), ("—", "-"), ("…", "..."), (" ", " "), (" ", " ")):
        texte = texte.replace(a, b)
    texte = re.sub(r'\s*"\s*', '"', texte)
    return re.sub(r"\s+", " ", texte).strip().lower()


def texte_article(url):
    """Renvoie (texte normalisé, nombre de mots) ou (None, code d'erreur)."""
    try:
        requete = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept-Language": "fr-FR,fr;q=0.9"})
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            brut = reponse.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as erreur:
        return None, "HTTP %d" % erreur.code
    except OSError as erreur:
        return None, str(erreur)
    brut = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", brut)
    # Le corps des articles est dans des paragraphes ; on garde aussi les intertitres et les citations.
    blocs = re.findall(r"(?is)<(?:p|h[1-6]|blockquote|li)[^>]*>(.*?)</(?:p|h[1-6]|blockquote|li)>", brut)
    texte = " ".join(re.sub(r"<[^>]+>", " ", b) for b in blocs)
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
    return erreurs


def main():
    with open(os.path.join(DOSSIER, "sources.json"), encoding="utf-8") as f:
        sources = json.load(f)
    candidats = {c["id"]: c["nom"] for c in sources["candidats"]}
    medias = {m["id"]: m["nom"] for m in sources["medias"]}
    tout = "--tout" in sys.argv
    aujourdhui = datetime.date.today().isoformat()

    problemes, verifiees_ce_jour = [], []
    cache_articles = {}
    for chemin in sorted(glob.glob(os.path.join(DECLARATIONS, "*.json"))):
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
                if texte is None:
                    d["statut"], d["motif"] = "a-verifier", "article inaccessible (%s) : vérifier à la main" % info
                elif normaliser(d["citation"]) in texte:
                    d["statut"] = "verifiee"
                    d.pop("motif", None)
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
              "- Vérifiées mot pour mot : **%d**" % statuts.get("verifiee", 0),
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
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.exit(main())
