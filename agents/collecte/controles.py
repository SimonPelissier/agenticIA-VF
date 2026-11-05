#!/usr/bin/env python3
"""Contrôles de sécurité avant la publication automatique des votes.

Compare les données produites par l'agent de collecte (dossier data/) avec celles de la version
publiée (main, ou le commit indiqué). La mise à jour n'est publiée sans relecture humaine que si
TOUS les contrôles passent :
  - les fichiers se lisent (JSON valide) ;
  - le nombre de scrutins ne baisse dans aucune législature ;
  - la date du dernier scrutin ne recule pas ;
  - aucun grand vote déjà publié ne disparaît de data/votes.js ;
  - les candidats suivis sont toujours les mêmes.

Aucune IA, aucune clé, aucune librairie à installer.

Usage : python3 agents/collecte/controles.py [REF]    (REF : version de comparaison, par défaut HEAD~1)
Code de sortie 0 : tout est bon, la mise à jour peut être publiée. 1 : un humain doit relire.
"""

import json
import os
import subprocess
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def lire_js(texte):
    """data/votes.js : « window.MARIAN_VOTES = {...}; » précédé d'un commentaire."""
    debut = texte.index("=") + 1
    return json.loads(texte[debut:].strip().rstrip(";"))


def version_publiee(ref, chemin):
    return subprocess.run(["git", "show", "%s:%s" % (ref, chemin)], cwd=RACINE,
                          capture_output=True, text=True, check=True).stdout


def version_nouvelle(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return f.read()


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
    problemes = []
    try:
        avant_c = json.loads(version_publiee(ref, "data/collecte.json"))
        apres_c = json.loads(version_nouvelle("data/collecte.json"))
        avant_v = lire_js(version_publiee(ref, "data/votes.js"))
        apres_v = lire_js(version_nouvelle("data/votes.js"))
    except (ValueError, OSError, subprocess.CalledProcessError) as erreur:
        print("ÉCHEC : fichiers illisibles (%s)" % erreur)
        return 1

    for leg, n_avant in avant_c.get("scrutins", {}).items():
        n_apres = apres_c.get("scrutins", {}).get(leg, 0)
        if n_apres < n_avant:
            problemes.append("%se législature : %d scrutins au lieu de %d" % (leg, n_apres, n_avant))
    for leg, d_avant in avant_c.get("dernierScrutin", {}).items():
        d_apres = apres_c.get("dernierScrutin", {}).get(leg)
        if d_avant and (not d_apres or d_apres < d_avant):
            problemes.append("%se législature : dernier scrutin le %s au lieu du %s" % (leg, d_apres, d_avant))

    ids_avant = {l["id"] for l in avant_v["lois"]}
    ids_apres = {l["id"] for l in apres_v["lois"]}
    disparus = ids_avant - ids_apres
    if disparus:
        problemes.append("%d grand(s) vote(s) disparu(s) : %s" % (len(disparus), ", ".join(sorted(disparus)[:5])))
    cand_avant = sorted(c["id"] for c in avant_v.get("candidats", []))
    cand_apres = sorted(c["id"] for c in apres_v.get("candidats", []))
    if cand_avant != cand_apres:
        problemes.append("candidats suivis différents : %s → %s" % (cand_avant, cand_apres))

    print("Scrutins : %s → %s" % (avant_c.get("scrutins"), apres_c.get("scrutins")))
    print("Grands votes : %d → %d (%d nouveau(x))" % (len(ids_avant), len(ids_apres), len(ids_apres - ids_avant)))
    if problemes:
        print("CONTRÔLES ÉCHOUÉS, relecture humaine nécessaire :")
        for p in problemes:
            print("  - " + p)
        return 1
    print("Contrôles réussis : la mise à jour peut être publiée.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
