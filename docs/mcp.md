# Le serveur MCP de MarIAn

MarIAn publie ses données sous forme d'**outils pour les assistants IA** (protocole MCP, *Model Context Protocol*). Dans claude.ai ou Claude Code, on peut alors demander « Qu'a voté Olivier Faure sur la taxe Zucman ? » ou « Que proposent les partis sur le nucléaire ? » : Claude appelle les outils de MarIAn et répond avec les liens officiels.

- **Adresse :** `https://agenticia-vf.vercel.app/api/mcp`
- **Code :** `api/mcp.py`. Vercel le publie automatiquement comme une fonction, à chaque fusion dans `main`, comme le reste du site.
- **Lecture seule, aucun secret :** les votes viennent de Supabase avec la clé publique du site, les programmes de `data/programmes.js`. Rien ne peut être modifié par ce serveur.
- **Aucune IA dans le serveur :** il renvoie des faits sourcés. C'est l'assistant qui comprend la question, choisit les outils et rédige la réponse.

## L'ajouter dans claude.ai

*Réglages* → *Connecteurs* → *Ajouter un connecteur personnalisé* → nom « MarIAn », adresse `https://agenticia-vf.vercel.app/api/mcp`. Aucune connexion ni mot de passe. Dans une conversation, activer le connecteur MarIAn, puis poser sa question.

Dans Claude Code : `claude mcp add --transport http marian https://agenticia-vf.vercel.app/api/mcp`.

## Les outils

| Outil | Ce qu'il renvoie |
| --- | --- |
| `references` | Identifiants des candidats, catégories de votes, partis, législatures. Claude l'appelle en premier |
| `rechercher_votes` | Grands votes filtrés par mots (titre ou catégorie), catégorie, législature, résultat, dates ; du plus récent au plus ancien |
| `detail_vote` | Un vote : résultat, chaque groupe de gauche à droite (voix, position, cohésion), vote de chaque candidat, lien officiel |
| `vote_du_candidat` | Le vote d'un candidat sur un vote précis ou sur un sujet ; s'il ne siégeait pas, le vote de son groupe, dit comme tel |
| `bilan_candidat` | Mandats, groupes, participation aux scrutins solennels et médiane de l'hémicycle, votes sur les votes clés de MarIAn |
| `comparer_candidats` | Combien de fois deux candidats ont voté pareil, avec des exemples de désaccords |
| `mesures_du_parti` | Les mesures d'un parti, mot pour mot, par thème ou par mots, avec leur lien |
| `rechercher_mesures` | Un mot cherché dans tous les programmes publiés dans MarIAn |
| `comparer_programmes` | Sur un sujet, les mesures de chaque parti, dans l'ordre alphabétique, ou « pas encore de programme » |

## Les règles (les mêmes que sur le site)

- **Une source pour chaque fait :** chaque vote a son lien vers le scrutin officiel, chaque mesure son lien vers le programme.
- **Aucun classement, aucune note.** Candidats et partis sont toujours dans l'ordre alphabétique. `comparer_candidats` donne des nombres, pas de verdict.
- **Vote personnel ou vote du groupe :** même règle que la page « Qui a voté quoi ? ». Quand un candidat ne siégeait pas (pas encore élu, ministre…), c'est le vote de son groupe, et l'outil le dit.
- **Périmètre des programmes :** pour certains partis, MarIAn n'a que les mesures mises en avant ou la première de chaque chapitre (docs/programmes.md). Chaque réponse le précise, avec l'avertissement « l'absence d'une mesure ici ne veut pas dire que le parti ne la propose pas ».
- Ces règles sont aussi données à l'assistant au début de chaque conversation (champ `instructions` du serveur).

## Limites connues

- Seulement les **grands votes** (vote final d'un texte, motions de censure, déclarations du gouvernement), pas les amendements.
- La recherche porte sur le **titre** et la catégorie. Les motions de censure s'appellent « Motion de censure (après un 49.3) », sans le nom du texte visé : pour la réforme des retraites de 2023, chercher par date (mars 2023).
- Les données sont gardées 10 minutes en mémoire : un vote arrivé dans la nuit apparaît au plus 10 minutes après.

## Tester sur un ordinateur

```
python3 api/mcp.py 8001
```

Le serveur répond alors sur `http://localhost:8001/api/mcp` (sur un Mac, ajouter `SSL_CERT_FILE=/etc/ssl/cert.pem` devant la commande si Python ne trouve pas les certificats). Pour l'essayer avec un vrai assistant : `npx @modelcontextprotocol/inspector`, ou Claude Code avec l'adresse locale.

## Modifier un outil

Chaque outil est une fonction de `api/mcp.py`, décrite dans la liste `OUTILS` : nom, titre, **description** et paramètres. La description est ce que lit l'assistant pour choisir l'outil : la soigner autant que le code. Après une modification, relancer le serveur en local et appeler l'outil avant d'ouvrir la pull request.
