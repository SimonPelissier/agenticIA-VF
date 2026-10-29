"""Tests de l'agent de vérification, sur un faux programme (rien de réel n'est publié).

    python -m unittest agents/verification/test_programmes.py
"""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import programmes as P

SOURCE = """<html><body><script>var x = "Mesure piège";</script>
<h2>Chapitre&nbsp;1 : Le logement</h2>
<ul><li><strong>Bloquer</strong> les loyers dans les villes où l’on manque de logements.</li>
<li>Construire 200 000 logements par an.</li></ul>
<h2>Chapitre 2 : Le travail</h2><p>Porter le salaire minimum à 1 600 € net.</p>
</body></html>"""


def mesure(ordre, chapitre, texte, **autres):
    return dict(ordre=ordre, chapitre=chapitre, titre=None, texte=texte, source="s1", **autres)


class Verification(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.racine = Path(self.tmp.name)
        self.dossier = self.racine / "contenu" / "programmes"
        (self.dossier / "sources").mkdir(parents=True)
        (self.racine / "data").mkdir()
        src = self.dossier / "sources" / "test.html"
        src.write_text(SOURCE, encoding="utf-8")
        self.prog = {
            "structure": "premiere-par-chapitre", "libelle": None,
            "regle": "Une puce ou un paragraphe = une mesure.",
            "sources": [{"id": "s1", "titre": "Test", "url": "https://exemple.fr", "consulte_le": "2026-10-29",
                         "fichier": "sources/test.html", "sha256": hashlib.sha256(src.read_bytes()).hexdigest()}],
            "mesures": [
                # Apostrophe droite et espace normale : tolérées.
                mesure(1, "Chapitre 1 : Le logement", "Bloquer les loyers dans les villes où l'on manque de logements."),
                mesure(2, "Chapitre 2 : Le travail", "Porter le salaire minimum à 1 600 € net."),
            ],
        }

    def tearDown(self):
        self.tmp.cleanup()

    def erreurs(self):
        return P.verifier_parti(self.dossier, self.prog)

    def test_texte_exact_accepte(self):
        self.assertEqual(self.erreurs(), [])

    def test_paraphrase_rejetee(self):
        self.prog["mesures"][1]["texte"] = "Porter le SMIC à 1 600 € net."
        self.assertTrue(any("introuvable" in e for e in self.erreurs()))

    def test_mot_ajoute_rejete(self):
        self.prog["mesures"][1]["texte"] = "Porter le salaire minimum à 1 600 € net immédiatement."
        self.assertTrue(self.erreurs())

    def test_mesure_coupee_rejetee(self):
        self.prog["mesures"][1]["texte"] = "Porter le salaire minimum"
        self.assertTrue(self.erreurs())

    def test_titre_en_gras_dans_le_paragraphe(self):
        self.prog["mesures"][0]["titre"] = "Bloquer"
        self.prog["mesures"][0]["texte"] = "les loyers dans les villes où l’on manque de logements."
        self.assertEqual(self.erreurs(), [])

    def test_deux_puces_qui_se_suivent_acceptees(self):
        self.prog["mesures"][0]["texte"] = ("Bloquer les loyers dans les villes où l’on manque de logements. "
                                            "Construire 200 000 logements par an.")
        self.assertEqual(self.erreurs(), [])

    def test_texte_dans_un_script_ignore(self):
        self.prog["mesures"][0]["texte"] = "Mesure piège"
        self.assertTrue(self.erreurs())

    def test_source_modifiee_rejetee(self):
        (self.dossier / "sources" / "test.html").write_text(SOURCE + " ", encoding="utf-8")
        self.assertTrue(any("empreinte" in e for e in self.erreurs()))

    def test_ordre_obligatoire(self):
        self.prog["mesures"][1]["ordre"] = 3
        self.assertTrue(any("ordre" in e for e in self.erreurs()))

    def test_rien_publie_si_rejete(self):
        self.prog["mesures"][1]["texte"] = "Texte inventé."
        (self.dossier / "x.json").write_text(json.dumps(self.prog), encoding="utf-8")
        (self.dossier / "partis.json").write_text(json.dumps(
            {"partis": [{"id": "x", "nom": "Parti X", "fichier": "x.json"}]}), encoding="utf-8")
        self.assertEqual(P.main(self.racine), 1)
        js = (self.racine / "data" / "programmes.js").read_text(encoding="utf-8")
        self.assertNotIn("Texte inventé", js)
        self.assertNotIn("Porter le salaire", js)


if __name__ == "__main__":
    unittest.main()
