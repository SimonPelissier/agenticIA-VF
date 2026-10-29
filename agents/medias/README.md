# Agent de veille médias

Deuxième agent de MarIAn. Il relève ce que les candidats **disent** dans les médias généralistes : des citations exactes, datées et sourcées, qui serviront de premières promesses tant que les programmes 2027 ne sont pas publiés.

Pas de clé API : les étapes sans IA sont des scripts Python, l'extraction est faite par Claude Code (commande `/veille-medias`), sur l'abonnement de la personne ou dans une routine planifiée.

## Le circuit

```
1. veille.py              2. /veille-medias (Claude)         3. verifier.py                4. Relecture
   flux RSS de 10 médias     lit les articles, relève les        citation retrouvée mot        un membre de
   garde les articles        citations directes des              pour mot dans l'article ?     l'équipe relit
   qui citent un candidat    candidats (15 max par jour)         + rapport d'équilibre         et fusionne
```

## Les sources (`sources.json`)

franceinfo, Le Monde, Le Figaro, Libération, Ouest-France, 20 Minutes, La Croix, Le Parisien, BFMTV, L'Express : des lignes éditoriales différentes, pour que la veille ne dépende pas d'un seul regard.

Un candidat est repéré par son nom complet. Le nom de famille seul ne suffit que s'il est sans ambiguïté (Attal, Mélenchon…), pas pour Faure, Roussel, Philippe ou Le Pen.

## Ce qui est relevé

- **Seulement des citations directes** du candidat, copiées mot pour mot, une ou deux phrases (400 caractères maximum).
- **Deux types** : `engagement` (« je ferai… ») et `position` (« je suis pour… »). Les critiques d'adversaires et les petites phrases sont ignorées (décision du 25 octobre 2026).
- **15 déclarations par jour au maximum, 4 par candidat** : un candidat très présent dans l'actualité ne doit pas écraser les autres.
- Un sujet parmi les 8 de l'application, ou `null`.
- Un vote clé lié (`voteLie`) quand la déclaration porte exactement sur un vote de `contenu/votes-cles.json`, pour comparer « il dit / il a voté ».

## Les fichiers

| Fichier | Contenu |
| --- | --- |
| `data/medias/articles.json` | Articles repérés : média, titre, date, lien, candidats cités, lu ou non. **Ni texte ni chapô** (droit d'auteur). Gardés 30 jours |
| `contenu/declarations/AAAA-MM.json` | Les déclarations du mois, avec leur statut de vérification |
| `data/actu.js` | Ce que lit la page Actualité : articles des 30 derniers jours et déclarations retenues (jamais les rejetées). Refait par `veille.py` et `verifier.py` |
| `agents/medias/.cache/rapport.md` | Rapport du jour (vérification, équilibre), repris dans la pull request. Pas envoyé sur GitHub |

## Les statuts de vérification

| Statut | Signification | Que faire |
| --- | --- | --- |
| `verifiee` | Citation retrouvée mot pour mot dans l'article | Relire le sens et le sujet |
| `a-verifier` | Article payant (Le Monde) ou qui bloque les robots (Libération) | **Ouvrir l'article et vérifier la citation à la main** avant de fusionner |
| `rejetee` | Article lisible mais citation introuvable, ou format faux | Claude doit la corriger ou la supprimer : aucune ne doit rester |

## Relire une pull request « Veille médias »

1. Pour chaque déclaration : le candidat parle-t-il vraiment en son nom ? Le type et le sujet sont-ils justes ? Le résumé est-il neutre ?
2. Ouvrir les articles des déclarations « à vérifier ».
3. Lire le rapport d'équilibre : un candidat absent ou trop présent ? Un seul média ?
4. Fusionner, ou supprimer les déclarations douteuses avant.

## Automatique

Chaque jour à 8 h (heure de Paris), une **routine Claude Code** (dans le cloud, sur l'abonnement de Simon, sans clé API) suit `.claude/commands/veille-medias.md` : elle repère les articles, relève au plus 15 déclarations, lance la vérification mot pour mot et ouvre une pull request « Veille médias du … ». Elle ne fusionne jamais : un membre de l'équipe relit chaque citation.

La routine est la seule à modifier `data/medias/articles.json`, `data/actu.js` et `contenu/declarations/` ; la tâche GitHub de chaque nuit ne s'occupe que des votes. Les deux pull requests ne se marchent donc jamais dessus.

Gérer la routine (pause, horaire, historique des passages) : https://claude.ai/code/routines

## Lancer à la main

Dans Claude Code, à la racine du dépôt : `/veille-medias`.

Ou étape par étape :

```
python3 agents/medias/veille.py              # repère les articles
python3 agents/medias/veille.py --a-traiter  # liste ceux à lire
python3 agents/medias/verifier.py            # vérifie les déclarations ajoutées
```

## Pas encore fait

- Transcriptions des débats télévisés, discours officiels (vie-publique.fr), fact-checkeurs : sources à ajouter.
- Réseaux sociaux des candidats : non suivis.
