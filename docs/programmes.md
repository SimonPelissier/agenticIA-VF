# Programmes 2027 : règles

Section « Programmes » de l'application : pour chaque parti, quelques mesures de son programme, **reproduites au mot près**. Elle est séparée des candidats, des sujets et des votes : pas de « Tient parole ? », pas de comparaison.

## Quelles mesures on affiche

Ce n'est jamais l'équipe qui choisit. Une seule règle par parti, écrite dans son fichier et affichée sur le site :

| `structure` | Quand | Ce qu'on affiche |
| --- | --- | --- |
| `mesures-cles` | Le parti publie lui-même une liste de mesures prioritaires | Cette liste, dans l'ordre du parti, sous l'intitulé qu'il emploie (`libelle`) |
| `premiere-par-chapitre` | Pas de liste prioritaire | La première mesure de chaque chapitre, dans l'ordre du programme. Le site le dit en toutes lettres |
| `pas-publie` | Pas encore de programme | « Programme pas encore publié » |

Pour `premiere-par-chapitre`, le champ `regle` précise ce qui compte comme « une mesure » dans ce programme (une puce, un paragraphe numéroté…), pour qu'on puisse refaire la sélection et retomber sur la même chose.

## Aucune reformulation

- `chapitre`, `titre` et `texte` sont copiés tels quels depuis la source. Pas de résumé, pas de coupe, pas de « … ».
- Seules différences tolérées par la vérification : apostrophes et guillemets droits ou courbes, espaces insécables, retours à la ligne. Rien d'autre.
- Page web : chaque texte doit correspondre à un bloc entier de la page (titre, paragraphe, puce), ou à plusieurs blocs qui se suivent. Une mesure coupée en route est rejetée. Un titre en gras au début du paragraphe peut être séparé dans `titre`.
- Texte de PDF : la vérification retrouve le texte à la page indiquée, mais ne peut pas détecter une coupe. Relire ce point à la main.
- Le classement par sujet (Logement, Travail…) n'est pas fait ici.

## Circuit

1. **Archiver la source** dans `contenu/programmes/sources/<parti>/` : la page HTML enregistrée depuis le navigateur, ou le texte d'un PDF (avec son numéro de page dans chaque mesure). Noter dans le fichier du parti l'adresse, la date de consultation et l'empreinte SHA-256 du fichier archivé.
2. **Recopier les mesures** dans `contenu/programmes/<parti>.json`.
3. **Vérifier** : `python agents/verification/programmes.py`. Le script contrôle l'empreinte de chaque source et retrouve chaque texte, au mot près, dans la source archivée. Il écrit `data/programmes.js`, lu par l'application, avec **uniquement les partis dont toutes les mesures sont retrouvées**.
4. **Relire** : pull request, relue par un humain avant fusion.

Ne jamais modifier `data/programmes.js` à la main.

## Ajouter un parti

1. L'ajouter dans `contenu/programmes/partis.json` (ordre alphabétique géré par l'application).
2. Créer `contenu/programmes/<id>.json` sur le modèle de `lfi.json`.
3. Suivre le circuit ci-dessus.

## Points ouverts

- Droit de citation : reproduire une liste entière de mesures va au-delà d'une citation courte. À faire valider avec les autres points juridiques du cadrage.
- Équité : avant de fusionner dans `main`, décider avec le groupe si la section peut être publiée avec un seul parti rempli.
