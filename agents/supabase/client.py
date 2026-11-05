"""Accès à la base Supabase de MarIAn, sans librairie à installer (API REST de Supabase).

La clé est lue dans les variables d'environnement, jamais écrite dans le code :
  SUPABASE_URL                adresse du projet (https://xxxx.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY   clé secrète des agents (secrets GitHub ou variables de l'environnement Claude)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def _config():
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    cle = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not cle:
        sys.exit("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant : voir docs/supabase.md.")
    return url, cle


def _requete(methode, chemin, corps=None, entetes=None, essais=3):
    url, cle = _config()
    h = {"apikey": cle, "Authorization": "Bearer " + cle, "Content-Type": "application/json"}
    h.update(entetes or {})
    donnees = json.dumps(corps, ensure_ascii=False).encode("utf-8") if corps is not None else None
    for essai in range(1, essais + 1):
        try:
            req = urllib.request.Request(url + "/rest/v1/" + chemin, data=donnees, headers=h, method=methode)
            with urllib.request.urlopen(req, timeout=120) as rep:
                texte = rep.read().decode("utf-8")
                return json.loads(texte) if texte else None
        except urllib.error.HTTPError as erreur:
            detail = erreur.read().decode("utf-8", errors="ignore")[:500]
            if erreur.code < 500 or essai == essais:
                sys.exit("Supabase a refusé la requête %s %s (HTTP %d) : %s" % (methode, chemin.split("?")[0], erreur.code, detail))
        except OSError as erreur:
            if essai == essais:
                sys.exit("Supabase injoignable : %s" % erreur)
        time.sleep(5 * essai)


def upsert(table, lignes, conflit=None, lot=500):
    """Insère ou met à jour des lignes (clé primaire, ou les colonnes de « conflit »)."""
    chemin = table + ("?on_conflict=" + urllib.parse.quote(conflit) if conflit else "")
    for i in range(0, len(lignes), lot):
        _requete("POST", chemin, lignes[i:i + lot], {"Prefer": "resolution=merge-duplicates,return=minimal"})
    return len(lignes)


def lire(table, **filtres):
    """Lit des lignes. Exemple : lire("articles", select="id,url", traite="eq.false")."""
    params = urllib.parse.urlencode(filtres)
    lignes, debut = [], 0
    while True:
        lot = _requete("GET", table + ("?" + params if params else ""), entetes={"Range": "%d-%d" % (debut, debut + 999)})
        lignes += lot or []
        if not lot or len(lot) < 1000:
            return lignes
        debut += 1000
