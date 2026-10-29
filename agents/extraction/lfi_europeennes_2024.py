"""Extraction des « Mesure-clé » du programme de l'Union populaire (LFI, européennes 2024).

Pas d'IA : lit les pages archivées dans contenu/programmes/sources/lfi/ et recopie,
dans l'ordre du site, chaque bloc qui suit un titre « Mesure-clé ». Le texte n'est
pas retouché (seules les entités HTML sont décodées). Remplit contenu/programmes/lfi.json ;
la vérification se fait ensuite avec agents/verification/programmes.py.

Sur chaque page de chapitre, chaque onglet a cette forme :
  <h2>titre de la partie</h2> <h2>Mesure-clé</h2> <h2><p>texte de la mesure</p></h2> <h2>Toutes les mesures</h2> …

    python agents/extraction/lfi_europeennes_2024.py
"""

import hashlib
import html
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "contenu" / "programmes"
BASE = "https://lafranceinsoumise.fr/europeennes-2024/programme-de-lunion-populaire/"
CONSULTE_LE = "2026-10-29"
CHAPITRES = [
    "chapitre-1-sortir-de-lausterite-et-partager-les-richesses",
    "chapitre-2-en-finir-avec-le-dumping-social",
    "chapitre-3-sortir-du-libre-echange-et-relocaliser",
    "chapitre-4-faire-la-planification-ecologique-europeenne",
    "chapitre-5-faire-respecter-la-souverainete-populaire-en-europe-aussi",
    "chapitre-6-etendre-les-droits-et-libertes-face-aux-reactionnaires",
    "chapitre-7-lutter-contre-lexil-force-et-organiser-un-accueil-coordonne",
    "chapitre-8-refuser-la-vassalisation-de-leurope",
    "chapitre-9-nouvelles-frontieres-de-lhumanite",
]


def texte(fragment):
    """Texte d'un fragment HTML, sans retouche : balises retirées, entités décodées, blancs de bord ôtés."""
    t = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"[ \t\r\n]+", " ", html.unescape(t)).strip()


def titres(page):
    return [texte(m) for m in re.findall(r"(?is)<h[12][^>]*>(.*?)</h[12]>", page)]


def main():
    sources, mesures = [], []
    for n, slug in enumerate(CHAPITRES, 1):
        fichier = DOSSIER / "sources" / "lfi" / ("chapitre-%d.html" % n)
        page = fichier.read_text(encoding="utf-8")
        h = titres(page)
        chapitre = next(t for t in h if re.match(r"(?i)chapitre\s*%d\b" % n, t))
        sid = "ch%d" % n
        sources.append({
            "id": sid, "titre": chapitre, "url": BASE + slug + "/", "consulte_le": CONSULTE_LE,
            "fichier": "sources/lfi/chapitre-%d.html" % n,
            "sha256": hashlib.sha256(fichier.read_bytes()).hexdigest(),
        })
        trouvees = 0
        for i, t in enumerate(h):
            if t.lower() in ("mesure-clé", "mesure-clef", "mesure clé") and i + 1 < len(h):
                mesures.append({
                    "ordre": len(mesures) + 1, "chapitre": chapitre, "titre": h[i - 1],
                    "texte": h[i + 1], "source": sid, "page": None,
                })
                trouvees += 1
        print("%s : %d mesure(s)-clé(s)" % (chapitre, trouvees))

    prog = json.loads((DOSSIER / "lfi.json").read_text(encoding="utf-8"))
    prog.pop("_a_faire", None)
    # Le classement par sujet est un choix de l'équipe : on le garde pour les mesures dont le texte n'a pas changé.
    anciens = {m["texte"]: m.get("themes") for m in prog.get("mesures", [])}
    for m in mesures:
        if anciens.get(m["texte"]):
            m["themes"] = anciens[m["texte"]]
    prog.update({
        "programme": "Programme de l’Union populaire, élections européennes 2024",
        "structure": "mesures-cles",
        "libelle": "Mesure-clé",
        "regle": None,
        "sources": sources,
        "mesures": mesures,
    })
    (DOSSIER / "lfi.json").write_text(json.dumps(prog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("%d mesures écrites dans contenu/programmes/lfi.json" % len(mesures))


if __name__ == "__main__":
    main()
