# marIAn

**Ce qu'ils promettent. Ce qu'ils ont voté.**

Plateforme faite par des jeunes, pour des jeunes (16-25 ans) : les candidats à la présidentielle 2027 face à leurs actes depuis 2022, thème par thème. Chaque information renvoie à une source vérifiable. Pas de consigne de vote, pas de compte, aucune donnée personnelle collectée.

Le cadrage complet (objectifs, sources, agents, règles éditoriales) est dans [docs/cadrage.md](docs/cadrage.md).

**Branche `design-colorful`** : design « V3 Colorful » (crème et jaune, accent violet #6d28d9, Inter et JetBrains Mono, quiz en bulletins de vote). La version éditoriale noir et jaune est sur la branche `marian-v1`.

## Les 4 pages

| Page | Contenu |
| --- | --- |
| Accueil | Compte à rebours et les trois entrées, avec les dernières nouvelles de chacune |
| Actualité | Fil des articles de 10 médias généralistes qui citent un candidat, par candidat ou par sujet ; « L'essentiel » reprend les déclarations relevées et vérifiées ; détail d'une news ; « Ton fil » (préférences gardées sur le téléphone). Maquette d'Anaïs |
| Programmes | Les mesures des programmes des partis, recopiées mot pour mot et vérifiées contre la source archivée. Section de Kevan (règles : `docs/programmes.md`) |
| Qui a voté quoi ? | Les grands votes de l'Assemblée depuis 2022, par sujet (catégories, dernières lois, hémicycle par groupe de gauche à droite) ou par personne (vote du candidat s'il siégeait, sinon celui de son groupe) |
| Comment on travaille, Lexique | Règles, signalement d'erreur, mots compliqués |

L'ancienne version (Sujets, Candidats, Quiz, Débat du jour) est gardée dans la branche `archive/v4-avant-4-pages`.

Les promesses 2027 ne sont pas encore affichées : les programmes ne sont pas publiés. L'interface l'indique au lieu d'inventer du contenu. Les chiffres des votes et les mandats de député viennent des données ouvertes de l'Assemblée nationale (voir `agents/collecte/`) ; les autres mandats restent « à vérifier ».

## Structure

```
index.html      page unique, barre d'onglets à 4 entrées, écran de chargement
css/style.css   style V4 (crème et jaune, accent violet, contours noirs)
js/data.js      données éditoriales : sujets, groupes, candidats, lexique
js/app.js       écrans et navigation (#/actu, #/programmes, #/votes…)
contenu/        votes clés choisis par l'équipe (texte + numéro du scrutin officiel)
contenu/programmes/  mesures des programmes, recopiées mot pour mot (règles : docs/programmes.md)
data/programmes.js   programmes vérifiés, produit par agents/verification/programmes.py
data/app.js     votes clés et participation des candidats (agent de collecte)
data/votes.js   grands votes classés par catégorie, pour « Qui a voté quoi ? » (agent de collecte)
data/actu.js    articles et déclarations, pour l'Actualité (veille médias)
data/*.json     données brutes collectées (scrutins, votes, groupes)
agents/         agents : collecte des votes de l'Assemblée, veille médias
.claude/        commande /veille-medias (consignes d'extraction pour Claude)
docs/           cadrage, avancement, décisions du groupe
```

Aucune dépendance, aucune étape de compilation : HTML, CSS et JavaScript simples.

## Lancer en local

Ouvrir `index.html` dans un navigateur.

## Mettre en ligne sur Vercel

1. Sur [vercel.com](https://vercel.com), « Add New… → Project », importer ce dépôt GitHub.
2. Framework : « Other ». Laisser la commande de build vide.
3. Déployer. Chaque modification poussée sur `main` met le site à jour.

## Ajouter ou corriger une donnée

- **Un vote clé** : dans `contenu/votes-cles.json`, le texte et le numéro du scrutin officiel. Les chiffres sont ajoutés par l'agent de collecte (`data/app.js`), jamais à la main.
- **Un candidat** : dans `js/data.js` (`candidates`) et, s'il a été député, dans `agents/collecte/candidats.json`.
- **Une question de quiz** : dans `js/data.js` (`quiz`), liée à un vote clé par son `id`. Vérifier la réponse sur la page du scrutin officiel.
- **Ne jamais modifier `data/` à la main** : ces fichiers sont refaits par l'agent chaque nuit.

Règle : pas de source, pas de publication.

## Prochaines étapes techniques

- Classer les scrutins collectés par thème, pour afficher plus que les votes clés
- Créer la routine quotidienne `/veille-medias` (relevé des déclarations par Claude)
- Collecte Sénat et Parlement européen
- Agent de vérification des citations (code, sans IA)
- Base Supabase et interface de relecture humaine, puis lecture des données depuis Supabase
