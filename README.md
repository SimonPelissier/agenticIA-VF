# marIAn

**Ce qu'ils promettent. Ce qu'ils ont voté.**

Plateforme faite par des jeunes, pour des jeunes (16-25 ans) : les candidats à la présidentielle 2027 face à leurs actes depuis 2022, thème par thème. Chaque information renvoie à une source vérifiable. Pas de consigne de vote, pas de compte, aucune donnée personnelle collectée.

Le cadrage complet (objectifs, sources, agents, règles éditoriales) est dans [docs/cadrage.md](docs/cadrage.md).

**Branche `design-colorful`** : design « V3 Colorful » (crème et jaune, accent violet #6d28d9, Inter et JetBrains Mono, quiz en bulletins de vote). La version éditoriale noir et jaune est sur la branche `marian-v1`.

## Ce que contient cette première version

| Écran | Contenu |
| --- | --- |
| Chargement | « On dépouille les votes… », une fois par visite |
| Accueil | Compte à rebours, débat du jour, quiz, « Complète 3 sujets », entrées Par sujet et Par candidat |
| Débat | Une question reliée à un vote clé ; après ta réponse (gardée sur ton téléphone), le vote de chaque candidat |
| Sujets | 8 sujets ; pour chacun, une carte par candidat (promesse en attente, son vote ou celui de son groupe) et le détail des votes |
| Candidats | Bilan : promesses tenues (en attente), participation aux grands votes face à la médiane, mandats officiels, votes sujet par sujet |
| Qui a voté ça ? | 10 questions à 4 choix sur de vrais votes, série et points, carte de score au format story |
| Comment on décide, Lexique | Règles de jugement et règles éditoriales, signalement d'erreur, mots compliqués |

Les promesses 2027 ne sont pas encore affichées : les programmes ne sont pas publiés. L'interface l'indique au lieu d'inventer du contenu. Les chiffres des votes et les mandats de député viennent des données ouvertes de l'Assemblée nationale (voir `agents/collecte/`) ; les autres mandats restent « à vérifier ».

## Structure

```
index.html      page unique, barre d'onglets à 5 entrées, écran de chargement
css/style.css   style V4 (crème et jaune, accent violet, contours noirs)
js/data.js      données éditoriales : thèmes, candidats, quiz, lexique
js/app.js       écrans et navigation (#/sujets, #/candidats, #/debat, #/quiz…)
contenu/        votes clés choisis par l'équipe (texte + numéro du scrutin officiel)
data/app.js     données officielles pour l'application, produites par l'agent de collecte
data/*.json     données brutes collectées (scrutins, votes, groupes)
agents/         agents (collecte des votes de l'Assemblée)
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
- Collecte Sénat et Parlement européen
- Agent de vérification des citations (code, sans IA)
- Base Supabase et interface de relecture humaine, puis lecture des données depuis Supabase
