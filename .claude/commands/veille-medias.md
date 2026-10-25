---
description: Veille médias — relever les déclarations des candidats dans les médias généralistes du jour, les vérifier et ouvrir une pull request
---
Tu es l'agent de veille médias de MarIAn. Tu relèves ce que les candidats à la présidentielle 2027 **disent** dans les médias généralistes. Tu ne commentes pas, tu ne juges pas, tu ne reformules jamais une citation.

Suis ces étapes dans l'ordre. Si une étape échoue, arrête-toi et explique le problème simplement.

## 1. Préparer
- Récupère la dernière version de `main` et crée une branche `veille/AAAA-MM-JJ` (date du jour).
- Lis `agents/medias/README.md` et `agents/medias/sources.json`.

## 2. Repérer les articles
- Lance `python3 agents/medias/veille.py`, puis `python3 agents/medias/veille.py --a-traiter` : la liste des articles à lire (titre, média, lien, candidats cités).

## 3. Relever les déclarations
Ouvre les articles un par un, en commençant par les plus récents, et note chaque **déclaration** d'un candidat qui respecte TOUTES ces règles :

- **Citation directe** : des mots du candidat lui-même, entre guillemets dans l'article et attribués à lui. Jamais une paraphrase du journaliste, jamais les propos d'un proche, d'un porte-parole ou d'un adversaire.
- **Copiée mot pour mot**, ponctuation comprise, sans couper au milieu d'un mot. Une ou deux phrases maximum (400 caractères). Ne corrige rien, n'ajoute rien.
- **Type** : `engagement` (ce qu'il fera s'il est élu : « je ferai », « nous supprimerons », « je propose de ») ou `position` (son avis sur une mesure : « je suis pour », « je m'oppose à »). **Ignore** les critiques d'adversaires, les commentaires de sondages, les petites phrases sur la campagne et les questions de personnes.
- **Sujet** : un seul parmi `logement`, `travail`, `ecologie` (climat, énergie, agriculture), `sante`, `securite`, `education`, `retraites`, `numerique`. Mets `null` si aucun ne correspond (par exemple immigration, budget, Europe) : la déclaration est gardée quand même.
- **Résumé** neutre de 12 mots maximum, sans adjectif de jugement (« irréaliste », « courageux »…).
- **Vote lié** : si la déclaration porte exactement sur un vote clé de `contenu/votes-cles.json`, mets son `id` dans `voteLie`. Sinon `null`. Dans le doute, `null`.
- **Fact-check** : seulement si l'article lui-même renvoie à un fact-check de cette déclaration (AFP Factuel, Les Décodeurs, franceinfo Vrai ou faux, Les Surligneurs). Sinon `null`. N'en invente jamais.

« Rien trouvé » est une réponse normale : beaucoup d'articles citent un candidat sans contenir de déclaration utile.

**Limite : 15 déclarations par jour au maximum.** Si tu en trouves plus :
- garde d'abord les engagements, puis les positions les plus claires ;
- **4 par candidat au maximum**, pour qu'un candidat très présent dans l'actualité n'écrase pas les autres ;
- pas deux fois la même idée pour le même candidat.

## 4. Enregistrer
- Ajoute les déclarations dans `contenu/declarations/AAAA-MM.json` (mois de la déclaration). Si le fichier n'existe pas, crée-le avec `{"declarations": []}`. Format de chaque déclaration :

```json
{
  "id": "AAAA-MM-JJ-candidat-1",
  "candidat": "id du candidat (sources.json)",
  "date": "AAAA-MM-JJ",
  "media": "id du média (sources.json)",
  "url": "lien de l'article",
  "titreArticle": "titre de l'article",
  "citation": "mots exacts du candidat",
  "resume": "12 mots maximum",
  "type": "engagement",
  "theme": "logement",
  "voteLie": null,
  "factcheck": null,
  "ajouteLe": "AAAA-MM-JJ"
}
```

`factcheck`, quand il existe : `{"verdict": "...", "source": "AFP Factuel", "url": "..."}`.

- Marque comme lus **tous** les articles ouverts, même sans déclaration : `python3 agents/medias/veille.py --traites id1,id2,...`

## 5. Vérifier
- Lance `python3 agents/medias/verifier.py`.
- Pour chaque déclaration **rejetée** : relis l'article. Si tu avais mal copié, corrige la citation et relance le vérificateur. Sinon, **supprime** la déclaration. Il ne doit rester aucune déclaration rejetée.
- Les déclarations « à vérifier » (article payant ou bloqué) restent : un humain les vérifiera.

## 6. Proposer
- Fais un commit : « Veille médias du AAAA-MM-JJ : N déclarations ».
- Envoie la branche et ouvre une pull request vers `main`, titre « Veille médias du AAAA-MM-JJ ». Dans la description : le nombre d'articles lus, la liste des déclarations (candidat, média, citation), puis le contenu de `agents/medias/.cache/rapport.md`.
- Ne fusionne jamais toi-même : un membre de l'équipe relit chaque citation avant publication.

Termine par une phrase : nombre de déclarations proposées, nombre à vérifier à la main, lien de la pull request.
