# Supabase : la base des données collectées

Depuis novembre 2026, les **données collectées** (votes de l'Assemblée, articles, déclarations) vont dans Supabase plutôt que dans des fichiers du dépôt, qui grossissaient chaque jour. Les **contenus écrits par l'équipe** (votes clés, programmes et leurs sources, lexique) restent dans GitHub et passent toujours par une pull request.

La migration se fait en trois étapes :

| Étape | Contenu | État |
| --- | --- | --- |
| 1 | Tables, règles d'accès, import des données actuelles | fait |
| 2 | Les agents (votes chaque nuit, veille chaque matin) écrivent dans Supabase ; validation des déclarations dans Supabase | fait (novembre 2026) |
| 3 | Le site lit Supabase ; le dossier `data/` quitte le dépôt ; plus de pull request quotidienne | fait (novembre 2026) |

## Les tables (`supabase/schema.sql`)

| Table | Contenu | Écrite par |
| --- | --- | --- |
| `scrutins` | Chaque scrutin public (16e et 17e législatures), avec la position de chaque groupe ; les grands votes ont en plus leur catégorie et l'ordre de l'hémicycle | agent de collecte |
| `groupes` | Les groupes politiques et leurs dates | agent de collecte |
| `candidats` | Mandats, groupes et participation des candidats | agent de collecte |
| `votes_candidats` | Vote personnel de chaque candidat sur chaque scrutin | agent de collecte |
| `collecte` | Chiffres de la dernière collecte (dernier scrutin, médiane…), et les données prêtes pour le site : `site_donnees` (votes clés, fiches des candidats), `site_votes` (grands votes de « Qui a voté quoi ? »), `medias` (noms des journaux) | agent de collecte, veille médias |
| `articles` | Articles repérés : média, titre, date, lien, candidats cités (jamais le texte) | veille médias |
| `declarations` | Citations relevées, leur vérification et leur **décision automatique** (`validee` : publiée, `refusee` : jamais publiée) | veille médias ; l'équipe peut retirer une déclaration |

Vue pratique : `grands_votes` (les grands votes, du plus récent au plus ancien).

## Qui peut lire et écrire

- **Le public** (le site, avec la clé « anon ») peut seulement **lire** : les votes, les articles, et les déclarations **validées**. Aucune écriture possible.
- **Les agents** écrivent avec la clé **« service_role »**. Elle est rangée dans les secrets GitHub et dans l'environnement Claude « Poli - media ». **Elle ne doit jamais être écrite dans le code, dans le site, ni collée dans une conversation.**

## État au 5 novembre 2026

Projet Supabase : **supabase-political-arrow** (`rjpqgdxdomktrysokdnv`, relié à Vercel). Tables créées avec la CLI Supabase (`supabase db query --remote=… -f supabase/schema.sql`) et données importées : 13 865 scrutins (dont 509 grands votes), 26 groupes, 9 candidats, 4 492 votes de candidats, 231 articles, 3 déclarations validées. Règles vérifiées : avec la clé publique, la lecture fonctionne et l'écriture est refusée.

Secrets rangés dans GitHub et dans l'environnement Claude « Poli - media » (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## Comment ça marche (depuis l'étape 3)

```
Chaque nuit, GitHub Actions          Chaque matin, routine Claude          L'équipe
agents/collecte/collecte.py          veille.py → Claude → verifier.py      (si besoin) Table
controles.py (comparaison            articles + déclarations               Editor : retirer une
  avec Supabase)                       publiées automatiquement              déclaration → refusee
importer.py --recents 60                     │                                 │
        │                                    ▼                                 │
        └──────────────►  SUPABASE  ◄──────────────────────────────────────────┘
                              │  lecture seule (clé « anon »)
                              ▼
                 le site : js/supabase.js → js/app.js
```

- **Le site** (`js/supabase.js`) lit au chargement : `site_donnees`, `site_votes` et `medias` dans la table `collecte`, les articles des 30 derniers jours, et les déclarations **validées**. L'adresse et la clé publique sont dans `js/config.js`. Si Supabase ne répond pas, la page Programmes et le lexique restent affichés, avec un message.
- **Chaque nuit**, la tâche « Agent de collecte » relance l'agent, compare ses chiffres à ceux de Supabase (`controles.py` : scrutins qui ne baissent pas, dernier scrutin qui ne recule pas, aucun grand vote disparu, mêmes candidats), puis écrit les scrutins des 60 derniers jours, tous les grands votes et les données du site. Si un contrôle échoue, **rien n'est écrit** et la tâche apparaît en rouge (GitHub prévient par e-mail). Plus de pull request.
- **Chaque matin**, la routine de veille lit dans Supabase les articles déjà connus, envoie les nouveaux, lit tous les articles, puis envoie les déclarations. Depuis le 12 novembre 2026, une nouvelle déclaration est **publiée automatiquement** (`validation = validee`), ou refusée si le plafond de 6 par candidat et par jour est atteint ; une décision déjà prise n'est jamais changée, et une déclaration déjà en base n'est jamais remplacée par une autre. Les déclarations rejetées (citation introuvable ou trop faible) ne sont pas envoyées. La routine ne modifie pas le dépôt.
- **Import complet** (tous les scrutins, si besoin) : onglet *Actions* → *Supabase : import complet des votes* → *Run workflow*.
- Les fichiers `data/` (sauf `data/programmes.js`, les programmes de Kevan) et `contenu/declarations/` ne sont plus dans le dépôt (`.gitignore`) : les agents les produisent sur la machine qui les fait tourner.

## Mise en place (à faire une fois)

1. **Créer les tables.** Dans Supabase : *SQL Editor* → *New query* → coller tout le contenu de `supabase/schema.sql` → *Run*. Relancer ne casse rien.
2. **Ranger les secrets dans GitHub.** Dans le dépôt : *Settings* → *Secrets and variables* → *Actions* → *New repository secret*, deux fois :
   - `SUPABASE_URL` : l'adresse du projet (Supabase → *Project Settings* → *API* → *Project URL*) ;
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé *service_role* (même page, section *Project API keys*).
3. **Lancer l'import.** Onglet *Actions* → *Supabase : import complet des votes* → *Run workflow*. Il relance l'agent de collecte, vérifie les données sans rien envoyer, puis importe (quelques minutes).
4. **Vérifier.** Dans Supabase → *Table Editor* : environ 13 900 scrutins, 4 500 votes de candidats, 230 articles, 3 déclarations.

## Retirer une déclaration

Il n'y a plus de validation humaine (décision du 12 novembre 2026). Pour retirer une déclaration du site : Supabase → *Table Editor* → `declarations`, mettre `validation` à `refusee`, son prénom dans `valide_par` et la date dans `valide_le`. Elle disparaît au prochain chargement de la page ; les agents ne la republieront jamais.

## Et Vercel ?

Le site est statique : il n'a pas d'étape de compilation pour lire les variables qu'ajoute l'intégration Vercel–Supabase. L'adresse du projet et la clé publique « anon » sont donc écrites dans `js/config.js` : c'est prévu par Supabase, cette clé ne permet que ce que les règles d'accès autorisent, c'est-à-dire la lecture. Si Supabase désactive un jour les anciennes clés « anon », la remplacer par la clé « publishable » (*Project Settings* → *API Keys*). Vercel republie le site seulement quand le code change : les données, elles, sont à jour dès qu'elles arrivent dans Supabase.
