# Agent de veille médias

Deuxième agent de MarIAn. Il relève ce que les candidats **disent** dans les médias généralistes : des citations exactes, datées et sourcées, qui serviront de premières promesses tant que les programmes 2027 ne sont pas publiés.

Pas de clé API : les étapes sans IA sont des scripts Python, l'extraction est faite par Claude Code (commande `/veille-medias`), sur l'abonnement de la personne ou dans une routine planifiée.

## Le circuit

```
1. veille.py              2. /veille-medias (Claude)         3. verifier.py                4. Relecture
   flux RSS de 10 médias     lit les articles, relève les        citation retrouvée mot        un membre de
   garde les articles        citations directes des              pour mot dans l'article ?     publication
   qui citent un candidat    candidats, dans TOUS les            + règles de qualité           automatique
                             articles (6 max par candidat)       → Supabase                    sur le site
```

## Les sources (`sources.json`)

franceinfo, Le Monde, Le Figaro, Libération, Ouest-France, 20 Minutes, La Croix, Le Parisien, BFMTV, L'Express : des lignes éditoriales différentes, pour que la veille ne dépende pas d'un seul regard.

Un candidat est repéré par son nom complet. Le nom de famille seul ne suffit que s'il est sans ambiguïté (Attal, Mélenchon…), pas pour Faure, Roussel, Philippe ou Le Pen.

## Ce qui est relevé

- **Seulement des citations directes** du candidat, copiées mot pour mot, une ou deux phrases (400 caractères maximum).
- **Jamais un titre** (article, intertitre, page vidéo) : le vérificateur ne lit que le corps de l'article.
- **Article inaccessible** (payant, bloqué, vidéo) : la citation peut venir du chapô du flux RSS, vérifié mot pour mot de la même façon (décision du 5 novembre 2026).
- **Deux types** : `engagement` (« je ferai… ») et `position` (« je suis pour… »). Les critiques d'adversaires et les petites phrases sont ignorées (décision du 25 octobre 2026).
- **Tous les articles sont lus**, sans limite globale ; **6 déclarations au plus par candidat et par jour** : un candidat très présent dans l'actualité ne doit pas écraser les autres (décision du 12 novembre 2026).
- **Compréhensible seule** : phrase complète, d'au moins 8 mots, qui commence par une majuscule ; pas de phrase vague. Le vérificateur rejette les citations trop courtes ou commencées en milieu de phrase.
- Un sujet parmi les 8 de l'application, ou `null`.
- Un vote clé lié (`voteLie`) quand la déclaration porte exactement sur un vote de `contenu/votes-cles.json`, pour comparer « il dit / il a voté ».

## Les fichiers

Depuis novembre 2026, articles et déclarations sont rangés dans **Supabase** (voir `docs/supabase.md`), plus dans le dépôt. La page Actualité les y lit.

| Où | Contenu |
| --- | --- |
| Supabase, table `articles` | Articles repérés : média, titre, date, lien, candidats cités, lu ou non. **Ni texte ni chapô** (droit d'auteur). Le site affiche les 30 derniers jours |
| Supabase, table `declarations` | Les déclarations, leur vérification automatique et leur **décision automatique** (`validee` : publiée ; `refusee` : jamais publiée, motif dans `motif`) |
| `agents/medias/.cache/articles.json` | Copie de travail des articles du jour. Jamais publiée |
| `agents/medias/.cache/textes/ID.txt` | Corps des articles à lire, téléchargés par `veille.py --telecharger` pour que Claude les lise tous. Fichiers de travail, **jamais publiés** (droit d'auteur) |
| `agents/medias/.cache/declarations.json` | Déclarations relevées par Claude pendant le passage du jour, avant leur envoi dans Supabase. Jamais publié |
| `agents/medias/.cache/chapos.json` | Chapô (texte d'accroche) de chaque article tiré des flux RSS : solution de repli quand l'article est inaccessible. Fichier de travail, **jamais publié** (droit d'auteur) |
| `agents/medias/.cache/rapport.md` | Rapport du jour (vérification, équilibre), repris dans le compte rendu de la routine. Jamais publié |

## Les statuts de vérification

| Statut | Signification | Que faire |
| --- | --- | --- |
| `verifiee` | Citation retrouvée mot pour mot dans le corps de l'article (`verifieDans: article`), ou, si l'article est inaccessible, dans le chapô de son flux RSS (`verifieDans: flux RSS`) | Relire le sens et le sujet ; pour le flux RSS, vérifier que les guillemets sont bien ceux du candidat |
| `a-verifier` | Article inaccessible (payant, bloqué) et citation absente du chapô RSS | Publiée quand même (choix du 12 novembre 2026 : médias reconnus), avec la mention « non vérifiée » sur le site |
| `rejetee` | Article lisible mais citation introuvable, ou format faux | Claude doit la corriger ou la supprimer ; une déclaration rejetée n'est jamais envoyée dans Supabase |

## Publication automatique (depuis le 12 novembre 2026)

Plus de validation humaine : les médias suivis sont reconnus. `verifier.py` publie directement chaque déclaration retenue (`validation = validee`, `valide_par = automatique (verifier.py)`), y compris les « à vérifier ». Il la refuse (`refusee`, motif dans `motif`) si le plafond de 6 par candidat et par jour est atteint. Les déclarations rejetées (citation introuvable, trop courte, commencée en milieu de phrase) ne sont jamais envoyées.

**Retirer une déclaration du site** : Supabase → *Table Editor* → `declarations`, mettre `validation` à `refusee` et son prénom dans `valide_par`. Une décision déjà prise n'est jamais changée par les agents.

Le compte rendu de chaque passage de la routine (https://claude.ai/code/routines) donne le rapport d'équilibre : un candidat absent ou trop présent ? Un seul média ?

## Automatique

Chaque jour à 8 h (heure de Paris), une **routine Claude Code** (dans le cloud, sur l'abonnement de Simon, sans clé API) suit `.claude/commands/veille-medias.md` : elle repère les articles, les lit tous, relève les déclarations (6 au plus par candidat), lance la vérification mot pour mot et publie le tout dans Supabase. Elle n'ouvre pas de pull request et ne modifie pas le dépôt.

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
