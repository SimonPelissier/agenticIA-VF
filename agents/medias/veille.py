#!/usr/bin/env python3
"""Agent de veille médias de MarIAn, étape 1 : repérer les articles.

Lit les flux RSS des médias généralistes (sources.json) et garde les articles
dont le titre ou le chapô cite un candidat. Ne stocke que le titre, la date,
le média et le lien, jamais le texte de l'article (droit d'auteur).

Les articles vont dans Supabase (table articles), que lit la page Actualité du site.
Les articles déjà connus et leur état « lu » sont relus dans Supabase à chaque passage :
la routine part chaque jour d'une copie neuve du dépôt. Sans les variables Supabase
(ordinateur sans clé), le script travaille seulement sur sa copie locale.
Copie de travail, jamais publiée : agents/medias/.cache/articles.json.

Aucune IA, aucune clé, aucune librairie à installer (Python 3.7 ou plus récent).

Usage :
  python3 agents/medias/veille.py                  lit les flux et met à jour la liste
  python3 agents/medias/veille.py --a-traiter      affiche les articles pas encore lus par Claude
  python3 agents/medias/veille.py --traites ID,ID  marque des articles comme lus
  python3 agents/medias/veille.py --chapo ID       affiche le chapô du flux RSS (repli si l'article est inaccessible)
"""

import datetime
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOSSIER = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(DOSSIER, ".cache", "articles.json")
# Chapôs des flux RSS : fichier de travail, jamais publié (droit d'auteur), lu par verifier.py en repli.
CHAPOS = os.path.join(DOSSIER, ".cache", "chapos.json")
CONSERVATION_JOURS = 30
AGENT = "Mozilla/5.0 (compatible; marIAn-veille; +https://github.com/SimonPelissier/agenticIA-VF)"


def charger_sources():
    with open(os.path.join(DOSSIER, "sources.json"), encoding="utf-8") as f:
        return json.load(f)


def sans_accents(texte):
    return "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn").lower()


def motifs_candidats(candidats):
    """Une expression par candidat, insensible à la casse et aux accents, sur des mots entiers."""
    motifs = {}
    for c in candidats:
        formes = sorted({sans_accents(m) for m in c["motifs"]}, key=len, reverse=True)
        motifs[c["id"]] = re.compile(r"(?<![\w-])(" + "|".join(re.escape(f) for f in formes) + r")(?![\w-])")
    return motifs


def telecharger(url, essais=2):
    for essai in range(1, essais + 1):
        try:
            requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                return reponse.read()
        except OSError as erreur:
            print("  échec (%d/%d) : %s" % (essai, essais, erreur))
            if essai < essais:
                time.sleep(10)
    return None


def nettoyer(texte):
    texte = html.unescape(re.sub(r"<[^>]+>", " ", texte or ""))
    return re.sub(r"\s+", " ", texte).strip()


def date_iso(valeur):
    """Convertit la date d'un flux (RFC 822 ou ISO 8601) en date et heure ISO, heure de Paris non garantie."""
    if not valeur:
        return None
    try:
        return email.utils.parsedate_to_datetime(valeur).strftime("%Y-%m-%dT%H:%M")
    except (TypeError, ValueError):
        pass
    m = re.match(r"(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})?", valeur.strip())
    return (m.group(1) + "T" + (m.group(2) or "00:00")) if m else None


def lire_flux(contenu):
    """Renvoie les éléments d'un flux RSS 2.0 ou Atom : titre, lien, date, chapô."""
    racine = ET.fromstring(contenu)
    elements = []
    for item in racine.iter():
        balise = item.tag.split("}")[-1]
        if balise not in ("item", "entry"):
            continue
        champs = {}
        for enfant in item:
            nom = enfant.tag.split("}")[-1]
            if nom == "link" and enfant.get("href"):
                champs.setdefault("link", enfant.get("href"))
            elif enfant.text:
                champs.setdefault(nom, enfant.text)
        lien = html.unescape((champs.get("link") or champs.get("guid") or "").strip())
        if lien.startswith("http"):
            elements.append({
                "titre": nettoyer(champs.get("title")),
                "lien": lien,
                "date": date_iso(champs.get("pubDate") or champs.get("published") or champs.get("updated") or champs.get("date")),
                "chapo": nettoyer(champs.get("description") or champs.get("summary")),
            })
    return elements


def supabase():
    """Le module d'accès à Supabase, ou None si les variables Supabase sont absentes."""
    sys.path.insert(0, os.path.join(RACINE, "agents", "supabase"))
    import client
    return client if client.disponible() else None


def charger_articles():
    """Articles des 30 derniers jours : depuis Supabase si possible, sinon depuis la copie locale."""
    client = supabase()
    if client:
        limite = (datetime.date.today() - datetime.timedelta(days=CONSERVATION_JOURS)).isoformat()
        lignes = client.lire("articles", select="id,media,titre,url,date,candidats,vu_le,traite", date="gte." + limite)
        return [{"id": l["id"], "media": l["media"], "titre": l["titre"], "url": l["url"], "date": (l["date"] or "")[:16] or None,
                 "candidats": l["candidats"] or [], "vuLe": l["vu_le"], "traite": l["traite"]} for l in lignes]
    if not os.path.exists(SORTIE):
        return []
    with open(SORTIE, encoding="utf-8") as f:
        return json.load(f)


def ecrire_articles(articles):
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    articles.sort(key=lambda a: (a["date"] or "", a["id"]), reverse=True)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write("[\n")
        f.write(",\n".join(json.dumps(a, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for a in articles))
        f.write("\n]\n")


def envoyer_supabase(articles):
    """Envoie les articles dans Supabase (table articles), avec les noms des journaux pour le site."""
    client = supabase()
    if not client:
        print("Supabase : variables absentes, rien n'est envoyé (copie locale seulement).")
        return
    lignes = [{"id": a["id"], "media": a["media"], "titre": a["titre"], "url": a["url"], "date": a["date"] or a["vuLe"],
               "candidats": a["candidats"], "vu_le": a["vuLe"], "traite": a["traite"]} for a in articles]
    client.upsert("articles", lignes)
    client.upsert("collecte", [{"cle": "medias", "valeur": {m["id"]: m["nom"] for m in charger_sources()["medias"]}}])
    print("Supabase : %d article(s) envoyé(s)." % len(lignes))


def collecter():
    sources = charger_sources()
    motifs = motifs_candidats(sources["candidats"])
    articles = {a["id"]: a for a in charger_articles()}
    chapos = charger_chapos()
    aujourdhui = datetime.date.today().isoformat()
    limite = (datetime.date.today() - datetime.timedelta(days=CONSERVATION_JOURS)).isoformat()
    nouveaux = 0
    for media in sources["medias"]:
        print("Flux %s" % media["nom"])
        contenu = telecharger(media["flux"])
        if contenu is None:
            continue
        try:
            elements = lire_flux(contenu)
        except ET.ParseError as erreur:
            print("  flux illisible : %s" % erreur)
            continue
        for e in elements:
            texte = sans_accents(e["titre"] + " " + e["chapo"])
            cites = sorted(cid for cid, motif in motifs.items() if motif.search(texte))
            if not cites:
                continue
            ident = hashlib.sha1(e["lien"].split("?")[0].encode("utf-8")).hexdigest()[:12]
            if e["chapo"]:
                chapos[ident] = e["chapo"]
            if ident in articles or (e["date"] and e["date"] < limite):
                continue  # déjà connu, ou trop ancien (certains flux remontent des articles de plusieurs mois)
            articles[ident] = {
                "id": ident, "media": media["id"], "titre": e["titre"], "url": e["lien"],
                "date": e["date"], "candidats": cites, "vuLe": aujourdhui, "traite": False,
            }
            nouveaux += 1
    gardes = [a for a in articles.values() if (a["date"] or a["vuLe"]) >= limite]
    ecrire_articles(gardes)
    ids = {a["id"] for a in gardes}
    os.makedirs(os.path.dirname(CHAPOS), exist_ok=True)
    with open(CHAPOS, "w", encoding="utf-8") as f:
        json.dump({k: v for k, v in chapos.items() if k in ids}, f, ensure_ascii=False, indent=0)
    envoyer_supabase(gardes)
    a_traiter = sum(1 for a in gardes if not a["traite"])
    print("%d nouvel(s) article(s) ; %d à lire par Claude ; %d gardé(s) sur %d jours." % (nouveaux, a_traiter, len(gardes), CONSERVATION_JOURS))


def charger_chapos():
    try:
        with open(CHAPOS, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def afficher_chapo(ident):
    """Chapô du flux RSS d'un article, à utiliser seulement si l'article lui-même est inaccessible."""
    chapo = charger_chapos().get(ident)
    print(chapo if chapo else "(pas de chapô en cache pour cet article : relancer veille.py, ou l'article n'est plus dans le flux)")


def afficher_a_traiter():
    medias = {m["id"]: m["nom"] for m in charger_sources()["medias"]}
    for a in charger_articles():
        if not a["traite"]:
            print(json.dumps(dict(a, media=medias.get(a["media"], a["media"])), ensure_ascii=False))


def marquer_traites(ids):
    ids = {i.strip() for i in ids.split(",") if i.strip()}
    articles = charger_articles()
    for a in articles:
        if a["id"] in ids:
            a["traite"] = True
    ecrire_articles(articles)
    envoyer_supabase([a for a in articles if a["id"] in ids])
    print("%d article(s) marqué(s) comme lus." % len(ids))


if __name__ == "__main__":
    if "--chapo" in sys.argv:
        afficher_chapo(sys.argv[sys.argv.index("--chapo") + 1])
    elif "--a-traiter" in sys.argv:
        afficher_a_traiter()
    elif "--traites" in sys.argv:
        marquer_traites(sys.argv[sys.argv.index("--traites") + 1])
    else:
        collecter()
