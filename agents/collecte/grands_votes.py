"""Grands votes de l'Assemblée, pour la page « Qui a voté quoi ? ».

Appelé par collecte.py. À partir des scrutins collectés, garde les votes qui comptent :
le vote sur l'ensemble d'un texte, les motions de censure et les déclarations du gouvernement
(pas les milliers d'amendements). Chaque vote est classé dans une catégorie par des règles
de mots-clés sur son titre, publiques et vérifiables. Écrit data/votes.js.
"""

import json
import os
import re

# Ordre des groupes dans l'hémicycle, de gauche à droite (vu de la présidence).
# 17e législature : déduit des numéros de siège des votes officiels (médiane des places de chaque groupe).
# 16e législature : les archives ne donnent pas les sièges ; ordre de l'époque, à vérifier.
ORDRE = {
    "17": ["LFI-NFP", "GDR", "ECOS", "LIOT", "SOC", "NI", "DEM", "EPR", "HOR", "DR", "AD", "UDDPLR", "UDR", "RN"],
    "16": ["LFI-NUPES", "GDR-NUPES", "ECOLO", "SOC", "SOC-A", "LIOT", "NI", "RE", "DEM", "HOR", "LR", "RN"],
}

# Catégories : la première règle qui correspond au titre l'emporte (l'ordre compte).
# Un vote sans règle correspondante va dans « Autres ». Pour corriger un classement, modifier ces règles.
CATEGORIES = [
    ("institutions", "Institutions", r"motion de censure|constitution|électora|élection|mandat|collectivités|outre-mer|statut de l'élu|parlement|candidat|campagne électorale|congrès|nouvelle-calédonie|corse|territori|gouvernance|décentralis|commune|maire|référendum|scrutin|mayotte|guadeloupe|martinique|guyane|réunion|polynésie"),
    ("retraites", "Retraites", r"retrait[eé]|pension"),
    ("immigration", "Immigration", r"immigration|asile|étranger|nationalité|titres? de séjour|rétention|expulsion"),
    ("securite", "Sécurité et justice", r"légitime défense|forces de l'ordre|(?<!sociale )sécurité(?! sociale)|justice|pénal|police|gendarm|terroris|narcotrafic|délinquan|prison|criminalit|violence|sûreté|ordre public|victime|fraude|juridiction|tribunal|avoirs saisis|confisqu|magistra"),
    ("logement", "Logement", r"logement|locatif|location|habitat|loyer|copropriét|urbanisme|bâtiment|hébergement"),
    ("sante", "Santé et social", r"sécurité sociale|santé|soins|médic|fin de vie|aide à mourir|hôpita|handicap|autonomie|solidarit|pauvreté|dépendance|soignant|pharma|maladie|allocation|famill|aidants|cancer|psychiatr|médecin|infirmi|santé mentale"),
    ("economie", "Économie et budget", r"fin de gestion|finances|budget|fiscal|impôt|taxe|économi|entreprise|pouvoir d'achat|dette|comptes|banque|commerci|consommat|créance|succession|indivision|titre-restaurant|patrimoine immobilier de l'état|industri|nationalisation|prix|carburant|assurance"),
    ("travail", "Travail et emploi", r"travail|emploi|chômage|salari|apprenti|formation professionnelle|professionnalisation"),
    ("climat", "Climat, énergie, agriculture", r"agric|énergi|électri|climat|environnement|\beau\b|eaux|nucléaire|biodiversit|forêt|pêche|pesticide|transport|mobilit|montagne|rural|animal|animaux|alimentation|littoral|déchet|plastique"),
    ("ecole", "École et jeunesse", r"école|éducation|enseignement|élève|universit|jeunesse|étudiant|mineur|enfan|scolaire"),
    ("numerique", "Numérique", r"numérique|internet|données|réseaux sociaux|intelligence artificielle|cyber|plateforme|écrans"),
    ("societe", "Société et droits", r"conjugal|homosexualit|égalité|discrimination|femmes|mariage|laïcit|religi|ivg|interruption volontaire|avortement|genre|racis|antisémit|réparation des personnes"),
    ("culture", "Culture, sport, médias", r"sport|cultur|patrimoine|médias|presse|éditeur|audiovisuel|cinéma|langue|musée|mémoire|code noir|olympi"),
    ("international", "Europe, défense, international", r"défense|militaire|armée|ukraine|accord|traité|convention|europ|international|coopération|programmation militaire"),
]

LECTURES = r"texte de la commission mixte paritaire|première lecture|deuxième lecture|nouvelle lecture|lecture définitive"


def genre_du_vote(titre):
    if re.match(r"l[’']ensemble", titre):
        return "loi"
    if "motion de censure" in titre:
        return "censure"
    if titre.startswith("la déclaration du Gouvernement"):
        return "declaration"
    return None


def titre_court(titre, genre):
    if genre == "censure":
        return "Motion de censure" + (" (après un 49.3)" if "alinéa 3" in titre else "")
    t = re.sub(r"^l[’']ensemble (du|de la|des) ", "", titre.strip())
    t = re.sub(r"\s*\((?:%s)[^)]*\)\.?$" % LECTURES, "", t)
    t = re.sub(r"\.$", "", t)
    return t[0].upper() + t[1:] if t else t


def lecture(titre):
    m = re.search(r"\((%s)" % LECTURES, titre)
    return m.group(1).replace("texte de la commission mixte paritaire", "texte final (CMP)") if m else None


def categorie(titre):
    bas = titre.lower()
    for ident, _, motif in CATEGORIES:
        if re.search(motif, bas):
            return ident
    return "autres"


def construire(tous_scrutins, groupes, candidats, votes_candidats, mandats_candidats, familles, sortie):
    """Écrit le fichier data/votes.js lu par la page « Qui a voté quoi ? »."""
    lois = []
    for leg, scrutins in tous_scrutins.items():
        ordre = ORDRE.get(leg, [])
        for s in scrutins:
            titre = (s["titre"] or "").strip()
            genre = genre_du_vote(titre)
            if not genre:
                continue
            gs = sorted(s["groupes"], key=lambda g: ordre.index(g["groupe"]) if g["groupe"] in ordre else len(ordre))
            lois.append({
                "id": s["uid"], "leg": leg, "date": s["date"], "titre": titre_court(titre, genre), "lecture": lecture(titre),
                "genre": genre, "cat": categorie(titre), "sort": s["sort"], "pour": s["pour"], "contre": s["contre"],
                "abst": s["abstentions"], "requis": s["requis"], "url": s["url"], "solennel": s["solennel"],
                "groupes": [{"g": g["groupe"], "f": familles.get(g["groupe"]), "m": g["membres"], "p": g["pour"],
                             "c": g["contre"], "a": g["abstentions"], "coh": g["cohesion"]} for g in gs],
            })
    lois.sort(key=lambda x: (x["date"] or "", x["id"]), reverse=True)

    uids = {x["id"] for x in lois}
    code = {"pour": "p", "contre": "c", "abstention": "a", "non-votant": "n"}
    sortie_candidats = []
    for c in candidats:
        sortie_candidats.append({
            "id": c["id"], "nom": c["nom"], "parti": c.get("parti"), "famille": c.get("famille"),
            "mandats": [{"debut": m["debut"], "fin": m["fin"]} for m in mandats_candidats.get(c["id"], [])],
            "votes": {v["scrutin"]: code[v["position"]] for v in votes_candidats.get(c.get("acteur"), []) if v["scrutin"] in uids},
        })

    donnees = {
        "lois": lois,
        "categories": [{"id": c, "label": l} for c, l, _ in CATEGORIES] + [{"id": "autres", "label": "Autres"}],
        "noms": {g["abrege"]: g["nom"] for g in groupes.values() if g.get("abrege")},
        "ordre": ORDRE,
        "candidats": sortie_candidats,
    }
    compact = lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    with open(sortie, "w", encoding="utf-8") as f:
        f.write("// Fichier produit par agents/collecte/collecte.py : ne pas modifier à la main.\n")
        f.write("window.MARIAN_VOTES = {\n")
        # Un grand vote par ligne : la pull request de chaque nuit montre clairement ce qui change.
        f.write('"lois": [\n' + ",\n".join(compact(x) for x in donnees.pop("lois")) + "\n],\n")
        f.write(",\n".join(compact(k) + ": " + compact(v) for k, v in sorted(donnees.items())))
        f.write("\n};\n")
    return len(lois)
