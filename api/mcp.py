"""Serveur MCP public de MarIAn : les votes de l'Assemblée et les programmes, en outils pour Claude.

Adresse : https://agenticia-vf.vercel.app/api/mcp (Vercel publie ce fichier comme une fonction).
À ajouter dans claude.ai : Réglages → Connecteurs → Ajouter un connecteur personnalisé (voir docs/mcp.md).

Lecture seule, aucun secret :
  - votes : Supabase, avec la clé publique « anon » du site (js/config.js), qui ne permet que de lire ;
  - programmes : data/programmes.js (programmes vérifiés mot pour mot, voir docs/programmes.md).
Aucune IA ici : le serveur renvoie des faits sourcés, c'est le client (Claude) qui rédige la réponse.
Mêmes règles que le site : jamais de classement ni de note, une source pour chaque information.

Protocole : MCP en « Streamable HTTP » sans session (chaque requête POST est indépendante, réponse JSON).
Sans librairie, comme les agents (Python 3.7 ou plus récent) : on peut le tester sur un ordinateur avec
  python3 api/mcp.py 8001          puis   http://localhost:8001/api/mcp
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
from http.server import BaseHTTPRequestHandler

# Les mêmes que dans js/config.js. La clé « anon » est publique : les règles d'accès de Supabase
# ne lui permettent que de lire (supabase/schema.sql).
SUPABASE_URL = "https://rjpqgdxdomktrysokdnv.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcHFnZHhkb21rdHJ5c29rZG52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTAxNzQsImV4cCI6MjEwOTQ2NjE3NH0.ffkAV5YoOtm3rjpL5QppGVGZ9Xj_A-d8DXHh7-RMSjQ"
SITE = os.environ.get("MARIAN_SITE", "https://agenticia-vf.vercel.app")
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"]   # versions du protocole MCP acceptées, la plus récente d'abord
CACHE_SECONDES = 600
_cache = {}

INSTRUCTIONS = (
    "MarIAn aide les 16-25 ans à suivre la présidentielle 2027 : ce que les candidats ont voté à l'Assemblée nationale "
    "(données officielles, 16e et 17e législatures) et ce que les partis proposent (programmes recopiés mot pour mot). "
    "Règles : cite toujours le lien officiel renvoyé par l'outil ; ne classe pas et ne note pas les candidats ; "
    "quand un candidat ne siégeait pas, dis que c'est le vote de son groupe, pas le sien ; pour un programme, "
    "précise son périmètre : l'absence d'une mesure dans MarIAn ne veut pas dire que le parti ne la propose pas. "
    "Commence par l'outil « references » pour connaître les identifiants des candidats, catégories et partis."
)


# ---------- Données ----------

def _lire_url(url, entetes=None):
    req = urllib.request.Request(url, headers=dict({"User-Agent": "marian-mcp"}, **(entetes or {})))
    with urllib.request.urlopen(req, timeout=20) as rep:
        return rep.read().decode("utf-8")


def _en_cache(cle, charger):
    maintenant = time.time()
    if cle in _cache and maintenant - _cache[cle][0] < CACHE_SECONDES:
        return _cache[cle][1]
    valeur = charger()
    _cache[cle] = (maintenant, valeur)
    return valeur


def _js(texte):
    """« window.MARIAN_X = {...}; » précédé d'un commentaire."""
    return json.loads(texte[texte.index("=") + 1:].strip().rstrip(";"))


def donnees_votes():
    """Grands votes (site_votes) et fiches des candidats (site_donnees), préparés chaque nuit par l'agent de collecte."""
    def charger():
        url = SUPABASE_URL + "/rest/v1/collecte?select=cle,valeur&cle=in.(site_votes,site_donnees)"
        lignes = json.loads(_lire_url(url, {"apikey": SUPABASE_ANON, "Authorization": "Bearer " + SUPABASE_ANON}))
        return {l["cle"]: l["valeur"] for l in lignes}
    return _en_cache("votes", charger)


def donnees_programmes():
    def charger():
        chemin = os.path.join(RACINE, "data", "programmes.js")
        if os.path.exists(chemin):
            with open(chemin, encoding="utf-8") as f:
                return _js(f.read())
        return _js(_lire_url(SITE + "/data/programmes.js"))
    return _en_cache("programmes", charger)


# ---------- Outils communs ----------

class Erreur(Exception):
    """Erreur expliquée à Claude (mauvais identifiant, paramètre manquant…)."""


def simple(texte):
    texte = unicodedata.normalize("NFD", texte or "")
    return "".join(c for c in texte if unicodedata.category(c) != "Mn").lower()


MOTS_VIDES = {"a", "au", "aux", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les", "pour", "sur", "un", "une"}


def correspond(texte, *champs):
    """Vrai si chaque mot de « texte » apparaît dans l'un des champs (sans tenir compte des accents, des majuscules
    ni des petits mots comme « de » ou « la »)."""
    mots = [m for m in re.split(r"\W+", simple(texte)) if m and m not in MOTS_VIDES]
    lieu = " ".join(simple(c) for c in champs if c)
    return all(m in lieu for m in mots)


def par_nom_de_famille(c):
    """Ordre alphabétique des candidats par nom de famille : leurs identifiants en sont formés (attal, le-pen…)."""
    return simple(c["id"])


def par_nom(x):
    return simple(x["nom"])


POSITIONS = {"p": "pour", "c": "contre", "a": "abstention", "n": "non-votant", "aucun": "le groupe n'a pas voté"}
LEGISLATURES = {"16": "16e législature (2022-2024)", "17": "17e législature (depuis 2024)"}


def _loi(v, ident):
    for l in v["site_votes"]["lois"]:
        if l["id"] == ident:
            return l
    raise Erreur("Vote inconnu : %s. Utilise rechercher_votes pour trouver son identifiant (ex. VTANR5L17V3300)." % ident)


def _candidat(v, ident):
    for c in v["site_votes"]["candidats"]:
        if c["id"] == ident:
            return c
    noms = ", ".join("%s (%s)" % (c["id"], c["nom"]) for c in sorted(v["site_votes"]["candidats"], key=par_nom_de_famille))
    raise Erreur("Candidat inconnu : %s. Identifiants possibles : %s." % (ident, noms))


def _categories(v):
    return {c["id"]: c["label"] for c in v["site_votes"]["categories"]}


def resume_loi(v, l):
    return {
        "id": l["id"], "date": l["date"], "titre": l["titre"], "lecture": l.get("lecture"),
        "categorie": _categories(v).get(l["cat"], l["cat"]), "genre": l["genre"],
        "resultat": l["sort"], "pour": l["pour"], "contre": l["contre"], "abstentions": l["abst"],
        "voix_necessaires": l["requis"], "solennel": l["solennel"], "legislature": LEGISLATURES.get(l["leg"], l["leg"]),
        "source": l["url"],
    }


def _siegeait(c, date):
    return any(m["debut"] <= date and (not m["fin"] or date <= m["fin"]) for m in c["mandats"])


def _vote_groupe(c, l):
    g = next((x for x in l["groupes"] if x.get("f") == c["famille"]), None)
    if not g:
        return None
    m = max(g["p"], g["c"], g["a"])
    pos = "aucun" if m == 0 else "p" if g["p"] == m else "c" if g["c"] == m else "a"
    return {"groupe": g["g"], "position": POSITIONS[pos], "cohesion": g.get("coh"), "code": pos}


def vote_candidat(c, l):
    """Même règle que le site (js/app.js, candVote) : son vote s'il siégeait ; sinon celui de son groupe, dit comme tel."""
    gv = _vote_groupe(c, l)
    if _siegeait(c, l["date"]):
        mien = c["votes"].get(l["id"])
        if mien:
            return {"type": "vote personnel", "position": POSITIONS[mien], "code": mien, "groupe": gv and gv["groupe"]}
        return {"type": "vote personnel", "position": "absent (siégeait, n'a pas pris part au vote)", "code": "x",
                "groupe": gv and gv["groupe"], "vote_du_groupe": gv and gv["position"]}
    if gv:
        return {"type": "vote de son groupe (ne siégeait pas ce jour-là)", "position": gv["position"], "code": gv["code"],
                "groupe": gv["groupe"], "cohesion_du_groupe": gv["cohesion"]}
    return {"type": "aucun", "position": "ne siégeait pas, et son groupe n'existait pas lors de ce vote", "code": None}


def filtrer_lois(v, texte=None, categorie=None, legislature=None, resultat=None, depuis=None, jusqu_a=None):
    if categorie and categorie not in _categories(v):
        raise Erreur("Catégorie inconnue : %s. Catégories possibles : %s." % (categorie, ", ".join(sorted(_categories(v)))))
    lois = []
    for l in v["site_votes"]["lois"]:
        if texte and not correspond(texte, l["titre"], _categories(v).get(l["cat"])):
            continue
        if categorie and l["cat"] != categorie:
            continue
        if legislature and l["leg"] != str(legislature):
            continue
        if resultat and simple(l["sort"]) != simple(resultat):
            continue
        if depuis and (l["date"] or "") < depuis:
            continue
        if jusqu_a and (l["date"] or "") > jusqu_a:
            continue
        lois.append(l)
    return lois   # déjà du plus récent au plus ancien


def _limite(valeur, defaut, maximum):
    try:
        return max(1, min(int(valeur if valeur is not None else defaut), maximum))
    except (TypeError, ValueError):
        return defaut


def source_votes(v):
    return {"donnees": "Assemblée nationale, data.assemblee-nationale.fr (Licence Ouverte), via MarIAn",
            "votes_a_jour_au": v["site_donnees"].get("dernierScrutin")}


# ---------- Outils : votes ----------

def references(args):
    v, p = donnees_votes(), donnees_programmes()
    comptes = {}
    for l in v["site_votes"]["lois"]:
        comptes[l["cat"]] = comptes.get(l["cat"], 0) + 1
    return {
        "candidats": [{"id": c["id"], "nom": c["nom"], "parti": c.get("parti"),
                       "a_ete_depute": bool(c["mandats"])} for c in sorted(v["site_votes"]["candidats"], key=par_nom_de_famille)],
        "categories_de_votes": [{"id": c["id"], "nom": c["label"], "grands_votes": comptes.get(c["id"], 0)}
                                for c in v["site_votes"]["categories"]],
        "partis": [{"id": x["id"], "nom": x["nom"], "programme_dans_marian": x["statut"] == "publie", "programme": x.get("programme")}
                   for x in sorted(p["partis"], key=par_nom)],
        "legislatures": LEGISLATURES,
        "grands_votes": "Vote final d'un texte, motion de censure ou déclaration du gouvernement : %d au total." % len(v["site_votes"]["lois"]),
        "source": source_votes(v),
    }


def rechercher_votes(args):
    v = donnees_votes()
    lois = filtrer_lois(v, args.get("texte"), args.get("categorie"), args.get("legislature"), args.get("resultat"),
                        args.get("depuis"), args.get("jusqu_a"))
    n = _limite(args.get("limite"), 10, 30)
    return {"nombre_trouve": len(lois), "affiches": min(n, len(lois)), "votes": [resume_loi(v, l) for l in lois[:n]],
            "source": source_votes(v)}


def detail_vote(args):
    v = donnees_votes()
    l = _loi(v, args.get("id") or "")
    noms = v["site_votes"]["noms"]
    groupes = []
    for g in l["groupes"]:
        m = max(g["p"], g["c"], g["a"])
        pos = "aucun" if m == 0 else "p" if g["p"] == m else "c" if g["c"] == m else "a"
        groupes.append({"groupe": g["g"], "nom": noms.get(g["g"], g["g"]), "membres": g.get("m"), "pour": g["p"], "contre": g["c"],
                        "abstention": g["a"], "position": POSITIONS[pos], "cohesion": g.get("coh")})
    candidats = [dict({"candidat": c["nom"]}, **{k: x for k, x in vote_candidat(c, l).items() if k != "code"})
                 for c in sorted(v["site_votes"]["candidats"], key=par_nom_de_famille)]
    return dict(resume_loi(v, l), groupes_de_gauche_a_droite=groupes, votes_des_candidats=candidats,
                note="Cohésion : part des votants du groupe qui ont suivi sa position (100 = groupe uni). La position d'un groupe est celle de la majorité de ses votants.",
                source_donnees=source_votes(v))


def vote_du_candidat(args):
    v = donnees_votes()
    c = _candidat(v, args.get("candidat") or "")
    if args.get("vote_id"):
        lois = [_loi(v, args["vote_id"])]
    else:
        lois = filtrer_lois(v, args.get("texte"), args.get("categorie"), args.get("legislature"), None, args.get("depuis"), args.get("jusqu_a"))
    n = _limite(args.get("limite"), 15, 40)
    return {
        "candidat": c["nom"], "parti": c.get("parti"),
        "nombre_trouve": len(lois),
        "votes": [dict(resume_loi(v, l), vote={k: x for k, x in vote_candidat(c, l).items() if k != "code"}) for l in lois[:n]],
        "regle": "Son vote personnel quand il siégeait ce jour-là ; sinon le vote de son groupe, indiqué comme tel.",
        "source": source_votes(v),
    }


def bilan_candidat(args):
    v = donnees_votes()
    c = _candidat(v, args.get("candidat") or "")
    fiche = v["site_donnees"]["candidats"].get(c["id"], {})
    comptes = {}
    for l in v["site_votes"]["lois"]:
        r = vote_candidat(c, l)
        if r["type"] == "vote personnel":
            comptes[r["position"]] = comptes.get(r["position"], 0) + 1
    cles = []
    for vc in v["site_donnees"]["votesCles"]:
        perso = (fiche.get("votesCles") or {}).get(vc["id"])
        off = vc.get("officiel") or {}
        cles.append({"vote": vc["title"], "contexte": vc.get("context"), "resume": vc.get("summary"), "date": off.get("date"),
                     "resultat": off.get("sort"), "source": off.get("url") or (vc.get("source") or {}).get("url"),
                     "son_vote": None if not perso else (perso.get("position") if perso.get("siegeait") else "ne siégeait pas"),
                     "groupe": perso and perso.get("groupe")})
    part = fiche.get("participation") or {}
    return {
        "candidat": c["nom"], "parti": c.get("parti"), "depute": bool(fiche.get("depute")),
        "mandats_de_depute": fiche.get("mandats", []),
        "groupes": fiche.get("groupes", []),
        "participation": {
            "scrutins_solennels": part.get("solennels"),
            "mediane_de_l_hemicycle_aux_solennels": v["site_donnees"].get("medianeSolennels"),
            "tous_les_scrutins": part.get("tous"),
            "a_savoir": "Le taux sur tous les scrutins est bas pour tous les députés (des milliers d'amendements) : compare plutôt les scrutins solennels, avec la médiane.",
        } if part else "Pas de mandat de député en 2022-2026 : pas de participation à calculer.",
        "grands_votes_personnels": comptes,
        "votes_cles_choisis_par_marian": cles,
        "source": source_votes(v),
    }


def comparer_candidats(args):
    v = donnees_votes()
    a, b = _candidat(v, args.get("candidat_a") or ""), _candidat(v, args.get("candidat_b") or "")
    if a["id"] == b["id"]:
        raise Erreur("Choisis deux candidats différents.")
    lois = filtrer_lois(v, None, args.get("categorie"), None, None, args.get("depuis"), args.get("jusqu_a"))
    pareil, differents, perso = 0, [], 0
    for l in lois:
        va, vb = vote_candidat(a, l), vote_candidat(b, l)
        if va["code"] not in ("p", "c", "a") or vb["code"] not in ("p", "c", "a"):
            continue
        perso += va["type"] == "vote personnel" and vb["type"] == "vote personnel"
        if va["code"] == vb["code"]:
            pareil += 1
        else:
            differents.append({"vote": l["titre"], "date": l["date"], "id": l["id"], "source": l["url"],
                               a["nom"]: "%s (%s)" % (va["position"], va["type"]), b["nom"]: "%s (%s)" % (vb["position"], vb["type"])})
    total = pareil + len(differents)
    n = _limite(args.get("limite"), 15, 50)
    return {
        "candidats": [a["nom"], b["nom"]],
        "categorie": _categories(v).get(args.get("categorie")) if args.get("categorie") else "toutes",
        "votes_compares": total,
        "dont_deux_votes_personnels": perso,
        "meme_position": pareil,
        "positions_differentes": len(differents),
        "part_de_meme_position": round(100.0 * pareil / total, 1) if total else None,
        "exemples_de_desaccords": differents[:n],
        "regle": ("Grands votes où l'on connaît la position des deux (pour, contre ou abstention). Quand un candidat ne siégeait pas, "
                  "c'est le vote de son groupe qui compte : la comparaison mesure alors aussi celle des groupes. Absences exclues."),
        "source": source_votes(v),
    }


# ---------- Outils : programmes ----------

PERIMETRES = {
    "toutes-les-mesures": "Toutes les mesures publiées par le parti, dans son ordre.",
    "mesures-cles": "Seulement les mesures que le parti met lui-même en avant (« {libelle} ») : ce n'est pas tout le programme.",
    "premiere-par-chapitre": "Pour chaque {unite} du programme, seulement la première mesure présentée par le parti : ce n'est pas tout le programme.",
}
AVERTISSEMENT = "Mesures recopiées mot pour mot. L'absence d'une mesure ici ne veut pas dire que le parti ne la propose pas."


def _parti(p, ident):
    for x in p["partis"]:
        if x["id"] == ident:
            return x
    raise Erreur("Parti inconnu : %s. Identifiants possibles : %s." % (ident, ", ".join(sorted(x["id"] for x in p["partis"]))))


def _perimetre(x):
    return PERIMETRES.get(x.get("structure"), "").format(libelle=x.get("libelle") or "", unite=x.get("unite") or "chapitre")


def _mesure(m, x=None):
    sortie = {"theme": m.get("chapitre"), "repere": m.get("repere"), "titre": m.get("titre"), "texte": m.get("texte"),
              "source": m.get("url"), "page": m.get("page")}
    if x:
        sortie = dict({"parti": x["nom"]}, **sortie)
    return {k: val for k, val in sortie.items() if val is not None}


def _statut(x):
    return {"pas-publie": "Ce parti n'a pas encore publié de programme pour 2027.",
            "en-cours": "Programme en cours d'ajout dans MarIAn.",
            "a-ajouter": "Programme pas encore ajouté dans MarIAn."}.get(x["statut"], "Pas de programme dans MarIAn.")


def mesures_du_parti(args):
    p = donnees_programmes()
    x = _parti(p, args.get("parti") or "")
    if x["statut"] != "publie":
        return {"parti": x["nom"], "programme_dans_marian": False, "statut": _statut(x)}
    mesures = [m for m in x["mesures"]
               if (not args.get("theme") or correspond(args["theme"], m.get("chapitre"), m.get("partie")))
               and (not args.get("texte") or correspond(args["texte"], m.get("titre"), m.get("texte")))]
    n = _limite(args.get("limite"), 30, 150)
    themes = {}
    for m in x["mesures"]:   # dans l'ordre du programme
        themes[m.get("chapitre")] = themes.get(m.get("chapitre"), 0) + 1
    return {
        "parti": x["nom"], "programme": x.get("programme"), "perimetre": _perimetre(x),
        "themes_du_programme": [{"theme": th, "mesures": nb} for th, nb in themes.items()],
        "themes_annonces_sans_mesure": [c.get("chapitre") for c in x.get("a_venir") or []],
        "nombre_trouve": len(mesures), "affichees": min(n, len(mesures)),
        "mesures": [_mesure(m) for m in mesures[:n]],
        "a_savoir": AVERTISSEMENT, "verifie_le": p.get("verifieLe"),
    }


def rechercher_mesures(args):
    p = donnees_programmes()
    texte = (args.get("texte") or "").strip()
    if not texte:
        raise Erreur("Indique un mot ou une expression à chercher (ex. « SMIC », « nucléaire »).")
    partis = [_parti(p, args["parti"])] if args.get("parti") else sorted(p["partis"], key=par_nom)
    trouvees = [(x, m) for x in partis if x["statut"] == "publie" for m in x["mesures"]
                if correspond(texte, m.get("titre"), m.get("texte"), m.get("chapitre"))]
    n = _limite(args.get("limite"), 20, 60)
    return {
        "recherche": texte, "nombre_trouve": len(trouvees), "affichees": min(n, len(trouvees)),
        "mesures": [_mesure(m, x) for x, m in trouvees[:n]],
        "partis_sans_programme_dans_marian": [x["nom"] for x in partis if x["statut"] != "publie"],
        "perimetres": {x["nom"]: _perimetre(x) for x in partis if x["statut"] == "publie"},
        "a_savoir": AVERTISSEMENT, "verifie_le": p.get("verifieLe"),
    }


def comparer_programmes(args):
    p = donnees_programmes()
    texte = (args.get("texte") or "").strip()
    if not texte:
        raise Erreur("Indique le sujet à comparer (ex. « retraites », « logement »).")
    n = _limite(args.get("par_parti"), 5, 15)
    partis = []
    for x in sorted(p["partis"], key=par_nom):
        if x["statut"] != "publie":
            partis.append({"parti": x["nom"], "programme_dans_marian": False, "statut": _statut(x)})
            continue
        mesures = [m for m in x["mesures"] if correspond(texte, m.get("titre"), m.get("texte"), m.get("chapitre"))]
        partis.append({"parti": x["nom"], "programme_dans_marian": True, "perimetre": _perimetre(x),
                       "mesures_trouvees": len(mesures), "mesures": [_mesure(m) for m in mesures[:n]]})
    return {"sujet": texte, "partis_ordre_alphabetique": partis, "a_savoir": AVERTISSEMENT, "verifie_le": p.get("verifieLe")}


# ---------- Description des outils pour Claude ----------

def _schema(proprietes, requis=()):
    return {"type": "object", "properties": proprietes, "required": list(requis), "additionalProperties": False}


TEXTE = {"type": "string", "description": "Mots à chercher dans le titre du texte ou le nom de sa catégorie (sans tenir compte des accents ni des majuscules)."}
DATE_DEPUIS = {"type": "string", "description": "Date de début, AAAA-MM-JJ."}
DATE_JUSQU = {"type": "string", "description": "Date de fin, AAAA-MM-JJ."}
CATEGORIE = {"type": "string", "description": "Identifiant de catégorie (voir references), ex. retraites, logement, securite."}
CANDIDAT = {"type": "string", "description": "Identifiant du candidat (voir references), ex. attal, le-pen, melenchon."}
PARTI = {"type": "string", "description": "Identifiant du parti (voir references), ex. lfi, lr, ps, place-publique."}
LECTURE = {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}

OUTILS = [
    ("references", references, "Références",
     "Liste les identifiants à utiliser dans les autres outils : candidats (et s'ils ont été députés), catégories de grands votes, "
     "partis (et s'ils ont un programme dans MarIAn), législatures. À appeler en premier.", _schema({})),
    ("rechercher_votes", rechercher_votes, "Rechercher des grands votes",
     "Cherche les grands votes de l'Assemblée nationale (vote final d'une loi, motion de censure, déclaration du gouvernement) "
     "depuis 2022, du plus récent au plus ancien. Renvoie le résultat, les voix et le lien officiel de chaque vote.",
     _schema({"texte": TEXTE, "categorie": CATEGORIE,
              "legislature": {"type": "string", "enum": ["16", "17"], "description": "16 : 2022-2024 ; 17 : depuis 2024."},
              "resultat": {"type": "string", "enum": ["adopté", "rejeté"]},
              "depuis": DATE_DEPUIS, "jusqu_a": DATE_JUSQU,
              "limite": {"type": "integer", "minimum": 1, "maximum": 30, "description": "Nombre de votes renvoyés (10 par défaut)."}})),
    ("detail_vote", detail_vote, "Détail d'un vote",
     "Un grand vote en détail : résultat, position et cohésion de chaque groupe politique de gauche à droite de l'hémicycle, "
     "vote de chaque candidat à la présidentielle, lien vers le scrutin officiel.",
     _schema({"id": {"type": "string", "description": "Identifiant officiel du vote, ex. VTANR5L17V3300 (voir rechercher_votes)."}}, ["id"])),
    ("vote_du_candidat", vote_du_candidat, "Vote d'un candidat",
     "Ce qu'un candidat a voté : sur un vote précis (vote_id), ou sur les grands votes d'un sujet (texte, categorie, dates). "
     "S'il ne siégeait pas ce jour-là (pas encore député, ministre…), renvoie le vote de son groupe, indiqué comme tel.",
     _schema({"candidat": CANDIDAT, "vote_id": {"type": "string", "description": "Identifiant d'un vote précis (facultatif)."},
              "texte": TEXTE, "categorie": CATEGORIE, "legislature": {"type": "string", "enum": ["16", "17"]},
              "depuis": DATE_DEPUIS, "jusqu_a": DATE_JUSQU,
              "limite": {"type": "integer", "minimum": 1, "maximum": 40, "description": "Nombre de votes renvoyés (15 par défaut)."}},
             ["candidat"])),
    ("bilan_candidat", bilan_candidat, "Bilan d'un candidat à l'Assemblée",
     "Mandats de député, groupes successifs, participation aux scrutins solennels comparée à la médiane de l'hémicycle, "
     "nombre de grands votes pour / contre / abstention, et son vote sur chacun des votes clés choisis par MarIAn.",
     _schema({"candidat": CANDIDAT}, ["candidat"])),
    ("comparer_candidats", comparer_candidats, "Comparer les votes de deux candidats",
     "Sur les grands votes où l'on connaît la position des deux, combien de fois deux candidats ont voté pareil, "
     "avec des exemples de désaccords et leurs liens officiels. Facultatif : une catégorie, des dates.",
     _schema({"candidat_a": CANDIDAT, "candidat_b": CANDIDAT, "categorie": CATEGORIE, "depuis": DATE_DEPUIS, "jusqu_a": DATE_JUSQU,
              "limite": {"type": "integer", "minimum": 1, "maximum": 50, "description": "Nombre d'exemples de désaccords (15 par défaut)."}},
             ["candidat_a", "candidat_b"])),
    ("mesures_du_parti", mesures_du_parti, "Mesures d'un parti",
     "Les mesures du programme d'un parti, recopiées mot pour mot avec leur lien, filtrables par thème ou par mots. "
     "Indique toujours le périmètre : pour certains partis, MarIAn n'a que les mesures mises en avant ou la première de chaque chapitre.",
     _schema({"parti": PARTI, "theme": {"type": "string", "description": "Mots du thème ou du chapitre, ex. éducation."},
              "texte": {"type": "string", "description": "Mots à chercher dans les mesures."},
              "limite": {"type": "integer", "minimum": 1, "maximum": 150, "description": "Nombre de mesures renvoyées (30 par défaut)."}},
             ["parti"])),
    ("rechercher_mesures", rechercher_mesures, "Rechercher dans les programmes",
     "Cherche un mot ou une expression (ex. SMIC, nucléaire, logement social) dans les mesures de tous les programmes publiés "
     "dans MarIAn, ou d'un seul parti. Renvoie les mesures mot pour mot avec leur lien.",
     _schema({"texte": {"type": "string", "description": "Mots à chercher (sans tenir compte des accents ni des majuscules)."},
              "parti": PARTI,
              "limite": {"type": "integer", "minimum": 1, "maximum": 60, "description": "Nombre de mesures renvoyées (20 par défaut)."}},
             ["texte"])),
    ("comparer_programmes", comparer_programmes, "Comparer les programmes sur un sujet",
     "Sur un sujet, ce que propose chaque parti, dans l'ordre alphabétique : ses mesures mot pour mot, ou le fait que son programme "
     "n'est pas encore dans MarIAn. Ne classe pas les partis.",
     _schema({"texte": {"type": "string", "description": "Sujet à comparer, ex. retraites, logement, nucléaire."},
              "par_parti": {"type": "integer", "minimum": 1, "maximum": 15, "description": "Mesures au plus par parti (5 par défaut)."}},
             ["texte"])),
]
PAR_NOM = {o[0]: o for o in OUTILS}


# ---------- Protocole MCP (JSON-RPC) ----------

def repondre(message):
    """Traite un message JSON-RPC ; renvoie la réponse, ou None pour une notification."""
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Requête JSON-RPC invalide"}}
    ident, methode, params = message.get("id"), message.get("method"), message.get("params") or {}
    if ident is None:
        return None   # notification (notifications/initialized…) : rien à répondre
    if methode == "initialize":
        demandee = params.get("protocolVersion")
        resultat = {"protocolVersion": demandee if demandee in VERSIONS else VERSIONS[0],
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": {"name": "marian", "title": "MarIAn · Présidentielle 2027", "version": "1.0.0"},
                    "instructions": INSTRUCTIONS}
    elif methode == "ping":
        resultat = {}
    elif methode == "tools/list":
        resultat = {"tools": [{"name": nom, "title": titre, "description": desc, "inputSchema": schema, "annotations": LECTURE}
                              for nom, _, titre, desc, schema in OUTILS]}
    elif methode == "tools/call":
        outil = PAR_NOM.get(params.get("name"))
        if not outil:
            return {"jsonrpc": "2.0", "id": ident, "error": {"code": -32602, "message": "Outil inconnu : %s" % params.get("name")}}
        try:
            donnees = outil[1](params.get("arguments") or {})
            resultat = {"content": [{"type": "text", "text": json.dumps(donnees, ensure_ascii=False)}], "isError": False}
        except Erreur as e:
            resultat = {"content": [{"type": "text", "text": str(e)}], "isError": True}
        except Exception as e:   # données injoignables, etc. : l'erreur est dite à Claude au lieu de casser la conversation
            resultat = {"content": [{"type": "text", "text": "Erreur du serveur MarIAn : %s" % e}], "isError": True}
    else:
        return {"jsonrpc": "2.0", "id": ident, "error": {"code": -32601, "message": "Méthode inconnue : %s" % methode}}
    return {"jsonrpc": "2.0", "id": ident, "result": resultat}


class handler(BaseHTTPRequestHandler):
    """Point d'entrée : Vercel appelle cette classe pour chaque requête sur /api/mcp."""

    def _envoyer(self, code, corps=None, type_="application/json"):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        if corps is not None:
            donnees = corps.encode("utf-8")
            self.send_header("Content-Type", type_ + "; charset=utf-8")
            self.send_header("Content-Length", str(len(donnees)))
            self.end_headers()
            self.wfile.write(donnees)
        else:
            self.end_headers()

    def do_OPTIONS(self):
        self._envoyer(204)

    def do_GET(self):
        # Pas de flux d'événements (serveur sans session) : le protocole prévoit 405 ici.
        self._envoyer(405, "Serveur MCP de MarIAn : envoyer des requêtes JSON-RPC en POST (voir docs/mcp.md).", "text/plain")

    def do_POST(self):
        try:
            longueur = int(self.headers.get("Content-Length") or 0)
            message = json.loads(self.rfile.read(longueur).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._envoyer(400, json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "JSON illisible"}}))
            return
        if isinstance(message, list):
            reponses = [r for r in (repondre(m) for m in message) if r is not None]
            corps = json.dumps(reponses, ensure_ascii=False) if reponses else None
        else:
            r = repondre(message)
            corps = json.dumps(r, ensure_ascii=False) if r is not None else None
        if corps is None:
            self._envoyer(202)   # que des notifications
        else:
            self._envoyer(200, corps)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    # Essai local : python3 api/mcp.py 8001
    from http.server import HTTPServer
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    print("Serveur MCP de MarIAn : http://localhost:%d/api/mcp" % port)
    HTTPServer(("127.0.0.1", port), handler).serve_forever()
