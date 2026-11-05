#!/usr/bin/env python3
"""Import initial dans Supabase des données aujourd'hui stockées dans le dépôt (dossier data/).

À lancer une fois, depuis GitHub : onglet Actions → « Supabase : import initial » → Run workflow.
Peut être relancé sans risque : chaque ligne est insérée ou mise à jour, jamais dupliquée.

Usage : python3 agents/supabase/importer.py [--essai] [--tables t1,t2] [--recents N]
  --essai       prépare les lignes et affiche les chiffres, sans rien envoyer (aucune clé nécessaire)
  --tables      seulement ces tables (par défaut : toutes)
  --recents N   seulement les scrutins (et votes) des N derniers jours, plus tous les grands votes.
                Utilisé chaque nuit par la tâche des votes, pour ne pas tout renvoyer.
"""

import datetime

import glob
import json
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def lire_json(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return json.load(f)


def lire_js(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        texte = f.read()
    return json.loads(texte[texte.index("=") + 1:].strip().rstrip(";"))


def preparer():
    tables = {}

    groupes = lire_json("data/groupes.json")
    tables["groupes"] = [dict(ref=ref, **{k: g.get(k) for k in ("abrege", "nom", "legislature", "debut", "fin")}) for ref, g in groupes.items()]

    grands = {l["id"]: l for l in lire_js("data/votes.js")["lois"]}
    scrutins = []
    for leg in ("16", "17"):
        for s in lire_json("data/scrutins-%s.json" % leg):
            g = grands.get(s["uid"])
            scrutins.append({
                "uid": s["uid"], "legislature": s["legislature"], "numero": s["numero"], "date": s["date"],
                "titre": s["titre"], "type": s["type"], "solennel": s["solennel"], "sort": s["sort"],
                "pour": s["pour"], "contre": s["contre"], "abstentions": s["abstentions"], "votants": s["votants"],
                "requis": s["requis"], "url": s["url"], "groupes": s["groupes"],
                "genre": g["genre"] if g else None, "categorie": g["cat"] if g else None,
                "titre_court": g["titre"] if g else None, "lecture": g["lecture"] if g else None,
                "groupes_hemicycle": g["groupes"] if g else None,
            })
    tables["scrutins"] = scrutins

    infos = {c["id"]: c for c in lire_json("agents/collecte/candidats.json")["candidats"]}
    fiches = lire_json("data/candidats-votes.json")
    tables["candidats"] = [{
        "id": f["id"], "nom": f["nom"], "parti": infos.get(f["id"], {}).get("parti"),
        "famille": infos.get(f["id"], {}).get("famille"), "acteur": f["acteur"],
        "mandats": f["mandats"], "groupes": f["groupes"], "participation": f["participation"],
    } for f in fiches]
    tables["votes_candidats"] = [{
        "candidat": f["id"], "scrutin": v["scrutin"], "position": v["position"], "groupe": v["groupe"],
        "par_delegation": v["parDelegation"],
    } for f in fiches for v in f["votes"]]

    app = lire_js("data/app.js")
    tables["collecte"] = [
        {"cle": "collecte", "valeur": lire_json("data/collecte.json")},
        {"cle": "mediane_solennels", "valeur": app.get("medianeSolennels")},
        {"cle": "dernier_scrutin", "valeur": app.get("dernierScrutin")},
    ]

    tables["articles"] = [{
        "id": a["id"], "media": a["media"], "titre": a["titre"], "url": a["url"], "date": a["date"] or a["vuLe"],
        "candidats": a["candidats"], "vu_le": a["vuLe"], "traite": a["traite"],
    } for a in lire_json("data/medias/articles.json")]

    declarations = []
    for chemin in sorted(glob.glob(os.path.join(RACINE, "contenu", "declarations", "*.json"))):
        with open(chemin, encoding="utf-8") as f:
            for d in json.load(f).get("declarations", []):
                declarations.append({
                    "id": d["id"], "candidat": d["candidat"], "date": d["date"], "media": d["media"], "url": d["url"],
                    "titre_article": d.get("titreArticle"), "citation": d["citation"], "resume": d.get("resume"),
                    "type": d["type"], "theme": d.get("theme"), "vote_lie": d.get("voteLie"), "factcheck": d.get("factcheck"),
                    "verification": d.get("statut"), "verifie_dans": d.get("verifieDans"), "motif": d.get("motif"),
                    # Déjà relues et fusionnées dans main par l'équipe : validées.
                    "validation": "validee" if d.get("statut") in ("verifiee", "a-verifier") else "refusee",
                    "valide_par": "pull request GitHub", "ajoute_le": d.get("ajouteLe"),
                })
    tables["declarations"] = declarations
    return tables


# Ordre d'envoi : les tables référencées d'abord.
ORDRE = ["groupes", "scrutins", "candidats", "votes_candidats", "collecte", "articles", "declarations"]
CONFLITS = {"votes_candidats": "candidat,scrutin"}


def option(nom):
    return sys.argv[sys.argv.index(nom) + 1] if nom in sys.argv else None


def main():
    tables = preparer()
    choisies = option("--tables").split(",") if option("--tables") else ORDRE
    if option("--recents"):
        limite = (datetime.date.today() - datetime.timedelta(days=int(option("--recents")))).isoformat()
        tables["scrutins"] = [s for s in tables["scrutins"] if (s["date"] or "") >= limite or s["genre"]]
        gardes = {s["uid"] for s in tables["scrutins"]}
        tables["votes_candidats"] = [v for v in tables["votes_candidats"] if v["scrutin"] in gardes]
    for t in [x for x in ORDRE if x not in choisies]:
        tables.pop(t)
    for t in [x for x in ORDRE if x in tables]:
        print("%-16s %6d lignes" % (t, len(tables[t])))
    if "--essai" in sys.argv:
        print("Essai : rien n'a été envoyé.")
        return 0
    import client
    for t in [x for x in ORDRE if x in tables]:
        client.upsert(t, tables[t], CONFLITS.get(t))
        print("Envoyé : %s" % t)
    print("Import terminé.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
