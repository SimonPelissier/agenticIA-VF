# Programmes : règles

Section « Programmes » de l'application : pour chaque parti, quelques mesures de son programme, **reproduites au mot près**. Elle est séparée des candidats, des sujets et des votes : pas de « Tient parole ? », pas de comparaison, pas de classement par sujet.

## Quelles mesures on affiche

Ce n'est jamais l'équipe qui choisit. Une seule règle par parti, écrite dans son fichier et affichée sur le site :

| `structure` | Quand | Ce qu'on affiche |
| --- | --- | --- |
| `mesures-cles` | Le parti met lui-même en avant certaines mesures | Ces mesures, dans l'ordre du parti, sous l'intitulé qu'il emploie (`libelle`, ex. « Mesure-clé ») |
| `premiere-par-chapitre` | Le parti ne met rien en avant | Pour chaque division du programme (`unite` : chapitre, chantier…), la mesure qu'il présente en premier. Le site dit que c'est l'ordre du parti, pas un choix de MarIAn |
| `pas-publie` | Pas encore de programme | « Programme pas encore publié » |

Pour `premiere-par-chapitre`, le champ `regle` précise ce qui compte comme « une mesure » (une puce de la liste « Nous voulons : »…), pour qu'on puisse refaire la sélection et retomber sur la même chose.

## Affichage

On choisit un parti, puis on ouvre un chapitre : il liste les titres (sous-partie, chantier). Un titre ouvre une fenêtre avec la mesure en entier, son chapitre, le lien vers la source et, pour `premiere-par-chapitre`, le rappel que c'est la première mesure présentée par le parti.

## Champs d'une mesure

| Champ | Contenu | Recopié tel quel ? |
| --- | --- | --- |
| `partie` | Grande partie du programme (facultatif) | Oui |
| `chapitre` | Titre du chapitre. Une liste quand titre et sous-titre sont séparés dans la source : chaque morceau est vérifié, l'écran les met bout à bout | Oui |
| `repere` | Repère de navigation (« Chantier 12 »), tiré de la numérotation du parti | Non, c'est un repère |
| `titre` | Titre de la sous-partie ou du chantier | Oui |
| `texte` | La mesure | Oui |
| `page` | Page du PDF | — |

## Aucune reformulation

- Pas de résumé, pas de coupe, pas de « … ».
- Seules différences tolérées par la vérification : apostrophes et guillemets droits ou courbes, espaces insécables, retours à la ligne. Rien d'autre.
- Page web : chaque texte doit correspondre à un bloc entier de la page (titre, paragraphe, puce), ou à plusieurs blocs qui se suivent. Une mesure coupée en route est rejetée.
- PDF : le texte doit se trouver tel quel à la page indiquée ; la partie et le chapitre, n'importe où dans le document. La vérification ne détecte pas une coupe : c'est le script d'extraction qui prend la puce entière, à relire.

## Circuit

1. **Archiver la source** dans `contenu/programmes/sources/<parti>/` (pages HTML ou PDF), avec son adresse, sa date de consultation et son empreinte SHA-256.
2. **Extraire** avec un script propre au programme, sans IA (`agents/extraction/`) : il lit la mise en forme de la source et recopie les textes.
3. **Vérifier** : `python agents/verification/programmes.py` (les PDF demandent `pip install pymupdf`). Le script contrôle l'empreinte de chaque source et retrouve chaque texte, au mot près, dans la source archivée. Il écrit `data/programmes.js`, lu par l'application, avec **uniquement les partis dont toutes les mesures sont retrouvées**.
4. **Relire** : pull request, relue par un humain avant fusion.

Ne jamais modifier `data/programmes.js` à la main.

## Programmes en place

| Parti | Source | Règle | Mesures |
| --- | --- | --- | --- |
| La France insoumise | Programme de l'Union populaire, européennes 2024 (site) | `mesures-cles` : le bloc « Mesure-clé » de chaque sous-partie | 51 |
| Place publique | « Acte un », PDF | `premiere-par-chapitre` : première puce « Nous voulons : » de chaque chantier. Le « chantier cadre » (financement) n'a pas de telle liste et n'est pas repris | 42 |
| Parti socialiste | « Vivre libres », projet-socialiste.fr (avril 2026) | `premiere-par-chapitre` : première puce « Propositions » de chaque sous-partie. La page contient 5 chapitres ; l'index du site était injoignable le 29 octobre 2026 pour vérifier s'il en existe d'autres | 18 |
| Les Républicains | Projet de Bruno Retailleau, avecretailleau.fr (une page par thème, une page par mesure) | `premiere-par-chapitre` : première mesure de chaque thème publié, texte du bloc « L'engagement. ». Thèmes « À venir » non repris | 11 |

Pas encore ajoutés (29 octobre 2026) :

- **Les Écologistes** : « Pour une prospérité écologique » (PDF, 13 juillet 2026). Le site refuse les téléchargements automatiques : enregistrer le PDF depuis le navigateur (voir `contenu/programmes/ecologistes.json`).
- **Horizons, PCF, Renaissance** : propositions annoncées dans la presse, mais pas de programme complet trouvé sur un site officiel du parti ou du candidat.
- **RN** : pas de programme 2027 publié, seulement un contre-budget.

## Ajouter un parti

1. L'ajouter dans `contenu/programmes/partis.json` (ordre alphabétique géré par l'application).
2. Archiver la source, écrire son script d'extraction sur le modèle des deux existants.
3. Suivre le circuit ci-dessus.

## Points ouverts

- Ni l'un ni l'autre n'est un programme présidentiel 2027 : à remplacer quand ils seront publiés.
- Droit de citation : reproduire des listes de mesures va au-delà d'une citation courte. À faire valider avec les autres points juridiques du cadrage.
- Équité : avant de fusionner dans `main`, décider avec le groupe si la section peut être publiée avec seulement quelques partis remplis.
