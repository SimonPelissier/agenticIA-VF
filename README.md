# marIAn

**Ce qu'ils promettent. Ce qu'ils ont voté.**

Plateforme faite par des jeunes, pour des jeunes (16-25 ans) : les candidats à la présidentielle 2027 face à leurs actes depuis 2022, thème par thème. Chaque information renvoie à une source vérifiable. Pas de consigne de vote, pas de compte, aucune donnée personnelle collectée.

Le cadrage complet (objectifs, sources, agents, règles éditoriales) est dans [docs/cadrage.md](docs/cadrage.md).

**Branche `design-colorful`** : design « V3 Colorful » (crème et jaune, accent violet #6d28d9, Inter et JetBrains Mono, quiz en bulletins de vote). La version éditoriale noir et jaune est sur la branche `marian-v1`.

## Ce que contient cette première version

| Écran | Contenu |
| --- | --- |
| Accueil | Compte à rebours, entrées « Par thème » et « Par candidat », quiz, barre « thèmes explorés » |
| Par thème | 10 thèmes, une carte par candidat (thermomètre « promesse vs votes » en attente, votes de son groupe), puis le détail des votes avec leur source |
| Par candidat | 9 candidats principaux, mandat, groupe, votes de leur groupe (signalés comme tels) |
| Qui a voté ça ? | 10 questions à 4 choix tirées de votes réels, progression en bulletins, carte de score au format story |
| Lexique, Méthode | Mots compliqués (49.3, PLFSS…) et règles éditoriales |

Les promesses 2027 ne sont pas encore affichées : les programmes ne sont pas publiés. L'interface l'indique au lieu d'inventer du contenu. Les mandats des candidats sont marqués « à vérifier ».

## Structure

```
index.html      page unique, barre d'onglets en bas
css/style.css   style (papier crème, encre noire, jaune)
js/data.js      toutes les données, avec leur source
js/app.js       écrans et navigation (#/themes, #/candidats, #/quiz…)
docs/           cadrage du projet
```

Aucune dépendance, aucune étape de compilation : HTML, CSS et JavaScript simples.

## Lancer en local

Ouvrir `index.html` dans un navigateur.

## Mettre en ligne sur Vercel

1. Sur [vercel.com](https://vercel.com), « Add New… → Project », importer ce dépôt GitHub.
2. Framework : « Other ». Laisser la commande de build vide.
3. Déployer. Chaque modification poussée sur `main` met le site à jour.

## Ajouter ou corriger une donnée

Tout se passe dans `js/data.js` :

- **Un vote** : ajouter un objet dans `votes`, avec `theme`, `positions` (groupes et position) et obligatoirement `source`.
- **Un candidat** : ajouter un objet dans `candidates`. Passer `mandateVerified` à `true` une fois le mandat vérifié.
- **Une question de quiz** : ajouter un objet dans `quiz`, lié à un vote existant par son `id`.

Règle : pas de source, pas de publication.

## Prochaines étapes techniques

- Agent de collecte : scrutins nominatifs de la 16e et de la 17e législature (data.assemblee-nationale.fr)
- Agent de vérification des citations (code, sans IA)
- Base Supabase et interface de relecture humaine, puis lecture des données depuis Supabase
