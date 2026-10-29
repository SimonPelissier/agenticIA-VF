"""Extraction du projet de Place publique, « Acte un » (PDF).

Pas d'IA. Place publique ne désigne pas de mesures prioritaires : la règle appliquée
(docs/programmes.md) est de prendre, pour chaque chantier, la première mesure de sa
liste « Nous voulons : », dans l'ordre du document.

Le PDF se lit grâce à sa mise en forme :
  - titre de chapitre : texte gras de 47 à 50 pt ;
  - chantier : numéro gras de 24,5 pt, mot « chantier », titre gras de 26 pt ;
  - mesures : après « Nous voulons : », chaque puce est une ligne qui commence par une tabulation,
    suivie de lignes de texte courant (11 ou 12 pt).
Le « chantier cadre » (financement, p. 84-85) n'a pas de liste « Nous voulons : » : il n'est pas repris.
Le texte d'une mesure est la suite de ses lignes, telles quelles, séparées par une espace.

    python agents/extraction/place_publique_acte1.py
"""

import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "contenu" / "programmes"
FICHIER = "sources/place-publique/projet-placepublique-acte1.pdf"
URL = "https://place-publique.eu/document/6J8wjk3EW8dBCLwKxa7J96/projet-placepublique-acte1.pdf"
CONSULTE_LE = "2026-10-29"
# Pages d'ouverture des trois parties (titre en très gros caractères).
PARTIES = {6: "Une France puissante grâce à une Europe souveraine",
           36: "Un nouveau contrat social et démocratique pour une France plus juste",
           84: "Retrouver les moyens d’agir, financer nos ambitions"}


def propre(t):
    return re.sub(r"\s+", " ", t).strip()


def puce(texte):
    """Début d'une puce : tabulation, ou espace suivie d'une majuscule quand la puce est dessinée à part (p. 34)."""
    return texte.startswith("\t") or re.match(r" [A-ZÀ-ÝŒ]", texte) is not None


def lignes(page):
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = [s for s in l["spans"] if s["text"]]
            if spans:
                yield spans


def main():
    doc = pymupdf.open(DOSSIER / FICHIER)
    mesures, partie, chapitre = [], None, None
    for n in range(doc.page_count):
        num = n + 1
        if num in PARTIES:
            partie, chapitre = PARTIES[num], None
        titre_chap, sous_titre, numero, titre, premiere, nous_voulons, en_cours = [], [], None, [], None, False, None
        for spans in lignes(doc[n]):
            s0 = spans[0]
            texte = "".join(s["text"] for s in spans)
            gras = bool(s0["flags"] & 16)
            if gras and 46 <= s0["size"] <= 50:
                titre_chap.append(texte)
            elif gras and 26.5 <= s0["size"] <= 35 and re.match(r"\d+\. ", texte):
                sous_titre.append(texte)  # « 1. Sauver l’École de la République » sous un titre de chapitre
            elif gras and abs(s0["size"] - 24.5) < 0.3 and texte.strip().isdigit():
                numero = int(texte)
            elif gras and abs(s0["size"] - 26) < 0.3:
                titre.append(texte)
            elif texte.strip().startswith("Nous voulons"):
                nous_voulons = True
            elif nous_voulons and premiere is None:
                if puce(texte):
                    en_cours = [texte]
                    premiere = en_cours
            elif en_cours is not None and premiere is en_cours and not puce(texte) and not gras and 9 <= s0["size"] <= 13:
                en_cours.append(texte)
            elif en_cours is not None and puce(texte):
                en_cours = None  # puce suivante : la première mesure est complète
        if titre_chap:
            # Titre et sous-titre ne se suivent pas toujours dans le texte du PDF : deux morceaux exacts.
            chapitre = [propre(" ".join(titre_chap))] + ([propre(" ".join(sous_titre))] if sous_titre else [])
            chapitre = chapitre[0] if len(chapitre) == 1 else chapitre
        if numero is None:
            continue
        if not titre or not premiere:
            sys.exit("page %d : chantier %d sans titre ou sans mesure, à vérifier à la main" % (num, numero))
        mesures.append({
            "ordre": len(mesures) + 1, "partie": partie, "chapitre": chapitre,
            "repere": "Chantier %d" % numero,
            "titre": propre(" ".join(titre)),
            "texte": propre(" ".join(premiere)), "source": "acte1", "page": num,
        })
        print("p.%2d  %-45s | ch.%d %s" % (num, str(chapitre)[:45], numero, propre(" ".join(titre))[:50]))

    pdf = DOSSIER / FICHIER
    prog = {
        "_note": "Projet de Place publique, « Acte un ». Pas de mesures prioritaires désignées par le parti : première mesure de chaque chantier, dans l'ordre du document. Produit par agents/extraction/place_publique_acte1.py, vérifié par agents/verification/programmes.py.",
        "id": "place-publique",
        "parti": "Place publique",
        "programme": "Acte un : notre vision pour la France, les chantiers de Place publique",
        "structure": "premiere-par-chapitre",
        "libelle": None,
        "unite": "chantier",
        "regle": "Pour chaque chantier, la première mesure de sa liste « Nous voulons : », telle qu’elle apparaît dans le document.",
        "sources": [{"id": "acte1", "titre": "Acte un : notre vision pour la France (PDF)", "url": URL,
                     "consulte_le": CONSULTE_LE, "fichier": FICHIER,
                     "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()}],
        "mesures": mesures,
    }
    (DOSSIER / "place-publique.json").write_text(json.dumps(prog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("%d chantiers écrits dans contenu/programmes/place-publique.json" % len(mesures))


if __name__ == "__main__":
    main()
