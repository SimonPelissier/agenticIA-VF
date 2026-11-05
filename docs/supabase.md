# Supabase : la base des données collectées

Depuis novembre 2026, les **données collectées** (votes de l'Assemblée, articles, déclarations) vont dans Supabase plutôt que dans des fichiers du dépôt, qui grossissaient chaque jour. Les **contenus écrits par l'équipe** (votes clés, programmes et leurs sources, lexique) restent dans GitHub et passent toujours par une pull request.

La migration se fait en trois étapes :

| Étape | Contenu | État |
| --- | --- | --- |
| 1 | Tables, règles d'accès, import des données actuelles | ce document |
| 2 | Les agents (votes chaque nuit, veille chaque matin) écrivent dans Supabase ; validation des déclarations dans Supabase | à venir |
| 3 | Le site lit Supabase ; le dossier `data/` quitte le dépôt | à venir |

## Les tables (`supabase/schema.sql`)

| Table | Contenu | Écrite par |
| --- | --- | --- |
| `scrutins` | Chaque scrutin public (16e et 17e législatures), avec la position de chaque groupe ; les grands votes ont en plus leur catégorie et l'ordre de l'hémicycle | agent de collecte |
| `groupes` | Les groupes politiques et leurs dates | agent de collecte |
| `candidats` | Mandats, groupes et participation des candidats | agent de collecte |
| `votes_candidats` | Vote personnel de chaque candidat sur chaque scrutin | agent de collecte |
| `collecte` | Chiffres de la dernière collecte (dernier scrutin, médiane…) | agent de collecte |
| `articles` | Articles repérés : média, titre, date, lien, candidats cités (jamais le texte) | veille médias |
| `declarations` | Citations relevées, leur vérification automatique et leur **validation humaine** | veille médias, puis l'équipe |

Vue pratique : `grands_votes` (les grands votes, du plus récent au plus ancien).

## Qui peut lire et écrire

- **Le public** (le site, avec la clé « anon ») peut seulement **lire** : les votes, les articles, et les déclarations **validées**. Aucune écriture possible.
- **Les agents** écrivent avec la clé **« service_role »**. Elle est rangée dans les secrets GitHub et dans l'environnement Claude « Poli - media ». **Elle ne doit jamais être écrite dans le code, dans le site, ni collée dans une conversation.**

## Mise en place (à faire une fois)

1. **Créer les tables.** Dans Supabase : *SQL Editor* → *New query* → coller tout le contenu de `supabase/schema.sql` → *Run*. Relancer ne casse rien.
2. **Ranger les secrets dans GitHub.** Dans le dépôt : *Settings* → *Secrets and variables* → *Actions* → *New repository secret*, deux fois :
   - `SUPABASE_URL` : l'adresse du projet (Supabase → *Project Settings* → *API* → *Project URL*) ;
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé *service_role* (même page, section *Project API keys*).
3. **Lancer l'import.** Onglet *Actions* → *Supabase : import initial* → *Run workflow*. Il vérifie d'abord les données sans rien envoyer, puis importe (quelques minutes).
4. **Vérifier.** Dans Supabase → *Table Editor* : environ 13 900 scrutins, 4 500 votes de candidats, 230 articles, 3 déclarations.

## Valider une déclaration (à partir de l'étape 2)

Dans Supabase → *Table Editor* → `declarations`, filtrer `validation = a-valider`. Pour chaque ligne : relire la citation (ouvrir l'`url`), puis mettre `validation` à `validee` (ou `refusee`) et son prénom dans `valide_par`. Seules les déclarations validées apparaissent sur le site.

## Et Vercel ?

Le site est statique : il n'a pas d'étape de compilation pour lire les variables qu'ajoute l'intégration Vercel–Supabase. À l'étape 3, l'adresse du projet et la clé publique « anon » seront écrites dans un petit fichier du site (`js/config.js`) : c'est prévu par Supabase, cette clé ne permet que ce que les règles d'accès autorisent, c'est-à-dire la lecture.
