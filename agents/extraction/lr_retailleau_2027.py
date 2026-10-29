"""Extraction du projet de Bruno Retailleau (Les Républicains), avecretailleau.fr/projet.

Pas d'IA. Le site ne désigne pas de mesures prioritaires : pour chaque thème publié, on prend
la première mesure de sa liste, dans l'ordre du site (docs/programmes.md). Les thèmes marqués
« À venir » ne sont pas repris.

Deux pages par thème sont archivées dans contenu/programmes/sources/lr/ :
  - theme-<n>-<slug>.html : titre du thème et liste des mesures (numéro, titre, lien) ;
  - mesure-<n>.html : la première mesure ; son texte est le bloc « L'engagement. ».

    python agents/extraction/lr_retailleau_2027.py --liens   # adresses des premières mesures à archiver
    python agents/extraction/lr_retailleau_2027.py           # écrit contenu/programmes/lr.json
"""

import hashlib
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "verification"))
from programmes import blocs_html, normaliser  # mêmes règles que la vérification

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "contenu" / "programmes"
SITE = "https://www.avecretailleau.fr"
CONSULTE_LE = "2026-10-29"
THEMES = ["institutions", "education", "travail", "industrie-entreprises", "agriculture", "logement",
          "famille", "electricite", "comptes-publics", "l-ia", "retraites"]


def sha(chemin):
    return hashlib.sha256(chemin.read_bytes()).hexdigest()


def theme(n, slug):
    fichier = DOSSIER / "sources" / "lr" / ("theme-%d-%s.html" % (n, slug))
    page = fichier.read_text(encoding="utf-8")
    blocs = blocs_html(page)
    # Numéro de thème donné par le site (Retraites est le n° 14 : les n° 11 à 13 sont « À venir »).
    i = next(k for k, b in enumerate(blocs) if re.fullmatch(r"Le projetThème n° \d+", b))
    titre_theme = blocs[i + 1]
    j = blocs.index("Les mesures.", i)
    # Après « N mesures » : numéro, « Le projet·Thème », étiquette, titre, « Voir la mesure ».
    k = next(k for k in range(j, len(blocs)) if blocs[k].isdigit())
    numero, titre = int(blocs[k]), blocs[k + 3]
    if blocs[k + 4] != "Voir la mesure":
        sys.exit("thème %d : carte de mesure inattendue, à vérifier à la main" % n)
    lien = re.search(r'href="(/projet/mesure/[^"#?]+)"', page).group(1)
    return fichier, titre_theme, numero, titre, SITE + lien


def engagement(fichier, titre):
    page = fichier.read_text(encoding="utf-8")
    # Les adresses des mesures sont parfois anciennes : on s'assure que la page est bien celle de la carte.
    h1 = re.search(r"(?s)<h1[^>]*>(.*?)</h1>", page)
    if not h1 or normaliser(html.unescape(re.sub(r"<[^>]+>", "", h1.group(1)))) != normaliser(titre):
        sys.exit("%s : le titre de la page ne correspond pas à la carte « %s »" % (fichier.name, titre))
    m = re.search(r"(?s)L&#x27;engagement<span[^>]*>\.</span></span></div><div[^>]*>(.*?)</div>", page)
    if not m:
        sys.exit("%s : bloc « L'engagement. » introuvable" % fichier.name)
    paras = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", p))).strip()
             for p in re.findall(r"(?s)<p[^>]*>(.*?)</p>", m.group(1))]
    return "\n\n".join(p for p in paras if p)


def main():
    themes = [theme(n, slug) for n, slug in enumerate(THEMES, 1)]
    if "--liens" in sys.argv:
        for n, (_, _, _, _, url) in enumerate(themes, 1):
            print(n, url)
        return
    sources, mesures = [], []
    for n, (f_theme, titre_theme, numero, titre, url) in enumerate(themes, 1):
        f_mesure = DOSSIER / "sources" / "lr" / ("mesure-%d.html" % n)
        sources.append({"id": "theme-%d" % n, "titre": "Thème : " + titre_theme, "url": SITE + "/projet/theme/" + THEMES[n - 1],
                        "consulte_le": CONSULTE_LE, "fichier": "sources/lr/" + f_theme.name, "sha256": sha(f_theme)})
        sources.append({"id": "mesure-%d" % n, "titre": titre, "url": url, "consulte_le": CONSULTE_LE,
                        "fichier": "sources/lr/" + f_mesure.name, "sha256": sha(f_mesure)})
        mesures.append({"ordre": n, "chapitre": titre_theme, "repere": "Mesure %d" % numero, "titre": titre,
                        "texte": engagement(f_mesure, titre), "source": "mesure-%d" % n, "page": None})
        print("%-35s | %d %s" % (titre_theme, numero, titre))
    prog = {
        "_note": "Projet de Bruno Retailleau (Les Républicains), avecretailleau.fr. Pas de mesures prioritaires désignées : première mesure de chaque thème publié. Produit par agents/extraction/lr_retailleau_2027.py, vérifié par agents/verification/programmes.py.",
        "id": "lr",
        "parti": "Les Républicains",
        "programme": "Le projet de Bruno Retailleau pour 2027 (thèmes publiés au 29 octobre 2026)",
        "structure": "premiere-par-chapitre",
        "libelle": None,
        "unite": "thème",
        "regle": "Pour chaque thème publié sur le site, la première mesure de sa liste ; son texte est le paragraphe « L’engagement » de la page de la mesure. Les thèmes « À venir » ne sont pas repris.",
        "sources": sources,
        "mesures": mesures,
    }
    (DOSSIER / "lr.json").write_text(json.dumps(prog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("%d thèmes écrits dans contenu/programmes/lr.json" % len(mesures))


if __name__ == "__main__":
    main()
