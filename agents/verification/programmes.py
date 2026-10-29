"""Agent de vérification des programmes (voir docs/programmes.md).

Pas d'IA : du code. Pour chaque parti de contenu/programmes/partis.json, contrôle
l'empreinte de chaque source archivée et retrouve chaque texte (chapitre, titre,
mesure) au mot près dans la source. Écrit data/programmes.js avec uniquement les
partis dont tout est retrouvé.

    python agents/verification/programmes.py           # vérifie et écrit data/programmes.js
    python agents/verification/programmes.py --verifier # vérifie sans rien écrire
"""

import hashlib
import html
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
STRUCTURES = {"mesures-cles", "premiere-par-chapitre", "pas-publie"}

# Seules différences tolérées entre la source et le texte recopié (docs/programmes.md).
EQUIVALENCES = {
    "’": "'", "‘": "'", "ʼ": "'",
    "“": '"', "”": '"',
    " ": " ", " ": " ", " ": " ",
    "­": "",
}
BLOCS = r"p|div|li|ul|ol|br|h[1-6]|tr|td|th|section|article|header|footer|blockquote|figcaption"


def normaliser(texte):
    texte = unicodedata.normalize("NFC", texte)
    for a, b in EQUIVALENCES.items():
        texte = texte.replace(a, b)
    return re.sub(r"\s+", " ", texte).strip()


def blocs_html(brut):
    """Les blocs de texte de la page (titres, paragraphes, puces), dans l'ordre."""
    brut = re.sub(r"(?is)<(script|style|noscript|svg|template)\b.*?</\1>", " ", brut)
    brut = re.sub(r"(?is)<!--.*?-->", " ", brut)
    brut = re.sub(r"(?i)</?(?:%s)\b[^>]*>" % BLOCS, "\n", brut)
    brut = re.sub(r"<[^>]+>", "", brut)
    return [b for b in (normaliser(x) for x in html.unescape(brut).split("\n")) if b]


class Source:
    """Une source archivée. Page HTML : on connaît ses blocs. PDF (ou son texte, pages séparées par
    un saut de page) : on connaît ses pages."""

    def __init__(self, chemin):
        suffixe = chemin.suffix.lower()
        self.blocs = self.pages = None
        if suffixe == ".pdf":
            import pymupdf  # pip install pymupdf : seule dépendance, pour les programmes en PDF
            with pymupdf.open(chemin) as doc:
                self.pages = [normaliser(p.get_text()) for p in doc]
            return
        brut = chemin.read_text(encoding="utf-8")
        if suffixe in (".html", ".htm"):
            self.blocs = blocs_html(brut)
        else:
            self.pages = [normaliser(p) for p in brut.split("\f")]

    def contient(self, valeur, page=None):
        """HTML : la valeur doit être un bloc entier, ou plusieurs blocs qui se suivent (pas de coupe).
        PDF : la valeur doit se trouver telle quelle à la page indiquée."""
        v = normaliser(valeur)
        if self.blocs is None:
            return v in (self.pages[page - 1] if page else " ".join(self.pages))
        for i in range(len(self.blocs)):
            texte = ""
            for b in self.blocs[i:i + 30]:
                texte = (texte + " " + b).strip()
                if texte == v:
                    return True
                if len(texte) > len(v) or not v.startswith(texte):
                    break
        return False


def verifier_parti(dossier, prog):
    """Renvoie la liste des erreurs (vide si tout est retrouvé)."""
    erreurs = []
    structure = prog.get("structure")
    if structure not in STRUCTURES:
        return ["'structure' doit valoir " + ", ".join(sorted(STRUCTURES))]
    if structure == "pas-publie":
        return []
    if structure == "mesures-cles" and not prog.get("libelle"):
        erreurs.append("'libelle' manquant : l'intitulé employé par le parti (ex. « Mesures clés »)")
    if structure == "premiere-par-chapitre" and not prog.get("regle"):
        erreurs.append("'regle' manquante : ce qui compte comme une mesure dans ce programme")

    sources = {}
    for s in prog.get("sources", []):
        for champ in ("id", "titre", "url", "consulte_le", "fichier", "sha256"):
            if not s.get(champ):
                erreurs.append("source %s : '%s' manquant" % (s.get("id", "?"), champ))
        chemin = dossier / s.get("fichier", "")
        if not s.get("fichier") or not chemin.is_file():
            erreurs.append("source %s : fichier archivé introuvable (%s)" % (s.get("id", "?"), chemin))
            continue
        empreinte = hashlib.sha256(chemin.read_bytes()).hexdigest()
        if empreinte != s.get("sha256"):
            erreurs.append("source %s : l'empreinte ne correspond pas (fichier modifié ?), attendu %s, trouvé %s"
                           % (s["id"], s.get("sha256"), empreinte))
            continue
        sources[s["id"]] = Source(chemin)

    mesures = prog.get("mesures", [])
    if not mesures:
        erreurs.append("aucune mesure")
    for i, m in enumerate(mesures, 1):
        nom = "mesure %s" % m.get("ordre", i)
        if m.get("ordre") != i:
            erreurs.append("%s : 'ordre' doit suivre 1, 2, 3…" % nom)
        if not m.get("texte"):
            erreurs.append("%s : 'texte' vide" % nom)
            continue
        src = sources.get(m.get("source"))
        if src is None:
            if m.get("source") not in [s.get("id") for s in prog.get("sources", [])]:
                erreurs.append("%s : source '%s' inconnue" % (nom, m.get("source")))
            continue
        page = m.get("page")
        if src.pages is None and page is not None:
            erreurs.append("%s : 'page' donnée pour une page web" % nom)
            continue
        if src.pages is not None and page is not None and not 1 <= page <= len(src.pages):
            erreurs.append("%s : page %s hors du document (%s pages)" % (nom, page, len(src.pages)))
            continue

        def absent(champ, valeur):
            erreurs.append("%s : %s introuvable tel quel dans la source%s : « %s »"
                           % (nom, champ, " (page %s)" % page if page else "", valeur[:80]))

        # Partie et chapitre : leur titre est souvent sur une autre page que la mesure (sommaire, page du thème),
        # on le cherche dans toutes les sources archivées du parti.
        # Un titre en plusieurs morceaux (titre et sous-titre) est une liste : chaque morceau est vérifié.
        for champ in ("partie", "chapitre"):
            valeur = m.get(champ)
            for morceau in (valeur if isinstance(valeur, list) else [valeur] if valeur else []):
                if not any(s.contient(morceau) for s in sources.values()):
                    erreurs.append("%s : %s introuvable tel quel dans la source : « %s »" % (nom, champ, morceau[:80]))
        titre, texte = m.get("titre"), m["texte"]
        if titre and src.blocs is not None:
            # Le titre en gras peut ouvrir le même paragraphe que le texte, ou former son propre bloc.
            if not (src.contient(titre + " " + texte) or (src.contient(titre) and src.contient(texte))):
                absent("titre + texte", titre + " " + texte)
        else:
            if titre and not src.contient(titre, page):
                absent("titre", titre)
            if not src.contient(texte, page):
                absent("texte", texte)
    return erreurs


def publier(prog):
    """Ce que l'application reçoit : rien d'autre que le texte vérifié et ses sources."""
    sources = {s["id"]: s for s in prog.get("sources", [])}
    return {
        "structure": prog["structure"],
        "programme": prog.get("programme"),
        "libelle": prog.get("libelle"),
        "regle": prog.get("regle"),
        "unite": prog.get("unite"),
        "sources": [{k: s[k] for k in ("id", "titre", "url", "consulte_le")} for s in prog.get("sources", [])],
        "mesures": [{
            "ordre": m["ordre"],
            "partie": m.get("partie"),
            "chapitre": " ".join(m["chapitre"]) if isinstance(m.get("chapitre"), list) else m.get("chapitre"),
            "repere": m.get("repere"),
            "titre": m.get("titre"),
            "texte": m["texte"],
            "page": m.get("page"),
            "url": m.get("url") or sources[m["source"]]["url"] + ("#page=%d" % m["page"] if m.get("page") else ""),
            "source": m["source"],
        } for m in prog.get("mesures", [])],
    }


def main(racine=RACINE, ecrire=True):
    dossier = racine / "contenu" / "programmes"
    index = json.loads((dossier / "partis.json").read_text(encoding="utf-8"))
    sortie, echecs = [], 0
    for p in index["partis"]:
        entree = {"id": p["id"], "nom": p["nom"], "statut": "a-ajouter"}
        if p.get("fichier"):
            prog = json.loads((dossier / p["fichier"]).read_text(encoding="utf-8"))
            if prog.get("structure") is None and not prog.get("mesures"):
                entree["statut"] = "en-cours"
                print("%s : en cours de collecte" % p["nom"])
            else:
                erreurs = verifier_parti(dossier, prog)
                if erreurs:
                    echecs += 1
                    entree["statut"] = "en-cours"
                    print("%s : REJETÉ, rien n'est publié" % p["nom"])
                    for e in erreurs:
                        print("  - " + e)
                else:
                    entree.update(publier(prog))
                    entree["statut"] = "pas-publie" if prog["structure"] == "pas-publie" else "publie"
                    print("%s : %s mesure(s) retrouvée(s) au mot près" % (p["nom"], len(entree.get("mesures", []))))
        sortie.append(entree)

    if ecrire:
        js = ("// Fichier produit par agents/verification/programmes.py : ne pas modifier à la main.\n"
              "window.MARIAN_PROGRAMMES = " +
              json.dumps({"verifieLe": date.today().isoformat(), "partis": sortie}, ensure_ascii=False, indent=1) + ";\n")
        (racine / "data" / "programmes.js").write_text(js, encoding="utf-8")
    return echecs


if __name__ == "__main__":
    sys.exit(1 if main(ecrire="--verifier" not in sys.argv) else 0)
