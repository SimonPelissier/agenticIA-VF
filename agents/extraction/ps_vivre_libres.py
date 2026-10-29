"""Extraction du projet du Parti socialiste, « Vivre libres » (projet-socialiste.fr).

Pas d'IA. Le PS ne désigne pas de mesures prioritaires : pour chaque sous-partie, on prend
la première puce de sa liste « Propositions », dans l'ordre du site (docs/programmes.md).

Structure de la page : <h2>Chapitre n – …</h2>, <h3>sous-partie</h3>, <h4>Propositions</h4>, <ul><li>…</li></ul>.

    python agents/extraction/ps_vivre_libres.py
"""

import hashlib
import html
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "contenu" / "programmes"
FICHIER = "sources/ps/vivre-libres.html"
URL = "https://projet-socialiste.fr/projet/vivre-libres/"
CONSULTE_LE = "2026-10-29"


def texte(fragment):
    t = re.sub(r"<br\s*/?>", " ", fragment)
    t = re.sub(r"<[^>]+>", "", t)  # balises de mise en forme : retirées sans ajouter d'espace
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def main():
    page = (DOSSIER / FICHIER).read_text(encoding="utf-8")
    page = re.sub(r"(?is)<(script|style|svg)\b.*?</\1>", " ", page)
    # Les titres et la première puce qui suit chaque « Propositions », dans l'ordre de la page.
    jetons = re.finditer(r"(?is)<h([234])[^>]*>(.*?)</h\1>|<li[^>]*>(.*?)</li>", page)
    mesures, chapitre, sous_partie, attente = [], None, None, False
    for j in jetons:
        if j.group(1):
            niveau, t = j.group(1), texte(j.group(2))
            if niveau == "2":
                chapitre = t if re.match(r"Chapitre \d+", t) else None
                sous_partie = None
            elif niveau == "3":
                sous_partie = t
            elif niveau == "4":
                attente = chapitre is not None and t.rstrip(" :").lower() == "propositions"
        elif attente:
            mesures.append({"ordre": len(mesures) + 1, "chapitre": chapitre, "titre": sous_partie,
                            "texte": texte(j.group(3)), "source": "site", "page": None})
            attente = False
            print("%-45s | %s" % (chapitre[:45], sous_partie))

    prog = {
        "_note": "Projet du Parti socialiste, « Vivre libres ». Pas de mesures prioritaires désignées par le parti : première proposition de chaque sous-partie. Produit par agents/extraction/ps_vivre_libres.py, vérifié par agents/verification/programmes.py.",
        "id": "ps",
        "parti": "Parti socialiste",
        "programme": "Vivre libres, le projet socialiste (avril 2026)",
        "structure": "premiere-par-chapitre",
        "libelle": None,
        "unite": "sous-partie",
        "regle": "Pour chaque sous-partie, la première puce de sa liste « Propositions », telle qu’elle apparaît sur le site.",
        "sources": [{"id": "site", "titre": "Vivre libres, projet-socialiste.fr", "url": URL, "consulte_le": CONSULTE_LE,
                     "fichier": FICHIER, "sha256": hashlib.sha256((DOSSIER / FICHIER).read_bytes()).hexdigest()}],
        "mesures": mesures,
    }
    (DOSSIER / "ps.json").write_text(json.dumps(prog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("%d sous-parties écrites dans contenu/programmes/ps.json" % len(mesures))


if __name__ == "__main__":
    main()
