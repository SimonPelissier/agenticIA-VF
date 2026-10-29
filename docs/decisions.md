# Décisions du groupe

Une ligne par décision. On ne rouvre pas une décision écrite sans en parler au groupe.

| Date | Décision | Pourquoi |
|---|---|---|
| 2026-10-22 | Passer aux 8 sujets de la V4 : Logement, Travail, Climat, Santé, Sécurité, École, Retraites, Numérique (Immigration, Budget et Europe ne sont plus des sujets) | Choix de Simon en adoptant la DA V4. Les votes clés sur ces thèmes restent dans le quiz et les fiches candidats (`contenu/votes-cles.json` inchangé) |
| 2026-10-22 | Débat du jour : « Faut-il suspendre la réforme des retraites ? », relié au scrutin n° 3684 | Sujet relié à un vote déjà vérifié, avec le vote personnel des candidats députés |
| 2026-10-22 | Pas de résultats agrégés : ni « les autres ont répondu x % » au débat, ni « mieux que x % des joueurs » au quiz | Le cadrage les exclut (loi sur les sondages, RGPD : opinion politique) ; la réponse reste sur le téléphone |
| 2026-10-22 | « Tient parole ? » et « promesses tenues » restent « En attente » | Pas de programme 2027 publié ni de règles de scoring publiées |
| 2026-10-25 | Veille médias : 10 médias généralistes de lignes différentes (franceinfo, Le Monde, Le Figaro, Libération, Ouest-France, 20 Minutes, La Croix, Le Parisien, BFMTV, L'Express), lancée chaque jour | Équilibre des regards ; les déclarations sont aujourd'hui la seule source de promesses |
| 2026-10-25 | Ne relever que les engagements et les positions, en citation directe ; pas les critiques d'adversaires | Rester sur le fond et sur ce qui peut se comparer aux votes |
| 2026-10-25 | 15 déclarations par jour au maximum, 4 par candidat | Relecture humaine tenable (environ 10 minutes) et équilibre entre candidats |
| 2026-10-29 | *Proposition de Kevan, branche `tests-kevan`, à valider en groupe.* Section « Programmes » à part : mesures recopiées mot pour mot, sans lien avec les candidats, les sujets ou « Tient parole ? » | Éviter tout biais de reformulation ou de sélection par l'équipe (règles dans `docs/programmes.md`) |
| 2026-10-29 | *Idem.* Mesures affichées : les « mesures clés » désignées par le parti ; sinon la première mesure de chaque chapitre, en le disant | Une règle mécanique et publique, la même pour tous, plutôt qu'un choix de l'équipe |
| 2026-10-29 | L'application passe à 4 pages : Accueil, Actualité, Programmes, Qui a voté quoi ? Sujets, Candidats, Quiz et Débat du jour sont retirés (version gardée dans la branche `archive/v4-avant-4-pages`) | Choix de Simon |
| 2026-10-29 | Actualité : maquette d'Anaïs, avec les 10 médias de la veille (et non les 5 de la maquette) ; pas de bouton « Se connecter », les préférences restent sur le téléphone | Décision du 25 octobre sur les médias ; le cadrage exclut les comptes |
| 2026-10-29 | Qui a voté quoi ? : grands votes classés en 15 catégories par mots-clés du titre ; groupes placés de gauche à droite (17e législature : d'après les numéros de siège officiels ; 16e : à vérifier) ; candidat non député = vote de son groupe, toujours indiqué | Choix de Simon (prototype du 29 octobre) |
| 2026-10-29 | Veille médias confiée à une routine Claude Code quotidienne (8 h, Claude Sonnet 5.5), qui ouvre sa propre pull request ; la tâche GitHub de chaque nuit ne fait plus que les votes | Pas de clé API ; deux pull requests qui ne touchent jamais les mêmes fichiers |
