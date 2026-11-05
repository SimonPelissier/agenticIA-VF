# Agent de veille médias

Deuxième agent de MarIAn. Il relève ce que les candidats **disent** dans les médias généralistes : des citations exactes, datées et sourcées, qui serviront de premières promesses tant que les programmes 2027 ne sont pas publiés.

Pas de clé API : les étapes sans IA sont des scripts Python, l'extraction est faite par Claude Code (commande `/veille-medias`), sur l'abonnement de la personne ou dans une routine planifiée.

## Le circuit

```
1. veille.py              2. /veille-medias (Claude)         3. verifier.py                4. Relecture
   flux RSS de 10 médias     lit les articles, relève les        citation retrouvée mot        un membre de
   garde les articles        citations directes des              pour mot dans l'article ?     l'équipe relit
   qui citent un candidat    candidats (15 max par jour)         + rapport d'équilibre         et valide
                                                                 → Supabase, « à valider »     dans Supabase
```

## Les sources (`sources.json`)

franceinfo, Le Monde, Le Figaro, Libération, Ouest-France, 20 Minutes, La Croix, Le Parisien, BFMTV, L'Express : des lignes éditoriales différentes, pour que la veille ne dépende pas d'un seul regard.

Un candidat est repéré par son nom complet. Le nom de famille seul ne suffit que s'il est sans ambiguïté (Attal, Mélenchon…), pas pour Faure, Roussel, Philippe ou Le Pen.

## Ce qui est relevé

- **Seulement des citations directes** du candidat, copiées mot pour mot, une ou deux phrases (400 caractères maximum).
- **Jamais un titre** (article, intertitre, page vidéo) : le vérificateur ne lit que le corps de l'article.
- **Article inaccessible** (payant, bloqué, vidéo) : la citation peut venir du chapô du flux RSS, vérifié mot pour mot de la même façon (décision du 5 novembre 2026).
- **Deux types** : `engagement` (« je ferai… ») et `position` (« je suis pour… »). Les critiques d'adversaires et les petites phrases sont ignorées (décision du 25 octobre 2026).
- **15 déclarations par jour au maximum, 4 par candidat** : un candidat très présent dans l'actualité ne doit pas écraser les autres.
- Un sujet parmi les 8 de l'application, ou `null`.
- Un vote clé lié (`voteLie`) quand la déclaration porte exactement sur un vote de `contenu/votes-cles.json`, pour comparer « il dit / il a voté ».

## Les fichiers

Depuis novembre 2026, articles et déclarations sont rangés dans **Supabase** (voir `docs/supabase.md`), plus dans le dépôt. La page Actualité les y lit.

| Où | Contenu |
| --- | --- |
| Supabase, table `articles` | Articles repérés : média, titre, date, lien, candidats cités, lu ou non. **Ni texte ni chapô** (droit d'auteur). Le site affiche les 30 derniers jours |
| Supabase, table `declarations` | Les déclarations, leur vérification automatique et leur **validation par l'équipe** (seules les `validee` sont publiées) |
| `agents/medias/.cache/articles.json` | Copie de travail des articles du jour. Jamais publiée |
| `agents/medias/.cache/declarations.json` | Déclarations relevées par Claude pendant le passage du jour, avant leur envoi dans Supabase. Jamais publié |
| `agents/medias/.cache/chapos.json` | Chapô (texte d'accroche) de chaque article tiré des flux RSS : solution de repli quand l'article est inaccessible. Fichier de travail, **jamais publié** (droit d'auteur) |
| `agents/medias/.cache/rapport.md` | Rapport du jour (vérification, équilibre), repris dans le compte rendu de la routine. Jamais publié |

## Les statuts de vérification

| Statut | Signification | Que faire |
| --- | --- | --- |
| `verifiee` | Citation retrouvée mot pour mot dans le corps de l'article (`verifieDans: article`), ou, si l'article est inaccessible, dans le chapô de son flux RSS (`verifieDans: flux RSS`) | Relire le sens et le sujet ; pour le flux RSS, vérifier que les guillemets sont bien ceux du candidat |
| `a-verifier` | Article inaccessible (payant, bloqué) et citation absente du chapô RSS | **Ouvrir l'article et vérifier la citation à la main** avant de la valider |
| `rejetee` | Article lisible mais citation introuvable, ou format faux | Claude doit la corriger ou la supprimer ; une déclaration rejetée n'est jamais envoyée dans Supabase |

## Valider les déclarations (dans Supabase)

Dans Supabase → *Table Editor* → `declarations`, filtrer `validation = a-valider`. Pour chaque ligne :

1. Le candidat parle-t-il vraiment en son nom ? Le type et le sujet sont-ils justes ? Le résumé est-il neutre ?
2. Pour une déclaration `a-verifier` (colonne `verification`), ouvrir l'article (`url`) et retrouver la citation.
3. Mettre `validation` à `validee` (ou `refusee`) et son prénom dans `valide_par`. La déclaration apparaît sur le site au prochain chargement de la page.

Le compte rendu de chaque passage de la routine (https://claude.ai/code/routines) donne le rapport d'équilibre : un candidat absent ou trop présent ? Un seul média ?

## Automatique

Chaque jour à 8 h (heure de Paris), une **routine Claude Code** (dans le cloud, sur l'abonnement de Simon, sans clé API) suit `.claude/commands/veille-medias.md` : elle repère les articles, relève au plus 15 déclarations, lance la vérification mot pour mot et envoie le tout dans Supabase. Elle n'ouvre plus de pull request et ne modifie pas le dépôt : un membre de l'équipe valide chaque citation dans Supabase.

La routine a besoin des variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (environnement Claude « Poli - media », dont le réseau doit autoriser `rjpqgdxdomktrysokdnv.supabase.co`). Sans elles, elle s'arrête au lieu de travailler pour rien.

Gérer la routine (pause, horaire, historique des passages) : https://claude.ai/code/routines

## Lancer à la main

Dans Claude Code, à la racine du dépôt : `/veille-medias`.

Ou étape par étape :

```
python3 agents/medias/veille.py              # repère les articles
python3 agents/medias/veille.py --a-traiter  # liste ceux à lire
python3 agents/medias/verifier.py            # vérifie agents/medias/.cache/declarations.json, envoie dans Supabase
```

Sans les variables Supabase, les scripts travaillent sur leurs copies locales et n'envoient rien.

## Pas encore fait

- Transcriptions des débats télévisés, discours officiels (vie-publique.fr), fact-checkeurs : sources à ajouter.
- Réseaux sociaux des candidats : non suivis.
