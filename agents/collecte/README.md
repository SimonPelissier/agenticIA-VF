# Agent de collecte

Premier agent du circuit de marIAn (voir `docs/cadrage.md`, « Parcours agentiques »). Il récupère les **actes** des candidats à l'Assemblée nationale : chaque scrutin public des 16e et 17e législatures, la position de chaque groupe et les votes personnels des candidats qui ont siégé.

Pas d'IA, pas de clé, pas de librairie à installer : Python seul.

## Quand il tourne

- **Chaque nuit** sur GitHub Actions (`.github/workflows/collecte.yml`), à 4 h 30 UTC.
- **À la demande** : onglet *Actions* du dépôt → *Agent de collecte* → *Run workflow*.

S'il y a du nouveau, il ouvre une pull request « Collecte du … ». **Un humain la relit avant de la fusionner** : c'est la relecture prévue par le cadrage. Sinon, il ne fait rien.

## Ce qu'il lit

| Archive | Contenu |
| --- | --- |
| Scrutins de la 16e législature | 2022-2024, environ 4 100 scrutins |
| Scrutins de la 17e législature | depuis 2024, mis à jour chaque jour |
| Acteurs, mandats et organes (historique) | les députés, leurs mandats et leurs groupes, 16e comprise |

Source : [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr), sous Licence Ouverte (citer « Assemblée nationale »).

## Ce qu'il produit (dossier `data/`)

| Fichier | Contenu |
| --- | --- |
| `scrutins-16.json`, `scrutins-17.json` | Un scrutin par ligne : date, titre, résultat, voix, voix requises, lien officiel, et pour chaque groupe ses voix, sa position et sa cohésion |
| `candidats-votes.json` | Pour chaque candidat : mandats de député, groupes, chaque vote personnel, taux de participation |
| `groupes.json` | Les groupes politiques des deux législatures (sigle, nom, dates) |
| `collecte.json` | Sources, nombre de scrutins, date du dernier scrutin, candidats suivis |
| `votes.js` | Les **grands votes** (vote final d'un texte, motions de censure, déclarations du gouvernement), classés par catégorie, avec les groupes dans l'ordre de l'hémicycle et les votes des candidats : la page « Qui a voté quoi ? ». Règles de classement et ordre des groupes dans `grands_votes.py` |
| `app.js` | **Le fichier lu par l'application** (environ 30 Ko) : les votes clés de `contenu/votes-cles.json` complétés par leurs chiffres officiels, les mandats et la participation des candidats, la médiane de l'hémicycle, et le vote personnel de chaque candidat sur chaque vote clé |

## Règles importantes

- **Position d'un groupe** : calculée à partir des voix (pour, contre ou abstention, la plus nombreuse ; `partage` en cas d'égalité ; vide si le groupe n'a pas voté). Le champ officiel `positionMajoritaire` contredit parfois les chiffres ; il est conservé à côté sous le nom `positionAN`.
- **Cohésion** : part des votants du groupe qui ont suivi la position (100 = groupe uni). En dessous de 2/3, présenter le groupe comme divisé.
- **Mandats** : lus dans les données officielles. Un député devenu ministre n'a plus de mandat : ses scrutins ne comptent pas pendant cette période.
- **Médiane** : participation médiane aux scrutins solennels, calculée sur les députés présents pour au moins 10 d'entre eux.
- **Participation** : à afficher **sur les scrutins solennels** (les grands votes) et avec la médiane de l'hémicycle. Le taux sur tous les scrutins est bas pour tout le monde (des milliers d'amendements) : l'afficher seul serait trompeur.
- **Candidats sans mandat de député** : leur fiche reste vide. L'application doit afficher « pas de mandat », jamais les votes de leur groupe comme s'ils étaient les leurs.

## Ajouter un vote clé

Dans `contenu/votes-cles.json`, ajouter une entrée avec le texte (titre, résumé, thème, source pour comprendre) et le scrutin officiel (`legislature` et `numero`, visibles dans l'adresse de la page du scrutin). Au prochain passage, l'agent y ajoute les chiffres. Si le numéro est introuvable, il l'écrit dans son journal.

## Ajouter un candidat

Dans `candidats.json`, ajouter une ligne avec l'identifiant du député (`acteur`, de la forme `PA123456`), trouvable dans l'adresse de sa fiche sur assemblee-nationale.fr. Mettre `null` s'il n'a jamais été député.

## Lancer à la main

```
python3 agents/collecte/collecte.py              # télécharge puis traite
python3 agents/collecte/collecte.py --hors-ligne # réutilise les archives déjà téléchargées
```

Les archives sont gardées dans `agents/collecte/.cache/`, qui n'est pas envoyé sur GitHub.

Si le serveur de l'Assemblée est indisponible (erreur 503, assez fréquente), l'agent réessaie trois fois en attendant 1, puis 2 minutes ; en cas d'échec, il s'arrête sans rien modifier et réessaiera la nuit suivante.

## Pas encore fait

- Les mises au point (un député qui signale après coup s'être trompé de vote) ne sont pas prises en compte.
- Sénat et Parlement européen (Retailleau, Glucksmann) : agents à part, à écrire.
- Amendements et propositions de loi.
