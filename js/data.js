// Données éditoriales de marIAn (thèmes, candidats, quiz, lexique).
// Les votes et leurs chiffres ne sont plus écrits ici : ils viennent de data/app.js,
// produit par l'agent de collecte à partir de contenu/votes-cles.json et des données de l'Assemblée.
// Règle : rien n'est inventé ; quand une donnée manque, l'interface le dit.

window.DATA = {
  appName: "marIAn",
  // Date provisoire du 1er tour, en attente du décret.
  electionDate: "2027-04-11",
  electionDateProvisional: true,
  updatedAt: "8 octobre 2026",

  themes: [
    { id: "education", label: "Éducation", questions: "Parcoursup, bourses, moyens des lycées, apprentissage" },
    { id: "logement", label: "Logement", questions: "Loyers, logement étudiant, APL" },
    { id: "travail", label: "Travail et pouvoir d’achat", questions: "Smic, premier emploi, stages, chômage" },
    { id: "sante", label: "Santé", questions: "Déserts médicaux, santé mentale, remboursements" },
    { id: "ecologie", label: "Écologie, énergie et agriculture", questions: "Climat, nucléaire, pesticides, transports" },
    { id: "immigration", label: "Immigration", questions: "Titres de séjour, étudiants étrangers, droit d’asile" },
    { id: "securite", label: "Sécurité et justice", questions: "Police, prisons, justice des mineurs" },
    { id: "budget", label: "Dette, budget et impôts", questions: "Déficit, taxe Zucman, TVA, où couper ou investir" },
    { id: "retraites", label: "Retraites", questions: "Âge de départ, ce que ça change pour ma génération" },
    { id: "europe", label: "Europe et défense", questions: "Ukraine, service militaire ou civique, UE" }
  ],

  // Familles de groupes à l'Assemblée : un même courant change parfois de sigle d'une législature à l'autre.
  groups: {
    LFI: "La France insoumise",
    SOC: "Socialistes",
    ECO: "Écologistes",
    GDR: "Gauche démocrate et républicaine (PCF)",
    EPR: "Ensemble pour la République (ex-Renaissance)",
    DEM: "MoDem",
    HOR: "Horizons",
    LR: "Droite républicaine (LR)",
    RN: "Rassemblement national",
    LIOT: "LIOT",
    UDR: "Union des droites pour la République",
    UC: "Union centriste (Sénat)"
  },

  // Candidats principaux au 8 octobre 2026. 'group' : famille de groupe à l'Assemblée.
  // Pour les députés, les mandats affichés viennent des données officielles (data/app.js) ;
  // 'mandate' ne sert que pour les autres, et reste « à vérifier ».
  candidates: [
    { id: "attal", name: "Gabriel Attal", party: "Renaissance", status: "Déclaré", group: "EPR", mandate: "Ministre 2022-2024, député depuis 2024", filter: "AN", mandateVerified: false },
    { id: "faure", name: "Olivier Faure", party: "Parti socialiste", status: "Primaire de la gauche", group: "SOC", mandate: "Député de Seine-et-Marne", filter: "AN", mandateVerified: false },
    { id: "glucksmann", name: "Raphaël Glucksmann", party: "Place publique", status: "Primaire de la gauche", group: "SOC", mandate: "Député européen", filter: "PE", mandateVerified: false },
    { id: "le-pen", name: "Marine Le Pen", party: "Rassemblement national", status: "Déclarée", group: "RN", mandate: "Députée du Pas-de-Calais", filter: "AN", mandateVerified: false },
    { id: "melenchon", name: "Jean-Luc Mélenchon", party: "La France insoumise", status: "Déclaré", group: "LFI", mandate: "Aucun mandat parlementaire", filter: "Pas de mandat", mandateVerified: false },
    { id: "philippe", name: "Édouard Philippe", party: "Horizons", status: "Déclaré", group: "HOR", mandate: "Maire du Havre", filter: "Pas de mandat", mandateVerified: false },
    { id: "retailleau", name: "Bruno Retailleau", party: "Les Républicains", status: "Déclaré", group: "LR", mandate: "Sénateur jusqu’en 2024, puis ministre de l’Intérieur", filter: "Sénat", mandateVerified: false },
    { id: "roussel", name: "Fabien Roussel", party: "PCF", status: "Déclaré le 6 sept. 2026", group: "GDR", mandate: "Député jusqu’en 2024", filter: "AN (2022-2024)", mandateVerified: false },
    { id: "tondelier", name: "Marine Tondelier", party: "Les Écologistes", status: "Candidature autonome validée en principe", group: "ECO", mandate: "Aucun mandat parlementaire", filter: "Pas de mandat", mandateVerified: false }
  ],

  // Quiz « Qui a voté ça ? » : une bonne réponse parmi 4, uniquement avec des positions documentées ci-dessus.
  // Les mauvaises réponses sont des groupes dont la position contraire est sourcée.
  quiz: [
    { vote: "zucman", prompt: "Quel groupe a voté pour ?", options: ["La France insoumise", "Rassemblement national", "Horizons", "Droite républicaine (LR)"], answer: 0, explain: "LFI, les socialistes, les Écologistes et GDR ont voté pour. EPR, le MoDem, Horizons, LR et le RN ont voté contre." },
    { vote: "zucman", prompt: "Quel groupe a voté contre ?", options: ["Socialistes", "Rassemblement national", "Écologistes", "GDR (PCF)"], answer: 1, explain: "Le RN a voté contre, avec EPR, le MoDem, Horizons et LR." },
    { vote: "ukraine", prompt: "Quel groupe s’est abstenu ?", options: ["La France insoumise", "Socialistes", "Rassemblement national", "EPR (ex-Renaissance)"], answer: 2, explain: "Le RN s’est abstenu. LFI et le PCF ont voté contre, les autres groupes pour." },
    { vote: "ukraine", prompt: "Quel groupe a voté contre ?", options: ["Rassemblement national", "Écologistes", "Droite républicaine (LR)", "La France insoumise"], answer: 3, explain: "LFI et le PCF ont voté contre. Le RN s’est abstenu." },
    { vote: "immigration", prompt: "Quel groupe a voté pour ?", options: ["Socialistes", "Rassemblement national", "La France insoumise", "Écologistes"], answer: 1, explain: "Le RN et LR ont voté pour ; la gauche a voté contre." },
    { vote: "immigration", prompt: "Quel autre groupe a voté pour, avec le RN ?", options: ["Droite républicaine (LR)", "GDR (PCF)", "Socialistes", "La France insoumise"], answer: 0, explain: "LR a voté pour avec le RN. Une partie de la majorité de l’époque a voté contre ou s’est abstenue." },
    { vote: "aide-a-mourir", prompt: "Combien de députés RN ont voté contre ?", options: ["19", "55", "101", "140"], answer: 2, explain: "101 députés RN ont voté contre, 19 ont voté pour." },
    { vote: "ivg", prompt: "Avec combien de voix le Congrès l’a-t-il adoptée ?", options: ["349", "512", "780", "289"], answer: 2, explain: "780 voix pour, 72 contre." },
    { vote: "suspension-retraites", prompt: "Qu’est devenue cette mesure ?", options: ["Adoptée", "Rejetée", "Retirée", "Censurée"], answer: 0, explain: "Adoptée par 255 voix contre 146. EPR et une majorité du MoDem se sont abstenus." },
    { vote: "duplomb", prompt: "Quel produit le Conseil constitutionnel a-t-il ensuite censuré ?", options: ["Le glyphosate", "L’acétamipride", "Le chlordécone", "L’atrazine"], answer: 1, explain: "Saisi par LFI, les Écologistes et GDR, il a censuré l’acétamipride le 7 août 2025." }
  ],

  glossary: [
    { term: "49.3", match: ["49.3"], def: "Article de la Constitution qui permet au gouvernement de faire adopter un texte sans vote, sauf si une motion de censure le renverse." },
    { term: "Motion de censure", match: ["motion de censure"], def: "Vote des députés pour faire tomber le gouvernement. Il faut 289 voix sur 577." },
    { term: "Scrutin public", match: ["scrutin public"], def: "Vote où le choix de chaque député est enregistré et publié." },
    { term: "Groupe parlementaire", match: ["groupe parlementaire"], def: "Équipe de députés d’une même couleur politique." },
    { term: "PLF / PLFSS", match: ["PLFSS", "PLF"], def: "Projet de loi de finances (budget de l’État) et projet de loi de financement de la Sécurité sociale." },
    { term: "Congrès", match: ["Congrès"], def: "Réunion des députés et des sénateurs à Versailles pour modifier la Constitution, avec une majorité des trois cinquièmes." },
    { term: "Parrainages", match: ["parrainages"], def: "500 signatures d’élus nécessaires pour être candidat à la présidentielle." },
    { term: "Saisine du Conseil constitutionnel", match: ["saisissent le Conseil constitutionnel"], def: "Demande de vérifier qu’une loi respecte la Constitution avant qu’elle s’applique." }
  ]
};
