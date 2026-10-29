// Données éditoriales de marIAn (sujets, groupes, candidats, lexique).
// Le débat du jour et le quiz ont été retirés le 29 octobre 2026 (branche archive/v4-avant-4-pages).
// Les votes et leurs chiffres ne sont plus écrits ici : ils viennent de data/app.js,
// produit par l'agent de collecte à partir de contenu/votes-cles.json et des données de l'Assemblée.
// Règle : rien n'est inventé ; quand une donnée manque, l'interface le dit.

window.DATA = {
  appName: "MarIAn",
  // Date provisoire du 1er tour, en attente du décret.
  electionDate: "2027-04-11",
  electionDateProvisional: true,
  updatedAt: "8 octobre 2026",

  // Les 8 sujets de la V4 (décision du 22 octobre 2026, voir docs/decisions.md).
  // 'id' correspond au thème des votes clés (contenu/votes-cles.json) ; 'sur' sert au titre « Qui vote quoi sur… ».
  themes: [
    { id: "logement", label: "Logement", sur: "le logement", questions: "Loyers, logement étudiant, APL", icon: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6" },
    { id: "travail", label: "Travail", sur: "le travail", questions: "Smic, premier emploi, stages, chômage", icon: "M3 8h18v12H3zM8 8V5h8v3M3 13h18" },
    { id: "ecologie", label: "Climat", sur: "le climat", questions: "Climat, nucléaire, pesticides, transports", icon: "M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8" },
    { id: "sante", label: "Santé", sur: "la santé", questions: "Déserts médicaux, santé mentale, fin de vie", icon: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" },
    { id: "securite", label: "Sécurité", sur: "la sécurité", questions: "Police, prisons, justice des mineurs", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
    { id: "education", label: "École", sur: "l’école", questions: "Parcoursup, bourses, moyens des lycées, apprentissage", icon: "M4 5h6a2 2 0 0 1 2 2v12c0-1-1-2-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12c0-1 1-2 2-2h6z" },
    { id: "retraites", label: "Retraites", sur: "les retraites", questions: "Âge de départ, ce que ça change pour ma génération", icon: "M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9" },
    { id: "numerique", label: "Numérique", sur: "le numérique", questions: "Réseaux sociaux, écrans, données personnelles, IA", icon: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" }
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
