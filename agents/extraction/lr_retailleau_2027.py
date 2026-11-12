"""Extraction du projet de Bruno Retailleau (Les Républicains), avecretailleau.fr/projet.

Pas d'IA. On reprend la classification du site : ses thèmes, dans son ordre, et toutes les
cartes de mesure de chaque thème, dans son ordre (docs/programmes.md). Les thèmes marqués
« À venir » sont repris comme tels, sans mesure.

Sources archivées dans contenu/programmes/sources/lr/ :
  - projet.html : la page du projet (titres des thèmes, thèmes « À venir » et leur phrase de
    présentation, et, dans ses données, la liste des mesures de chaque thème) ;
  - mesure-<thème>-<n>.html : une page par mesure ; son texte est le bloc « L'engagement. ».

    python agents/extraction/lr_retailleau_2027.py --telecharger   # archive les pages (remplace les anciennes)
    python agents/extraction/lr_retailleau_2027.py                 # écrit contenu/programmes/lr.json
"""

import gzip
import hashlib
import html
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "verification"))
from programmes import blocs_html, normaliser  # mêmes règles que la vérification

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "contenu" / "programmes"
ARCHIVE = DOSSIER / "sources" / "lr"
SITE = "https://www.avecretailleau.fr"
CONSULTE_LE = "2026-11-12"


def sha(chemin):
    return hashlib.sha256(chemin.read_bytes()).hexdigest()


def telecharger(url):
    # Sans compression, le serveur coupe parfois la page en route (pages archivées le 29 octobre) :
    # on la demande compressée et on refuse une page qui ne se termine pas.
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        brut = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            brut = gzip.decompress(brut)
    if not brut.rstrip().endswith(b"</html>"):
        sys.exit("%s : page incomplète, relancer plus tard" % url)
    return brut


def rsc(page):
    """Les données de la page (Next.js), en texte."""
    dec = json.JSONDecoder()
    morceaux = [dec.raw_decode(page[m.end():])[0] for m in re.finditer(r"self\.__next_f\.push\(", page)]
    return "".join(m[1] for m in morceaux if len(m) > 1 and isinstance(m[1], str))


def donnees(page):
    """Thèmes et mesures du site, lus dans les données de la page du projet."""
    texte = rsc(page)
    return json.JSONDecoder().raw_decode(texte[texte.index('{"ambitions"'):])[0]


def fichier_mesure(m):
    return ARCHIVE / ("mesure-%s.html" % m["ref"].replace(".", "-"))


def url_mesure(m):
    return SITE + "/projet/mesure/" + m["slug"]


def engagement(fichier, m):
    page = fichier.read_text(encoding="utf-8")
    h1 = re.search(r"(?s)<h1[^>]*>(.*?)</h1>", page)
    titre = normaliser(html.unescape(re.sub(r"<[^>]+>", "", h1.group(1)))) if h1 else ""
    if titre.rstrip(". ") != normaliser(m["titre"]).rstrip(". "):
        sys.exit("%s : le titre de la page ne correspond pas à la carte « %s »" % (fichier.name, m["titre"]))
    b = re.search(r"(?s)L&#x27;engagement<span[^>]*>\.</span></span></div><div[^>]*>(.*?)</div>", page)
    if not b:
        sys.exit("%s : bloc « L'engagement. » introuvable" % fichier.name)
    # Un retour à la ligne (<br>) dans un paragraphe est gardé : sans lui, deux phrases se colleraient.
    paras = ["\n".join(re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", ligne))).strip()
                       for ligne in re.split(r"<br\s*/?>", p))
             for p in re.findall(r"(?s)<p[^>]*>(.*?)</p>", b.group(1))]
    texte = "\n\n".join(p for p in paras if p)
    # Double contrôle : le même texte que dans les données de la page, sans le gras **…**
    # (un ** isolé reste : le site l'affiche tel quel, par exemple mesure 03.01).
    donnees_page, dec = rsc(page), json.JSONDecoder()
    valeurs = [dec.raw_decode(donnees_page[m.end():])[0] for m in re.finditer(r'"engagement":(?=")', donnees_page)]
    if normaliser(texte) not in [normaliser(re.sub(r"(?s)\*\*(.+?)\*\*", r"\1", v)) for v in valeurs]:
        sys.exit("%s : « L'engagement » diffère des données de la page, à vérifier à la main" % fichier.name)
    return titre, texte


def main():
    projet = ARCHIVE / "projet.html"
    if "--telecharger" in sys.argv:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        anciens = set(ARCHIVE.glob("*.html"))
        projet.write_bytes(telecharger(SITE + "/projet"))
        d = donnees(projet.read_text(encoding="utf-8"))
        for m in d["mesures"]:
            fichier_mesure(m).write_bytes(telecharger(url_mesure(m)))
            print(m["ref"], m["titre"])
        for f in anciens - {projet} - {fichier_mesure(m) for m in d["mesures"]}:
            f.unlink()
        print("%d pages de mesure archivées" % len(d["mesures"]))
        return

    page = projet.read_text(encoding="utf-8")
    d, blocs = donnees(page), blocs_html(page)
    sources = [{"id": "projet", "titre": "Le projet, thème par thème", "url": SITE + "/projet",
                "consulte_le": CONSULTE_LE, "fichier": "sources/lr/projet.html", "sha256": sha(projet)}]
    mesures, a_venir = [], []
    for t in d["themes"]:
        chapitre = t["nom"] + "."
        if chapitre not in blocs:
            sys.exit("thème « %s » absent de la page du projet" % chapitre)
        liste = [m for m in d["mesures"] if m["theme"] == t["ref"]]
        for m in liste:
            f = fichier_mesure(m)
            titre, texte = engagement(f, m)
            sid = "mesure-" + m["ref"]
            sources.append({"id": sid, "titre": titre, "url": url_mesure(m), "consulte_le": CONSULTE_LE,
                            "fichier": "sources/lr/" + f.name, "sha256": sha(f)})
            mesures.append({"ordre": len(mesures) + 1, "chapitre": chapitre, "repere": "Mesure %d" % int(m["numero"]),
                            "titre": titre, "texte": texte, "source": sid, "page": None})
        print("%-35s | %d mesures" % (chapitre, len(liste)))
    for t in d["themesEnConstruction"]:
        # Sur la page : « Justice. », « À venir », puis la phrase de présentation du thème.
        i = blocs.index(t["nom"] + ".")
        if blocs[i + 1] != "À venir" or blocs[i + 2] != "Le projet · " + t["nom"]:
            sys.exit("thème « %s » : carte « À venir » inattendue, à vérifier à la main" % t["nom"])
        a_venir.append({"chapitre": blocs[i], "texte": blocs[i + 3], "source": "projet"})
        print("%-35s | à venir" % blocs[i])
    if len(mesures) != len(d["mesures"]):
        sys.exit("%d mesures sur le site, %d rattachées à un thème" % (len(d["mesures"]), len(mesures)))

    prog = {
        "_note": "Projet de Bruno Retailleau (Les Républicains), avecretailleau.fr. Toutes les mesures, classées par thème comme sur le site. Produit par agents/extraction/lr_retailleau_2027.py, vérifié par agents/verification/programmes.py.",
        "id": "lr",
        "parti": "Les Républicains",
        "programme": "Le projet de Bruno Retailleau pour 2027 (au %s)" % date.fromisoformat(CONSULTE_LE).strftime("%d/%m/%Y"),
        "structure": "toutes-les-mesures",
        "libelle": None,
        "unite": "thème",
        "regle": "Toutes les mesures publiées sur le site, thème par thème, dans l’ordre du site ; le texte de chacune est le paragraphe « L’engagement » de sa page. Les thèmes « À venir » sont indiqués comme tels.",
        "sources": sources,
        "mesures": mesures,
        "a_venir": a_venir,
    }
    (DOSSIER / "lr.json").write_text(json.dumps(prog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("%d mesures et %d thèmes à venir écrits dans contenu/programmes/lr.json" % (len(mesures), len(a_venir)))


if __name__ == "__main__":
    main()
