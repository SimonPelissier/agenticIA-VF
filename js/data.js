// Données de marIAn.
// Règle : chaque information affichée vient du document de cadrage (docs/cadrage.md)
// et renvoie à une source. Rien n'est inventé : quand une donnée manque, l'interface le dit.

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

  // Groupes parlementaires de l'Assemblée nationale.
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
    UC: "Union centriste (Sénat)"
  },

  // Positions : pour, contre, abstention, divise, autre (avec une note).
  votes: [
    {
      id: "zucman",
      date: "2025-10-31",
      title: "Taxe Zucman",
      context: "Budget 2026 (PLF)",
      summary: "Un impôt plancher de 2 % sur les patrimoines de plus de 100 millions d’euros.",
      theme: "budget",
      chamber: "Assemblée nationale",
      result: "Rejetée",
      count: "172 pour, 228 contre",
      positions: [
        { groups: ["LFI", "SOC", "ECO", "GDR"], pos: "pour" },
        { groups: ["EPR", "DEM", "HOR", "LR", "RN"], pos: "contre" }
      ],
      source: { label: "LCP", url: "https://lcp.fr/actualites/budget-2026-la-taxe-zucman-rejetee-par-l-assemblee-nationale-413632" }
    },
    {
      id: "suspension-retraites",
      date: "2025-11-12",
      title: "Suspension de la réforme des retraites",
      context: "Article 45 bis du budget de la Sécu (PLFSS)",
      summary: "Mettre en pause le recul de l’âge de départ prévu par la réforme de 2023.",
      theme: "retraites",
      chamber: "Assemblée nationale",
      result: "Adoptée",
      count: "255 pour, 146 contre",
      positions: [
        { groups: ["EPR"], pos: "abstention", note: "annoncée par Gabriel Attal" },
        { groups: ["DEM"], pos: "abstention", note: "majoritairement" },
        { groups: ["LFI"], pos: "autre", note: "n’a pas soutenu" }
      ],
      incomplete: true,
      source: { label: "LCP", url: "https://lcp.fr/actualites/budget-de-la-secu-en-commission-les-deputes-retablissent-la-suspension-de-la-reforme-des" }
    },
    {
      id: "duplomb",
      date: "2025-07-08",
      title: "Loi Duplomb",
      context: "Agriculture",
      summary: "Lever des contraintes pour les agriculteurs, dont le retour d’un pesticide interdit, l’acétamipride.",
      theme: "ecologie",
      chamber: "Assemblée nationale",
      result: "Adoptée",
      count: "316 pour, 223 contre",
      positions: [
        { groups: ["SOC", "GDR"], pos: "contre" },
        { groups: ["LIOT"], pos: "pour", note: "majoritairement" }
      ],
      after: "LFI, les Écologistes et GDR saisissent le Conseil constitutionnel, qui censure l’acétamipride le 7 août 2025.",
      incomplete: true,
      source: { label: "Datan", url: "https://datan.fr/votes/legislature-17/vote_2957" }
    },
    {
      id: "aide-a-mourir",
      date: "2025-05-27",
      title: "Aide à mourir",
      context: "1re lecture",
      summary: "Créer un droit à l’aide à mourir pour des malades en fin de vie, sous conditions.",
      theme: "sante",
      chamber: "Assemblée nationale",
      result: "Adoptée",
      count: "305 pour, 199 contre",
      positions: [
        { groups: ["RN"], pos: "contre", note: "19 pour, 101 contre" }
      ],
      incomplete: true,
      source: { label: "LCP", url: "https://lcp.fr/actualites/aide-a-mourir-qui-a-vote-quoi-a-l-assemblee-nationale-431842" }
    },
    {
      id: "ukraine",
      date: "2024-03-12",
      title: "Accord de sécurité avec l’Ukraine",
      context: "Débat suivi d’un vote (article 50-1)",
      summary: "Approuver l’accord de sécurité signé entre la France et l’Ukraine.",
      theme: "europe",
      chamber: "Assemblée nationale",
      result: "Approuvé",
      count: "372 pour, 99 contre",
      positions: [
        { groups: ["EPR", "DEM", "HOR", "SOC", "ECO", "LIOT"], pos: "pour" },
        { groups: ["LR"], pos: "pour", note: "très majoritairement" },
        { groups: ["RN"], pos: "abstention" },
        { groups: ["LFI", "GDR"], pos: "contre" }
      ],
      source: { label: "LCP", url: "https://lcp.fr/actualites/l-assemblee-nationale-soutient-largement-l-accord-avec-l-ukraine-sans-le-rn-qui-s" }
    },
    {
      id: "ivg",
      date: "2024-03-04",
      title: "IVG dans la Constitution",
      context: "Vote du Congrès à Versailles",
      summary: "Inscrire dans la Constitution la liberté de recourir à l’IVG.",
      theme: null,
      chamber: "Congrès (députés et sénateurs)",
      result: "Adoptée",
      count: "780 pour, 72 contre",
      positions: [
        { groups: ["LR", "RN", "UC"], pos: "divise" }
      ],
      incomplete: true,
      source: { label: "LCP", url: "https://lcp.fr/actualites/apres-le-vote-du-congres-la-france-devient-le-premier-pays-au-monde-a-inscrire-l-ivg" }
    },
    {
      id: "immigration",
      date: "2023-12-19",
      title: "Loi immigration",
      context: "Vote final",
      summary: "Loi « pour contrôler l’immigration, améliorer l’intégration ».",
      theme: "immigration",
      chamber: "Assemblée nationale",
      result: "Adoptée",
      count: "349 pour, 186 contre",
      positions: [
        { groups: ["RN", "LR"], pos: "pour" },
        { groups: ["LFI", "SOC", "ECO", "GDR"], pos: "contre", note: "la gauche (NUPES)" },
        { groups: ["EPR"], pos: "divise", note: "majorité pour ; 20 contre, 17 abstentions" },
        { groups: ["DEM"], pos: "divise", note: "majorité pour ; 5 contre, 15 abstentions" },
        { groups: ["HOR"], pos: "divise", note: "majorité pour ; 2 contre" },
        { groups: ["LIOT"], pos: "divise" }
      ],
      source: { label: "LCP", url: "https://lcp.fr/actualites/le-projet-de-loi-sur-l-immigration-largement-adopte-par-l-assemblee-la-majorite" }
    },
    {
      id: "censure-2023",
      date: "2023-03-20",
      title: "Motion de censure sur la réforme des retraites",
      context: "Motion transpartisane après le 49.3",
      summary: "Faire tomber le gouvernement après l’adoption sans vote de la réforme des retraites.",
      theme: "retraites",
      chamber: "Assemblée nationale",
      result: "Rejetée",
      // Le cadrage indique 289 voix requises ; la majorité absolue dépend des sièges pourvus ce jour-là. À vérifier sur Datan.
      count: "278 voix, majorité absolue non atteinte",
      positions: [
        { groups: ["LFI", "SOC", "ECO", "GDR"], pos: "pour", note: "la gauche (NUPES)" },
        { groups: ["RN"], pos: "pour" },
        { groups: ["LR"], pos: "divise", note: "19 députés sur 61 pour" }
      ],
      source: { label: "Datan", url: "https://datan.fr/votes/legislature-16/vote_1240" }
    }
  ],

  // Candidats principaux au 8 octobre 2026. Mandats notés de mémoire dans le cadrage : à vérifier.
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
