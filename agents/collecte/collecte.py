#!/usr/bin/env python3
"""Agent de collecte de marIAn.

Télécharge les données ouvertes de l'Assemblée nationale (16e et 17e législatures)
et produit, dans data/ :
  - groupes.json          les groupes politiques et leurs dates
  - scrutins-16.json      chaque scrutin public, avec la position de chaque groupe
  - scrutins-17.json
  - candidats-votes.json  les votes personnels des candidats suivis, mandat par mandat
  - collecte.json         sources, empreintes des fichiers et chiffres clés

Aucune IA, aucune clé, aucune librairie à installer : seulement la bibliothèque
standard de Python (3.7 ou plus récent).

Usage : python3 agents/collecte/collecte.py [--hors-ligne]
  --hors-ligne  réutilise les archives déjà téléchargées dans agents/collecte/.cache
"""

import hashlib
import json
import os
import sys
import time
import urllib.request
import zipfile

import grands_votes

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOSSIER_AGENT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(DOSSIER_AGENT, ".cache")
SORTIE = os.path.join(RACINE, "data")

OPEN_DATA = "https://data.assemblee-nationale.fr/static/openData/repository"
SOURCES = {
    "scrutins-16": OPEN_DATA + "/16/loi/scrutins/Scrutins.json.zip",
    "scrutins-17": OPEN_DATA + "/17/loi/scrutins/Scrutins.json.zip",
    # L'historique de la 17e contient aussi les députés et les groupes de la 16e.
    "acteurs": OPEN_DATA + "/17/amo/tous_acteurs_mandats_organes_xi_legislature/"
               "AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip",
}
LEGISLATURES = ["16", "17"]
TENTATIVES = 3
ATTENTE = 60  # secondes, multipliées par le numéro de l'essai

# Clés du décompte nominatif de l'Assemblée -> position affichée dans l'application.
POSITIONS = {
    "pours": "pour",
    "contres": "contre",
    "abstentions": "abstention",
    "nonVotants": "non-votant",
}


# ---------- Outils ----------

def en_liste(valeur):
    """L'Assemblée convertit son XML en JSON : un élément seul n'est pas dans une liste."""
    if valeur is None:
        return []
    return valeur if isinstance(valeur, list) else [valeur]


def texte(valeur):
    """Certains champs sont parfois un objet {"#text": ...}."""
    if isinstance(valeur, dict):
        return valeur.get("#text")
    return valeur


def entier(valeur):
    try:
        return int(valeur)
    except (TypeError, ValueError):
        return 0


def taux(votes, scrutins):
    return {"votes": votes, "scrutins": scrutins, "taux": round(100.0 * votes / scrutins, 1) if scrutins else None}


def telecharger(nom, url, hors_ligne=False):
    """Télécharge un fichier dans le cache et renvoie son chemin et son empreinte SHA-256.

    Hors ligne, réutilise le fichier déjà présent dans le cache.
    """
    os.makedirs(CACHE, exist_ok=True)
    chemin = os.path.join(CACHE, nom + ".zip")
    if hors_ligne:
        if not os.path.exists(chemin):
            sys.exit("Hors ligne : fichier absent du cache, " + chemin)
        print("Cache : " + chemin)
    else:
        # Le serveur de l'Assemblée est parfois indisponible quelques minutes (erreur 503) : on réessaie.
        for essai in range(1, TENTATIVES + 1):
            print("Téléchargement de %s (essai %d/%d)" % (url, essai, TENTATIVES))
            try:
                requete = urllib.request.Request(url, headers={"User-Agent": "marIAn-collecte"})
                with urllib.request.urlopen(requete, timeout=300) as reponse, open(chemin, "wb") as f:
                    while True:
                        bloc = reponse.read(1 << 20)
                        if not bloc:
                            break
                        f.write(bloc)
                if zipfile.is_zipfile(chemin):
                    break
                print("Le fichier reçu n'est pas une archive zip.")
            except OSError as erreur:  # erreurs réseau et HTTP (503...)
                print("Échec : %s" % erreur)
            if essai < TENTATIVES:
                time.sleep(ATTENTE * essai)
        else:
            sys.exit("Impossible de télécharger %s après %d essais : on réessaiera à la prochaine collecte." % (url, TENTATIVES))
    if not zipfile.is_zipfile(chemin):
        sys.exit("Fichier invalide (pas une archive zip) : " + chemin)
    empreinte = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            empreinte.update(bloc)
    return chemin, empreinte.hexdigest()


def fichiers_json(chemin_zip, prefixe):
    """Parcourt les fichiers JSON d'une archive dont le chemin commence par prefixe."""
    with zipfile.ZipFile(chemin_zip) as archive:
        for nom in archive.namelist():
            if nom.startswith(prefixe) and nom.endswith(".json"):
                with archive.open(nom) as f:
                    yield json.load(f)


def ecrire(nom, donnees, une_ligne_par_element=False):
    """Écrit un fichier JSON stable : même contenu en entrée, même fichier en sortie.

    Avec une_ligne_par_element, une liste est écrite à raison d'un élément par ligne :
    le fichier reste compact et une pull request montre clairement ce qui a changé.
    """
    os.makedirs(SORTIE, exist_ok=True)
    chemin = os.path.join(SORTIE, nom)
    with open(chemin, "w", encoding="utf-8") as f:
        if une_ligne_par_element:
            f.write("[\n")
            lignes = [json.dumps(e, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for e in donnees]
            f.write(",\n".join(lignes))
            f.write("\n]\n")
        else:
            json.dump(donnees, f, ensure_ascii=False, sort_keys=True, indent=2)
            f.write("\n")
    print("Écrit : data/" + nom)


# ---------- Députés et groupes ----------

def lire_acteurs(chemin_zip):
    """Renvoie les groupes politiques et, pour chaque député, ses mandats et ses groupes."""
    groupes = {}
    for doc in fichiers_json(chemin_zip, "json/organe/"):
        o = doc["organe"]
        if o.get("codeType") != "GP" or o.get("legislature") not in LEGISLATURES:
            continue
        dates = o.get("viMoDe") or {}
        groupes[texte(o["uid"])] = {
            "abrege": o.get("libelleAbrev") or o.get("libelleAbrege"),
            "nom": o.get("libelle"),
            "legislature": o.get("legislature"),
            "debut": dates.get("dateDebut"),
            "fin": dates.get("dateFin"),
        }

    deputes = {}
    for doc in fichiers_json(chemin_zip, "json/acteur/"):
        a = doc["acteur"]
        mandats, appartenances = [], []
        for m in en_liste((a.get("mandats") or {}).get("mandat")):
            if m.get("legislature") not in LEGISLATURES:
                continue
            periode = {"legislature": m.get("legislature"), "debut": m.get("dateDebut"), "fin": m.get("dateFin")}
            if m.get("typeOrgane") == "ASSEMBLEE":
                mandats.append(periode)
            elif m.get("typeOrgane") == "GP":
                periode["groupe"] = texte((m.get("organes") or {}).get("organeRef"))
                appartenances.append(periode)
        if mandats:
            ident = a["etatCivil"]["ident"]
            deputes[texte(a["uid"])] = {
                "prenom": ident.get("prenom"),
                "nom": ident.get("nom"),
                "mandats": sorted(mandats, key=lambda p: p["debut"] or ""),
                "groupes": sorted(appartenances, key=lambda p: p["debut"] or ""),
            }
    return groupes, deputes


def position_du_groupe(pour, contre, abstentions):
    """Position majoritaire calculée à partir des voix.

    On ne reprend pas le champ « positionMajoritaire » de l'Assemblée, qui contredit parfois
    ses propres chiffres (exemple : « abstention » pour un groupe à 19 pour et 101 contre).
    """
    voix = {"pour": pour, "contre": contre, "abstention": abstentions}
    maximum = max(voix.values())
    if maximum == 0:
        return None  # le groupe n'a pas voté (fréquent pour une motion de censure)
    gagnants = [p for p, n in voix.items() if n == maximum]
    return gagnants[0] if len(gagnants) == 1 else "partage"


def en_mandat(depute, date):
    """Le député siégeait-il ce jour-là ? Un ministre ne siège pas : son mandat est interrompu."""
    for m in depute["mandats"]:
        if (m["debut"] or "") <= date and (m["fin"] is None or date <= m["fin"]):
            return True
    return False


# ---------- Scrutins ----------

def lire_scrutins(chemin_zip, legislature, groupes, suivis):
    """Résume chaque scrutin et relève les votes personnels des députés suivis.

    Renvoie aussi, pour chaque scrutin solennel, l'ensemble des députés qui ont voté :
    il sert à calculer la participation médiane de l'hémicycle.
    """
    scrutins = []
    votes = {uid: [] for uid in suivis}
    participants_solennels = {}
    for doc in fichiers_json(chemin_zip, "json/"):
        s = doc["scrutin"]
        uid = texte(s["uid"])
        date = s.get("dateScrutin")
        synthese = s.get("syntheseVote") or {}
        decompte = synthese.get("decompte") or {}
        resume = {
            "uid": uid,
            "legislature": legislature,
            "numero": entier(s.get("numero")),
            "date": date,
            "titre": s.get("titre"),
            "type": (s.get("typeVote") or {}).get("libelleTypeVote"),
            # SPS = scrutin public solennel : les grands votes, annoncés à l'avance.
            "solennel": (s.get("typeVote") or {}).get("codeTypeVote") == "SPS",
            "sort": (s.get("sort") or {}).get("code"),
            "pour": entier(decompte.get("pour")),
            "contre": entier(decompte.get("contre")),
            "abstentions": entier(decompte.get("abstentions")),
            "votants": entier(synthese.get("nombreVotants")),
            "requis": entier(synthese.get("nbrSuffragesRequis")),
            "url": "https://www.assemblee-nationale.fr/dyn/%s/scrutins/%s" % (legislature, entier(s.get("numero"))),
            "groupes": [],
        }

        organe = ((s.get("ventilationVotes") or {}).get("organe") or {})
        for g in en_liste((organe.get("groupes") or {}).get("groupe")):
            ref = texte(g.get("organeRef"))
            vote = g.get("vote") or {}
            voix = vote.get("decompteVoix") or {}
            pour, contre, abstentions = entier(voix.get("pour")), entier(voix.get("contre")), entier(voix.get("abstentions"))
            exprimes = pour + contre + abstentions
            resume["groupes"].append({
                "groupe": (groupes.get(ref) or {}).get("abrege") or ref,
                "ref": ref,
                "position": position_du_groupe(pour, contre, abstentions),
                # Part des votants du groupe qui ont suivi la position : 100 = groupe uni.
                "cohesion": round(100.0 * max(pour, contre, abstentions) / exprimes) if exprimes else None,
                "positionAN": vote.get("positionMajoritaire"),
                "pour": pour,
                "contre": contre,
                "abstentions": abstentions,
                "nonVotants": entier(voix.get("nonVotants")),
                "membres": entier(g.get("nombreMembresGroupe")),
            })
            nominatif = vote.get("decompteNominatif") or {}
            for cle, position in POSITIONS.items():
                for votant in en_liste((nominatif.get(cle) or {}).get("votant")):
                    acteur = texte(votant.get("acteurRef"))
                    if resume["solennel"] and position != "non-votant":
                        participants_solennels.setdefault(uid, set()).add(acteur)
                    if acteur in votes:
                        votes[acteur].append({
                            "scrutin": uid,
                            "date": date,
                            "position": position,
                            "groupe": (groupes.get(ref) or {}).get("abrege") or ref,
                            "parDelegation": votant.get("parDelegation") == "true",
                        })
        resume["groupes"].sort(key=lambda x: x["groupe"] or "")
        scrutins.append(resume)
    scrutins.sort(key=lambda x: x["numero"])
    return scrutins, votes, participants_solennels


# ---------- Fichier de l'application ----------

# Un même courant politique change de sigle d'une législature à l'autre (RE devient EPR, LR devient DR...).
# La « famille » permet de suivre le groupe d'un candidat dans le temps. Les codes sont ceux de js/data.js.
FAMILLES = {
    "LFI-NUPES": "LFI", "LFI-NFP": "LFI",
    "SOC": "SOC", "SOC-A": "SOC",
    "ECOLO": "ECO", "ECOS": "ECO",
    "GDR-NUPES": "GDR", "GDR": "GDR",
    "RE": "EPR", "EPR": "EPR",
    "DEM": "DEM", "HOR": "HOR",
    "LR": "LR", "DR": "LR",
    "RN": "RN", "LIOT": "LIOT", "UDR": "UDR",
}


def mediane(valeurs):
    valeurs = sorted(valeurs)
    if not valeurs:
        return None
    milieu = len(valeurs) // 2
    return valeurs[milieu] if len(valeurs) % 2 else (valeurs[milieu - 1] + valeurs[milieu]) / 2.0


def participation_mediane(deputes, solennels_par_date, participants):
    """Participation médiane aux scrutins solennels, parmi les députés présents pour au moins 10 d'entre eux."""
    taux_deputes = []
    for uid, depute in deputes.items():
        pendant = [s for s in solennels_par_date if en_mandat(depute, s["date"] or "")]
        if len(pendant) >= 10:
            votes = sum(1 for s in pendant if uid in participants.get(s["uid"], ()))
            taux_deputes.append(100.0 * votes / len(pendant))
    m = mediane(taux_deputes)
    return {"taux": round(m, 1) if m is not None else None, "deputes": len(taux_deputes)}


def construire_app(votes_cles, candidats, deputes, groupes, tous_scrutins, votes, fiches, mediane_sol):
    """Petit fichier pour l'application : seulement ce qu'elle affiche (quelques dizaines de Ko)."""
    index = {(s["legislature"], s["numero"]): s for leg in LEGISLATURES for s in tous_scrutins[leg]}
    sortie_votes = []
    for v in votes_cles:
        entree = dict(v)
        s = index.get((v.get("legislature"), v.get("numero")))
        if v.get("numero") is not None and s is None:
            print("Attention : scrutin %s n° %s introuvable pour le vote clé « %s »." % (v["legislature"], v["numero"], v["id"]))
        if s:
            entree["officiel"] = {
                "uid": s["uid"], "date": s["date"], "titre": s["titre"], "sort": s["sort"],
                "pour": s["pour"], "contre": s["contre"], "abstentions": s["abstentions"],
                "votants": s["votants"], "requis": s["requis"], "url": s["url"], "solennel": s["solennel"],
                "groupes": [{
                    "groupe": g["groupe"],
                    "nom": (groupes.get(g["ref"]) or {}).get("nom") or g["groupe"],
                    "famille": FAMILLES.get(g["groupe"]),
                    "position": g["position"], "cohesion": g["cohesion"],
                    "pour": g["pour"], "contre": g["contre"], "abstentions": g["abstentions"],
                } for g in s["groupes"]],
            }
        sortie_votes.append(entree)

    sortie_candidats = {}
    for c, fiche in zip(candidats, fiches):
        depute = deputes.get(c.get("acteur")) if c.get("acteur") else None
        perso = {}
        if depute:
            par_scrutin = {x["scrutin"]: x for x in votes.get(c["acteur"], [])}
            for v in sortie_votes:
                off = v.get("officiel")
                if not off:
                    continue
                siegeait = en_mandat(depute, off["date"])
                vote = par_scrutin.get(off["uid"])
                perso[v["id"]] = {
                    "siegeait": siegeait,
                    "position": vote["position"] if vote else ("absent" if siegeait else None),
                    "groupe": vote["groupe"] if vote else None,
                }
        sortie_candidats[c["id"]] = {
            "depute": depute is not None,
            "mandats": fiche["mandats"],
            "groupes": [{"abrege": p["abrege"], "debut": p["debut"], "fin": p["fin"], "legislature": p["legislature"]} for p in fiche["groupes"]],
            "participation": fiche["participation"],
            "votesCles": perso,
        }

    return {
        "dernierScrutin": max(s["date"] for leg in LEGISLATURES for s in tous_scrutins[leg] if s["date"]),
        "medianeSolennels": mediane_sol,
        "votesCles": sortie_votes,
        "candidats": sortie_candidats,
        "source": "Assemblée nationale, data.assemblee-nationale.fr (Licence Ouverte)",
    }


# ---------- Programme principal ----------

def main():
    with open(os.path.join(DOSSIER_AGENT, "candidats.json"), encoding="utf-8") as f:
        candidats = json.load(f)["candidats"]

    hors_ligne = "--hors-ligne" in sys.argv
    chemins, empreintes = {}, {}
    for nom, url in SOURCES.items():
        chemins[nom], empreintes[nom] = telecharger(nom, url, hors_ligne)

    groupes, deputes = lire_acteurs(chemins["acteurs"])
    suivis = {c["acteur"] for c in candidats if c.get("acteur")}
    for uid in suivis:
        if uid not in deputes:
            print("Attention : %s n'a aucun mandat de député en 16e ou 17e législature." % uid)

    tous_scrutins = {}
    votes = {uid: [] for uid in suivis}
    participants = {}
    for leg in LEGISLATURES:
        scrutins, votes_leg, participants_leg = lire_scrutins(chemins["scrutins-" + leg], leg, groupes, suivis)
        tous_scrutins[leg] = scrutins
        participants.update(participants_leg)
        for uid, liste in votes_leg.items():
            votes[uid].extend(liste)
        ecrire("scrutins-%s.json" % leg, scrutins, une_ligne_par_element=True)

    # Votes des candidats : on compte la participation sur les seuls scrutins tenus pendant le mandat.
    # Le taux sur tous les scrutins est bas pour tout le monde (des milliers d'amendements) :
    # à l'écran, montrer plutôt le taux sur les scrutins solennels, et toujours avec la médiane.
    solennels = {s["uid"] for leg in LEGISLATURES for s in tous_scrutins[leg] if s["solennel"]}
    sortie_candidats = []
    for c in candidats:
        uid = c.get("acteur")
        depute = deputes.get(uid) if uid else None
        fiche = {"id": c["id"], "nom": c["nom"], "acteur": uid, "mandats": [], "groupes": [], "votes": [], "participation": None}
        if depute:
            fiche["mandats"] = depute["mandats"]
            fiche["groupes"] = [dict(p, abrege=(groupes.get(p["groupe"]) or {}).get("abrege")) for p in depute["groupes"]]
            fiche["votes"] = sorted(votes.get(uid, []), key=lambda v: (v["date"] or "", v["scrutin"]))
            pendant = [s for leg in LEGISLATURES for s in tous_scrutins[leg] if en_mandat(depute, s["date"] or "")]
            exprimes = [v for v in fiche["votes"] if v["position"] != "non-votant"]
            pendant_sol = [s for s in pendant if s["solennel"]]
            exprimes_sol = [v for v in exprimes if v["scrutin"] in solennels]
            fiche["participation"] = {
                "tous": taux(len(exprimes), len(pendant)),
                "solennels": taux(len(exprimes_sol), len(pendant_sol)),
            }
        sortie_candidats.append(fiche)
    ecrire("candidats-votes.json", sortie_candidats)

    ecrire("groupes.json", groupes)

    # Fichier de l'application : un script JavaScript, pour que index.html s'ouvre d'un double-clic.
    with open(os.path.join(RACINE, "contenu", "votes-cles.json"), encoding="utf-8") as f:
        votes_cles = json.load(f)["votes"]
    solennels_liste = [s for leg in LEGISLATURES for s in tous_scrutins[leg] if s["solennel"]]
    app = construire_app(votes_cles, candidats, deputes, groupes, tous_scrutins, votes, sortie_candidats,
                         participation_mediane(deputes, solennels_liste, participants))
    with open(os.path.join(SORTIE, "app.js"), "w", encoding="utf-8") as f:
        f.write("// Fichier produit par agents/collecte/collecte.py : ne pas modifier à la main.\n")
        f.write("window.MARIAN_DONNEES = ")
        json.dump(app, f, ensure_ascii=False, sort_keys=True, indent=1)
        f.write(";\n")
    print("Écrit : data/app.js")

    # Grands votes classés par catégorie, pour la page « Qui a voté quoi ? ».
    n = grands_votes.construire(
        tous_scrutins, groupes, candidats, votes,
        {f["id"]: f["mandats"] for f in sortie_candidats}, FAMILLES, os.path.join(SORTIE, "votes.js"))
    print("Écrit : data/votes.js (%d grands votes)" % n)

    # Ni date ni empreinte ici : l'Assemblée régénère ses archives chaque nuit. Le fichier ne change
    # que si les données changent, ce qui évite une pull request chaque nuit pour rien.
    # Les empreintes vont dans le cache, et la pull request les affiche.
    with open(os.path.join(CACHE, "empreintes.json"), "w", encoding="utf-8") as f:
        json.dump(empreintes, f, indent=2)
    ecrire("collecte.json", {
        "sources": SOURCES,
        "scrutins": {leg: len(tous_scrutins[leg]) for leg in LEGISLATURES},
        "dernierScrutin": {leg: (tous_scrutins[leg][-1]["date"] if tous_scrutins[leg] else None) for leg in LEGISLATURES},
        "candidatsSuivis": sorted(c["id"] for c in candidats if c.get("acteur") in deputes),
        "licence": "Licence Ouverte / Open Licence (Etalab), source : Assemblée nationale",
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
