#!/usr/bin/env python3
"""Contrôles de sécurité avant d'écrire les votes dans Supabase, chaque nuit.

Compare les données produites par l'agent de collecte (dossier data/, sur la machine de GitHub)
avec celles déjà publiées dans Supabase, que lit le site. Les votes ne sont écrits que si
TOUS les contrôles passent :
  - les fichiers se lisent (JSON valide) ;
  - le nombre de scrutins ne baisse dans aucune législature ;
  - la date du dernier scrutin ne recule pas ;
  - aucun grand vote déjà publié ne disparaît ;
  - les candidats suivis sont toujours les mêmes.
Sinon rien n'est écrit : la tâche apparaît en rouge dans l'onglet Actions et un humain regarde.

Aucune IA, aucune librairie à installer. Variables nécessaires : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Usage : python3 agents/collecte/controles.py
Code de sortie 0 : tout est bon, les votes peuvent être écrits. 1 : un humain doit regarder.
"""

import json
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RACINE, "agents", "supabase"))


def lire_js(texte):
    """data/votes.js : « window.MARIAN_VOTES = {...}; » précédé d'un commentaire."""
    debut = texte.index("=") + 1
    return json.loads(texte[debut:].strip().rstrip(";"))


def version_nouvelle(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return f.read()


def version_publiee():
    """Les chiffres de collecte et les grands votes actuellement publiés dans Supabase."""
    import client
    lignes = client.lire("collecte", select="cle,valeur", cle="in.(collecte,site_votes)")
    return {l["cle"]: l["valeur"] for l in lignes}


def main():
    problemes = []
    try:
        apres_c = json.loads(version_nouvelle("data/collecte.json"))
        apres_v = lire_js(version_nouvelle("data/votes.js"))
    except (ValueError, OSError) as erreur:
        print("ÉCHEC : fichiers de la collecte illisibles (%s)" % erreur)
        return 1
    publie = version_publiee()
    avant_c = publie.get("collecte") or {}
    avant_v = publie.get("site_votes") or {}
    if not avant_v:
        print("Aucun grand vote encore publié dans Supabase : première publication.")

    for leg, n_avant in avant_c.get("scrutins", {}).items():
        n_apres = apres_c.get("scrutins", {}).get(leg, 0)
        if n_apres < n_avant:
            problemes.append("%se législature : %d scrutins au lieu de %d" % (leg, n_apres, n_avant))
    for leg, d_avant in avant_c.get("dernierScrutin", {}).items():
        d_apres = apres_c.get("dernierScrutin", {}).get(leg)
        if d_avant and (not d_apres or d_apres < d_avant):
            problemes.append("%se législature : dernier scrutin le %s au lieu du %s" % (leg, d_apres, d_avant))

    ids_avant = {l["id"] for l in avant_v.get("lois", [])}
    ids_apres = {l["id"] for l in apres_v["lois"]}
    disparus = ids_avant - ids_apres
    if disparus:
        problemes.append("%d grand(s) vote(s) disparu(s) : %s" % (len(disparus), ", ".join(sorted(disparus)[:5])))
    cand_avant = sorted(c["id"] for c in avant_v.get("candidats", []))
    cand_apres = sorted(c["id"] for c in apres_v.get("candidats", []))
    if avant_v and cand_avant != cand_apres:
        problemes.append("candidats suivis différents : %s → %s" % (cand_avant, cand_apres))

    print("Scrutins : %s → %s" % (avant_c.get("scrutins"), apres_c.get("scrutins")))
    print("Grands votes : %d → %d (%d nouveau(x))" % (len(ids_avant), len(ids_apres), len(ids_apres - ids_avant)))
    if problemes:
        print("CONTRÔLES ÉCHOUÉS : rien n'est écrit dans Supabase, un humain doit regarder.")
        for p in problemes:
            print("  - " + p)
        return 1
    print("Contrôles réussis : les votes peuvent être écrits dans Supabase.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
