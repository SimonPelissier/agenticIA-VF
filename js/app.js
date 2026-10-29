// MarIAn — design « V4 ». Sans compte ni serveur : tout est calculé dans le navigateur.
(function () {
  "use strict";

  var D = window.DATA;
  // Données officielles produites par l'agent de collecte (data/app.js).
  var MD = window.MARIAN_DONNEES || { votesCles: [], candidats: {} };
  var app = document.getElementById("app");

  // ---------- Outils ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function fmtDate(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function fmtMonth(iso) {
    var p = iso.split("-");
    return MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function pct(x) { return String(x).replace(".", ",") + " %"; }

  function daysLeft() {
    var p = D.electionDate.split("-");
    var target = new Date(+p[0], +p[1] - 1, +p[2]);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((target - today) / 86400000));
  }

  function initials(name) {
    var w = name.split(/\s+/);
    return (w[0][0] + w[w.length - 1][0]).toUpperCase();
  }

  function icon(d, size) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var I = {
    back: "M19 12H5M11 6l-6 6 6 6",
    arrow: "M5 12h14M13 6l6 6-6 6",
    chat: "M4 5h16v11H9l-5 4z",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6",
    list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
    share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    flame: "M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z",
    lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
    doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"
  };

  // Stockage local, uniquement sur l'appareil, pour les sujets explorés.
  var STORE_KEY = "marian:themes-vus";
  function seenThemes() {
    var ids = D.themes.map(function (t) { return t.id; });
    try {
      return (JSON.parse(localStorage.getItem(STORE_KEY)) || []).filter(function (id) { return ids.indexOf(id) !== -1; });
    } catch (e) { return []; }
  }
  function markSeen(id) {
    var seen = seenThemes();
    if (seen.indexOf(id) === -1) {
      seen.push(id);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(seen)); } catch (e) { /* navigation privée */ }
    }
  }

  // Lexique : rend cliquables les mots compliqués.
  var termIndex = {};
  var termWords = [];
  D.glossary.forEach(function (g, i) {
    g.match.forEach(function (m) { termIndex[m.toLowerCase()] = i; termWords.push(m); });
  });
  termWords.sort(function (a, b) { return b.length - a.length; });
  var termRe = new RegExp("(" + termWords.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");

  function withTerms(text) {
    return esc(text).replace(termRe, function (m) {
      var i = termIndex[m.toLowerCase()];
      return i === undefined ? m : '<button type="button" class="term" data-term="' + i + '">' + m + "</button>";
    });
  }

  // ---------- Données des votes ----------

  // Transforme un vote clé (texte de l'équipe + chiffres officiels) en objet prêt à afficher.
  function normalizeVote(v) {
    var o = v.officiel;
    var m = v.manuel;
    var base = { id: v.id, theme: v.theme, title: v.title, context: v.context, summary: v.summary, after: v.after, source: v.source };
    if (o) {
      base.date = o.date;
      base.chamber = "Assemblée nationale";
      base.official = o.url;
      base.result = o.sort === "adopté" ? "Adopté" : "Rejeté";
      // Une motion de censure ne compte que les voix pour : on montre alors le seuil à atteindre.
      base.count = o.contre === 0 && o.abstentions === 0
        ? o.pour + " voix pour, il en fallait " + o.requis
        : o.pour + " pour, " + o.contre + " contre, " + o.abstentions + " abstentions";
      base.groups = o.groupes.map(function (g) {
        var votants = g.pour + g.contre + g.abstentions;
        return {
          label: g.nom, groupe: g.groupe, famille: g.famille, pos: g.position, cohesion: g.cohesion,
          detail: votants ? g.pour + " pour, " + g.contre + " contre, " + g.abstentions + " abst." : "aucun votant"
        };
      });
    } else if (m) {
      base.date = m.date;
      base.chamber = m.chamber;
      base.result = m.result;
      base.count = m.count;
      base.groups = m.positions.map(function (p) {
        return { label: p.familles.map(function (f) { return D.groups[f] || f; }).join(", "), familles: p.familles, pos: p.pos };
      });
    }
    return base;
  }
  D.votes = MD.votesCles.map(normalizeVote).filter(function (v) { return v.date; });

  var POS_LABEL = {
    pour: "Pour", contre: "Contre", abstention: "Abstention", divise: "Divisé", partage: "Partagé",
    "non-votant": "Non-votant", absent: "Absent", aucun: "N’a pas voté", autre: "Inconnu"
  };
  var POS_CLASS = { pour: "pour", contre: "contre", abstention: "abstention", divise: "divise", partage: "divise" };

  function posPill(pos) {
    var key = pos || "aucun";
    return '<span class="pos pos-' + (POS_CLASS[key] || "autre") + '">' + (POS_LABEL[key] || key) + "</span>";
  }

  // Un groupe est présenté comme divisé quand moins des deux tiers de ses votants ont suivi la position.
  function divided(g) { return g.cohesion !== null && g.cohesion !== undefined && g.cohesion < 67; }

  function groupPos(v, family) {
    for (var i = 0; i < v.groups.length; i++) {
      var g = v.groups[i];
      if (g.famille === family || (g.familles && g.familles.indexOf(family) !== -1)) return g;
    }
    return null;
  }

  function candData(c) { return MD.candidats[c.id] || { depute: false, votesCles: {}, mandats: [] }; }

  // Rôle affiché sous le nom : tiré des données officielles pour les députés.
  function role(c) {
    var cd = candData(c);
    if (cd.depute) {
      var last = cd.mandats[cd.mandats.length - 1];
      return last && !last.fin ? "Siège à l’Assemblée" : "A siégé (" + cd.mandats[0].debut.slice(0, 4) + "-" + (last.fin || "").slice(0, 4) + ")";
    }
    return { PE: "Parlement européen", "Sénat": "Sénat" }[c.filter] || "Sans mandat de député";
  }

  // Son vote s'il siégeait, sinon celui de son groupe (toujours signalé comme tel).
  function candVote(v, c) {
    var perso = candData(c).votesCles[v.id];
    if (perso && perso.siegeait) return { pos: perso.position, who: "Son vote", personal: true };
    var g = groupPos(v, c.group);
    return { pos: g ? g.pos : "autre", who: "Vote du groupe" + (g && g.groupe ? " " + g.groupe : "") + (g && divided(g) ? ", divisé" : ""), personal: false };
  }

  function voteItem(v, c) {
    var cv = candVote(v, c);
    return '<a class="vote-item" href="' + esc(v.official || v.source.url) + '" target="_blank" rel="noopener"><span><span class="t">' + esc(v.title) + "</span>" +
      '<span class="m">' + fmtDate(v.date) + " · " + esc(cv.who) + " ↗</span></span>" + posPill(cv.pos) + "</a>";
  }

  function groupNote(c) {
    var g = D.groups[c.group];
    return candData(c).depute
      ? "Quand " + c.name + " siégeait à l’Assemblée, c’est son vote personnel qui est affiché. Sinon, celui du groupe " + g + ", à titre de contexte."
      : c.name + " n’a pas siégé à l’Assemblée nationale depuis 2022 : ce sont les votes du groupe " + g + ", donnés comme contexte, pas ses votes.";
  }

  function voteCard(v) {
    var rows = v.groups.map(function (g) {
      return "<div>" + posPill(g.pos) + "<span>" + esc(g.label) +
        (g.detail ? " <em>(" + esc(g.detail) + (divided(g) ? ", divisé" : "") + ")</em>" : "") + "</span></div>";
    }).join("");
    return '<article class="box flat">' +
      '<p class="eb">' + esc(v.chamber) + " · " + fmtDate(v.date) + "</p>" +
      '<h3 class="vote-title">' + esc(v.title) + '</h3><p class="cap">' + withTerms(v.context) + "</p>" +
      '<p class="vote-summary">' + withTerms(v.summary) + "</p>" +
      '<span class="result">' + esc(v.result) + " · " + esc(v.count) + "</span>" +
      '<div class="groups">' + rows + "</div>" +
      (v.after ? '<p class="note">' + withTerms(v.after) + "</p>" : "") +
      (v.official ? '<a class="link" href="' + esc(v.official) + '" target="_blank" rel="noopener">Scrutin officiel (Assemblée nationale) ↗</a>' : "") +
      '<a class="link" href="' + esc(v.source.url) + '" target="_blank" rel="noopener">Pour comprendre : ' + esc(v.source.label) + " ↗</a>" +
      "</article>";
  }

  // ---------- Briques d'écran ----------

  function foot() {
    return '<p class="foot">Sans compte. Aucune donnée personnelle collectée. Chaque information renvoie à sa source officielle.<br>' +
      "Votes à jour au " + (MD.dernierScrutin ? fmtDate(MD.dernierScrutin) : esc(D.updatedAt)) + ' · <a href="#/methode">Comment on décide</a> · <a href="#/lexique">Lexique</a></p>';
  }

  function topbar(back, title, right) {
    return '<div class="topbar"><div style="display:flex;align-items:center;gap:12px">' +
      (back ? '<a class="round-btn" href="' + back + '" aria-label="Retour">' + icon(I.back, 20) + "</a>" : "") +
      (title ? '<span class="topbar-title">' + title + "</span>" : "") + "</div>" + (right || "") + "</div>";
  }

  function pending(label) { return '<span class="verdict">' + (label || "En attente") + "</span>"; }

  // ---------- Accueil ----------

  var debateChoice = null; // réponse au débat du jour : en mémoire seulement, jamais enregistrée

  function debateButtons(prefix) {
    return '<div class="choice3" role="group" aria-label="Ta réponse">' +
      [["pour", "Pour", " dark"], ["contre", "Contre", ""], ["nsp", "Je ne sais pas", " unsure"]].map(function (o) {
        return '<button type="button" class="choice' + o[2] + '" data-debate="' + o[0] + '"' + (prefix ? ' data-go="debat"' : "") +
          ' aria-pressed="' + (debateChoice === o[0]) + '">' + o[1] + "</button>";
      }).join("") + "</div>";
  }

  function home() {
    var seen = seenThemes();
    var topics = D.themes.map(function (t) {
      var done = seen.indexOf(t.id) !== -1;
      return '<a class="topic' + (done ? " done" : "") + '" href="#/sujets/' + t.id + '">' + esc(t.label) + '<span aria-hidden="true">' + (done ? "✓" : "+") + "</span></a>";
    }).join("");
    return '<div class="screen enter">' +
      topbar(null, null, "").replace('<div style="display:flex;align-items:center;gap:12px"></div>',
        '<a class="brand" href="#/">' + esc(D.appName) + '</a><span class="pill-dark" title="1er tour le ' + fmtDate(D.electionDate) + (D.electionDateProvisional ? ", date provisoire" : "") + '">J–' + daysLeft() + "<span>avant le vote</span></span>") +
      '<section class="box" aria-label="Débat du jour">' +
      '<span class="tag plain" style="align-self:flex-start;padding:4px 10px;font-size:12px">' + icon(I.chat, 14) + "Débat du jour</span>" +
      '<p class="debate-q">' + esc(D.debate.question) + "</p>" + debateButtons(true) + "</section>" +
      '<a class="quiz-hero" href="#/quiz"><span class="quiz-chip">' + icon(I.list, 14) + D.quiz.length + " questions</span>" +
      '<span class="quiz-title">Qui a voté ça ?</span>' +
      '<span class="quiz-row"><span>Voyons si tu connais bien les candidats pour 2027.</span><span class="play-btn">Jouer' + icon(I.arrow, 18) + "</span></span></a>" +
      '<section style="display:flex;flex-direction:column;gap:10px"><div class="section-head"><h2 class="h2" style="font-size:18px">Complète 3 sujets</h2><span>' + Math.min(seen.length, 3) + " / 3</span></div>" +
      '<div class="topics">' + topics + "</div></section>" +
      '<nav class="nav-tiles" aria-label="Comparer">' +
      '<a class="nav-tile dark" href="#/sujets">' + icon(I.grid) + "<span>Par sujet</span></a>" +
      '<a class="nav-tile" href="#/candidats">' + icon(I.person) + "<span>Par candidat</span></a>" +
      '<a class="nav-tile" href="#/programmes">' + icon(I.doc) + "<span>Programmes</span></a></nav>" +
      foot() + "</div>";
  }

  // ---------- Débat du jour ----------

  function debate() {
    var v = byId(D.votes, D.debate.vote);
    var labels = { pour: "Pour", contre: "Contre", nsp: "Je ne sais pas" };
    var html = '<div class="screen enter">' +
      '<section style="display:flex;flex-direction:column;gap:16px"><span class="tag plain" style="align-self:flex-start">Débat du jour</span>' +
      '<h1 class="debate-title">' + esc(D.debate.question) + "</h1>" + debateButtons(false) + "</section>";
    if (!debateChoice) {
      return html + '<p class="note">Réponds pour voir comment les candidats ont voté sur ce sujet.</p>' + foot() + "</div>";
    }
    html += '<div class="private-note">' + icon(I.lock, 20) + "<span>Ta réponse : <b>" + labels[debateChoice] +
      "</b>. Elle reste sur ton téléphone : on ne l’enregistre nulle part et on ne publie aucun résultat.</span></div>";
    if (v) {
      html += '<section style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="section-head"><h2 class="h2">Et les candidats ?</h2><span>Tient parole ?</span></div>' +
        '<div class="text-card"><span class="eb">Le texte voté</span><span class="t">' + esc(v.title) + "</span>" +
        '<span class="m">' + esc(v.chamber) + " · " + fmtDate(v.date) + " · " + esc(v.result) + ", " + esc(v.count) +
        (v.official ? ' · <a href="' + esc(v.official) + '" target="_blank" rel="noopener" style="font-weight:700">Source ↗</a>' : "") + "</span></div>" +
        D.candidates.map(function (c) {
          var cv = candVote(v, c);
          return '<article class="cand-line"><span><span class="n">' + esc(c.name) + '</span><span class="d">Promet <b>—</b> · ' +
            (cv.personal ? "Vote <b>" + POS_LABEL[cv.pos || "aucun"] + "</b>" : esc(cv.who) + " : <b>" + POS_LABEL[cv.pos || "aucun"] + "</b>") +
            "</span></span>" + pending() + "</article>";
        }).join("") +
        '<p class="cap">« Tient parole ? » s’affichera quand les programmes 2027 seront publiés : on comparera alors chaque promesse aux votes.</p></section>';
    }
    return html + '<button type="button" class="btn-dark" data-share-debate>' + icon(I.share, 20) + "Partager</button>" + foot() + "</div>";
  }

  // ---------- Sujets ----------

  function topics() {
    var seen = seenThemes();
    return '<div class="screen enter">' + topbar(null, "Par sujet") +
      '<h1 class="h1" style="font-size:34px">Quel sujet <span>te parle</span> ?</h1>' +
      '<div class="tiles stagger">' + D.themes.map(function (t) {
        return '<a class="tile' + (seen.indexOf(t.id) !== -1 ? " seen" : "") + '" href="#/sujets/' + t.id + '"><span class="tile-icon">' + icon(t.icon) + '</span><span class="tile-label">' + esc(t.label) + "</span></a>";
      }).join("") + "</div>" + foot() + "</div>";
  }

  var sortBy = null;
  var MANDATE_ORDER = ["AN", "AN (2022-2024)", "PE", "Sénat", "Pas de mandat"];
  function sortedCandidates() {
    var list = D.candidates.slice();
    if (sortBy === "nom") list.sort(function (a, b) { return a.name.localeCompare(b.name, "fr"); });
    if (sortBy === "parti") list.sort(function (a, b) { return a.party.localeCompare(b.party, "fr"); });
    if (sortBy === "mandat") list.sort(function (a, b) { return MANDATE_ORDER.indexOf(a.filter) - MANDATE_ORDER.indexOf(b.filter); });
    return list;
  }

  function topic(id) {
    var t = byId(D.themes, id);
    if (!t) return notFound();
    markSeen(t.id);
    var votes = D.votes.filter(function (v) { return v.theme === t.id; });
    var seg = [["nom", "Nom"], ["parti", "Parti"], ["mandat", "Mandat"]].map(function (s) {
      return '<button type="button" data-sort="' + s[0] + '" aria-pressed="' + (sortBy === s[0]) + '">' + s[1] + "</button>";
    }).join("");
    var cards = sortedCandidates().map(function (c) {
      return '<article class="box">' +
        '<div class="cand-head"><span class="avatar" aria-hidden="true">' + initials(c.name) + "</span><div>" +
        '<a class="name-tag" href="#/candidats/' + c.id + '" style="text-decoration:none">' + esc(c.name) + '</a><span class="meta">' + esc(c.party) + " · " + esc(role(c)) + "</span></div></div>" +
        '<div class="promise"><div class="promise-row"><span>Promesse 2027 : pas encore publiée</span>' + pending() + "</div>" +
        (votes.length ? '<div class="vote-list">' + votes.map(function (v) { return voteItem(v, c); }).join("") + "</div>"
          : '<div class="vote-list"><p class="cap">Aucun vote clé sur ce sujet pour l’instant.</p></div>') +
        "</div></article>";
    }).join("");
    return '<div class="screen enter">' +
      topbar("#/sujets", null, "").replace("</a></div>", '</a><span class="tag">' + icon(t.icon, 18) + esc(t.label) + "</span></div>") +
      '<h1 class="h1">Qui vote quoi sur<br><span>' + esc(t.sur) + "</span> ?</h1>" +
      '<p class="note">' + esc(t.questions) + "</p>" +
      '<div class="segmented" role="group" aria-label="Trier les candidats">' + seg + "</div>" +
      cards +
      '<h2 class="h2">Les votes en détail</h2>' +
      (votes.length ? votes.map(voteCard).join("") : '<div class="empty"><strong>Aucun vote clé sur ce sujet pour l’instant.</strong>Les votes de l’Assemblée sont collectés chaque nuit ; l’équipe choisit ceux qui comptent pour chaque sujet.</div>') +
      foot() + "</div>";
  }

  // ---------- Candidats ----------

  function candidates() {
    return '<div class="screen enter">' + topbar(null, "Par candidat") +
      '<h1 class="h1" style="font-size:34px">Qui veux-tu <span>checker</span> ?</h1>' +
      '<div class="people stagger">' + D.candidates.map(function (c) {
        return '<a class="person" href="#/candidats/' + c.id + '"><span class="avatar" aria-hidden="true">' + initials(c.name) + '</span><span class="n">' + esc(c.name) + '</span><span class="p">' + esc(c.party) + "<br>" + esc(role(c)) + "</span></a>";
      }).join("") + "</div>" +
      '<p class="cap">Principaux candidats déclarés ou pressentis au ' + esc(D.updatedAt) + ". Ordre alphabétique, aucune couleur de parti. La liste officielle viendra au printemps 2027, après les <button type=\"button\" class=\"term\" data-term=\"6\">parrainages</button>.</p>" +
      foot() + "</div>";
  }

  var openTopic = null;

  function candidate(id) {
    var c = byId(D.candidates, id);
    if (!c) return notFound();
    var cd = candData(c);
    var sol = cd.participation ? cd.participation.solennels : null;
    var all = cd.participation ? cd.participation.tous : null;
    var med = MD.medianeSolennels && MD.medianeSolennels.taux;
    var ring = '<div class="ring"><svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="52" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="14" stroke-dasharray="6 7"/></svg><span class="ring-center">—</span></div>';

    var assemblee = cd.depute
      ? '<div class="stats"><div class="stat"><b class="accent">' + (sol && sol.taux !== null ? pct(sol.taux) : "—") + "</b><span>des grands votes</span></div>" +
        '<div class="stat"><b>' + (all ? all.votes : "—") + "</b><span>votes à l’Assemblée</span></div></div>" +
        (sol && sol.taux !== null ? '<div class="bar" aria-hidden="true"><div class="bar-fill" style="width:' + sol.taux + '%"></div>' +
          (med ? '<span class="bar-median" style="left:' + med + '%"></span>' : "") + "</div>" : "") +
        '<p class="cap">Participation aux scrutins solennels pendant son mandat : ' + (sol ? sol.votes + " sur " + sol.scrutins : "—") +
        (med ? ". Le trait noir marque la médiane de l’hémicycle (" + pct(med) + ")" : "") + ".</p>" +
        cd.mandats.map(function (m) {
          return '<div class="kv"><span>Mandat de député, ' + esc(m.legislature) + "e législature</span><span>" + fmtDate(m.debut) + " – " + (m.fin ? fmtDate(m.fin) : "auj.") + "</span></div>";
        }).join("") + '<p class="cap">Source : Assemblée nationale. Un député qui entre au gouvernement quitte son siège.</p>'
      : '<p class="note">Pas de mandat de député depuis 2022 : pas de votes à l’Assemblée à afficher.</p>' +
        '<div class="kv"><span>' + esc(c.mandate) + '<span class="flag">à vérifier</span></span><span>' + esc(c.filter) + "</span></div>";

    var acc = D.themes.map(function (t) {
      var votes = D.votes.filter(function (v) { return v.theme === t.id; });
      var open = openTopic === t.id;
      return '<div class="acc"><button type="button" class="acc-head" data-acc="' + t.id + '" aria-expanded="' + open + '">' +
        '<span class="tile-icon">' + icon(t.icon, 18) + '</span><span class="l">' + esc(t.label) + '</span><span class="c">' +
        (votes.length ? votes.length + " vote" + (votes.length > 1 ? "s" : "") : "—") + " " + (open ? "▴" : "▾") + "</span></button>" +
        (open ? '<div class="acc-body"><div class="promise-row" style="padding:4px 0"><span>Promesse 2027 : pas encore publiée</span>' + pending() + "</div>" +
          (votes.length ? votes.map(function (v) { return voteItem(v, c); }).join("") : '<p class="cap">Aucun vote clé sur ce sujet pour l’instant.</p>') + "</div>" : "") +
        "</div>";
    }).join("");

    var related = D.votes.filter(function (v) {
      var perso = cd.votesCles[v.id];
      return (perso && perso.siegeait) || groupPos(v, c.group);
    });

    return '<div class="screen enter">' + topbar("#/candidats", "Son bilan") +
      '<section class="bilan"><div class="cand-head"><span class="avatar lg" aria-hidden="true">' + initials(c.name) + '</span><div><span class="name-tag">' + esc(c.name) + '</span><span class="meta">' + esc(c.party) + " · " + esc(role(c)) + "</span></div></div>" +
      '<div class="ring-row">' + ring + '<div class="ring-text"><b>Promesses tenues</b><span>En attente : son programme 2027 n’est pas encore publié. On comparera chaque promesse à ses votes.</span></div></div></section>' +
      '<section class="box flat"><p class="eb">À l’Assemblée nationale</p>' + assemblee + "</section>" +
      '<section style="display:flex;flex-direction:column;gap:10px"><h2 class="h2">Sujet par sujet</h2><div class="stagger" style="display:flex;flex-direction:column;gap:10px">' + acc + "</div></section>" +
      '<section class="box flat"><p class="eb">' + (cd.depute ? "Ses votes clés" : "Votes clés de son groupe") + '</p><p class="group-note">' + esc(groupNote(c)) + "</p>" +
      '<div style="display:flex;flex-direction:column;gap:6px">' + related.map(function (v) { return voteItem(v, c); }).join("") + "</div>" +
      (D.votes.length - related.length ? '<p class="cap">' + (D.votes.length - related.length) + " vote(s) clé(s) sans position connue pour ce groupe.</p>" : "") +
      "</section>" + foot() + "</div>";
  }

  // ---------- Quiz ----------

  var quiz = null;

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function newQuiz() { quiz = { order: shuffle(D.quiz), i: 0, results: [], picked: null, streak: 0, points: 0 }; }

  function confetti() {
    var colors = ["#FFEF9F", "#FFFFFF", "#E3F4E9", "#FFE8D6", "#1D4ED8", "#E5484D"];
    var s = "";
    for (var i = 0; i < 14; i++) {
      s += '<span class="qz-conf" style="left:' + (6 + i * 6.6) + "%;background:" + colors[i % colors.length] + ";animation-delay:" + ((i % 5) * 0.12) + 's"></span>';
    }
    return '<div class="confetti" aria-hidden="true">' + s + "</div>";
  }

  function quizScreen() {
    if (!quiz) newQuiz();
    if (quiz.i >= quiz.order.length) return quizEnd();
    var q = quiz.order[quiz.i];
    var v = byId(D.votes, q.vote);
    var picked = quiz.picked;
    var answered = picked !== null;
    var win = answered && picked === q.answer;
    var slips = quiz.order.map(function (x, n) {
      var cls = n < quiz.results.length ? (quiz.results[n] ? "done" : "miss") : n === quiz.i ? "now" : "";
      return '<span class="' + cls + '"></span>';
    }).join("");
    var opts = q.options.map(function (label, k) {
      var cls = "option", stamp = "";
      if (answered) {
        if (k === q.answer) { cls += " right"; stamp = '<span class="stamp ok qz-pop">Bingo</span>'; }
        else if (k === picked) { cls += " wrong"; stamp = '<span class="stamp ko qz-pop">Raté</span>'; }
        else cls += " dim";
      }
      return '<button type="button" class="' + cls + '" data-pick="' + k + '"' + (answered ? " disabled" : "") + ">" + esc(label) + stamp + "</button>";
    }).join("");
    return '<div class="screen enter">' +
      '<div class="quiz-top"><div class="quiz-slips" aria-label="Question ' + (quiz.i + 1) + " sur " + quiz.order.length + '">' + slips + "</div>" +
      '<span class="streak">' + icon(I.flame, 16) + quiz.streak + " d’affilée</span></div>" +
      '<div class="question"><span class="eb">' + esc(v.chamber) + " · " + fmtMonth(v.date) + "</span>" +
      "<blockquote>« " + esc(v.title) + ' »</blockquote><p class="vote-summary">' + withTerms(v.summary) + "</p>" +
      '<p class="ask">' + esc(q.prompt) + "</p></div>" +
      '<div class="options">' + opts + "</div>" +
      (answered ? '<div class="feedback qz-pop" style="transform:none;animation-name:mx-in" role="status"><span><span class="v">' + (win ? "Bien vu !" : "Presque ! C’était : " + esc(q.options[q.answer])) + "</span>" +
        "<p>" + esc(q.explain) + ' <a class="link" href="' + esc(v.official || v.source.url) + '" target="_blank" rel="noopener">' + (v.official ? "Scrutin officiel ↗" : "Source ↗") + "</a></p></span>" +
        '<span class="points">' + (win ? "+10" : "+0") + "</span></div>" : "") +
      '<button type="button" class="next-btn" data-next>' + (answered ? (quiz.i + 1 < quiz.order.length ? "Question suivante" : "Voir mon score") : "Passer") + "</button>" +
      (win ? confetti() : "") +
      "</div>";
  }

  function quizEnd() {
    var n = quiz.order.length;
    var score = quiz.results.filter(Boolean).length;
    var ballots = quiz.results.map(function (ok, i) {
      var rot = [-4, 3, -2, 5, -3, 2, -5, 3, -2, 4][i % 10];
      return ok
        ? '<div class="ballot" style="transform:rotate(' + rot + 'deg)"><i style="width:80%"></i><i style="width:55%"></i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>'
        : '<div class="ballot ko" style="transform:rotate(' + rot + 'deg)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></div>';
    }).join("");
    return '<div class="screen enter">' + topbar(null, "Ton score") +
      '<div class="story" id="story">' +
      '<div class="story-top"><span class="tag">Qui a voté ça ?</span><span style="font-weight:800">' + quiz.points + " pts</span></div>" +
      '<div class="score-card"><span>J’ai trouvé</span><span class="score-num">' + score + "<small>/ " + n + "</small></span><span>votes de l’Assemblée.</span></div>" +
      '<div class="ballots" aria-label="' + score + " bonnes réponses sur " + n + '">' + ballots + "</div>" +
      '<p class="story-line">Qui dit mieux ?</p>' +
      '<div class="story-foot"><span>' + esc(D.appName) + "</span><span>" + esc(location.host || "marian.fr") + "</span></div>" +
      "</div>" +
      '<button type="button" class="btn-dark" data-share>' + icon(I.share, 20) + "Partager</button>" +
      '<button type="button" class="next-btn" data-restart>Rejouer</button>' +
      '<p class="cap">Fais une capture de la carte pour la poster en story. Ton score n’est enregistré nulle part.</p>' +
      "</div>";
  }

  // ---------- Programmes ----------
  // Section à part : des mesures recopiées mot pour mot, sans lien avec les candidats ni les votes.
  // Le texte vient de data/programmes.js, écrit par agents/verification/programmes.py après vérification.

  var PR = window.MARIAN_PROGRAMMES || { partis: [] };
  var PARTIS = PR.partis.slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); });

  function progStatus(p) {
    if (p.statut === "publie") return p.mesures.length + " mesure" + (p.mesures.length > 1 ? "s" : "");
    if (p.statut === "pas-publie") return "Programme pas encore publié";
    if (p.statut === "en-cours") return "En cours d’ajout";
    return "Pas encore ajouté";
  }

  function programmes() {
    return '<div class="screen enter">' + topbar(null, "Programmes") +
      '<h1 class="h1" style="font-size:34px">Ce qu’ils <span>proposent</span></h1>' +
      '<p class="note">Les mesures sont recopiées mot pour mot depuis le programme de chaque parti. On ne résume pas et on ne choisit pas : ce sont les mesures clés désignées par le parti, ou, s’il n’en désigne pas, la première mesure de chaque chapitre.</p>' +
      '<div class="people stagger">' + PARTIS.map(function (p) {
        return '<a class="person' + (p.statut === "publie" ? "" : " off") + '" href="#/programmes/' + p.id + '"><span class="n">' + esc(p.nom) + '</span><span class="p">' + esc(progStatus(p)) + "</span></a>";
      }).join("") + "</div>" +
      '<p class="cap">Ordre alphabétique, aucune couleur de parti.</p>' + foot() + "</div>";
  }

  function programme(id) {
    var p = byId(PARTIS, id);
    if (!p) return notFound();
    var head = '<section class="box flat"><p class="eb">Programme</p><span class="name-tag">' + esc(p.nom) + "</span>" +
      (p.programme ? '<span class="meta">' + esc(p.programme) + "</span>" : "") + "</section>";
    if (p.statut !== "publie") {
      return '<div class="screen enter">' + topbar("#/programmes", "Programme") + head +
        '<div class="empty"><strong>' + esc(progStatus(p)) + "</strong>" +
        (p.statut === "pas-publie" ? "Ce parti n’a pas encore publié de programme pour 2027."
          : "Ses mesures s’afficheront ici une fois recopiées et vérifiées mot pour mot.") + "</div>" + foot() + "</div>";
    }
    var srcs = {};
    p.sources.forEach(function (s) { srcs[s.id] = s; });
    var rule = p.structure === "mesures-cles"
      ? "Les mesures que le parti présente lui-même comme « " + esc(p.libelle) + " », dans son ordre."
      : "Ce parti ne désigne pas de mesures prioritaires. On affiche <b>la première mesure de chaque chapitre</b> de son programme, dans l’ordre. Ce n’est pas un choix de l’équipe." +
        (p.regle ? "<br>" + esc(p.regle) : "");
    var items = p.mesures.map(function (m) {
      return '<article class="box flat measure">' +
        '<p class="eb">' + (m.chapitre ? esc(m.chapitre) : "Mesure " + m.ordre) + "</p>" +
        (m.titre ? '<h3 class="vote-title">' + esc(m.titre) + "</h3>" : "") +
        '<p class="measure-text">' + esc(m.texte) + "</p>" +
        '<a class="link" href="' + esc(m.url) + '" target="_blank" rel="noopener">Lire dans le programme' +
        (m.page ? ", page " + m.page : "") + " ↗</a></article>";
    }).join("");
    return '<div class="screen enter">' + topbar("#/programmes", "Programme") + head +
      '<p class="group-note">' + rule + "</p>" +
      '<div class="stagger" style="display:flex;flex-direction:column;gap:12px">' + items + "</div>" +
      '<section class="box flat"><p class="eb">Sources</p>' + p.sources.map(function (s) {
        return '<div class="kv"><a class="link" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.titre) + " ↗</a><span>consulté le " + fmtDate(s.consulte_le) + "</span></div>";
      }).join("") +
      '<p class="cap">Texte reproduit sans modification. Vérifié par un programme le ' + fmtDate(PR.verifieLe) +
      " : chaque mesure a été retrouvée mot pour mot dans la source archivée.</p></section>" +
      '<a class="btn-dark" href="https://github.com/SimonPelissier/agenticIA-VF/issues/new" target="_blank" rel="noopener">Signaler une erreur</a>' +
      foot() + "</div>";
  }

  // ---------- Méthode, lexique ----------

  function method() {
    return '<div class="screen enter">' + topbar("#/", "Comment on décide") +
      '<p class="note" style="font-size:16px">On compare sa promesse à ses votes depuis 2022. C’est tout.</p>' +
      '<div class="rules">' +
      '<div class="rule"><span class="verdict oui">Oui</span><span>La plupart de ses votes vont dans le sens de sa promesse.</span></div>' +
      '<div class="rule"><span class="verdict non">Non</span><span>La plupart de ses votes vont contre.</span></div>' +
      '<div class="rule"><span class="verdict">Pas de vote</span><span>Moins de 3 votes, ou pas de mandat. On ne juge pas.</span></div>' +
      '<div class="rule"><span class="verdict">En attente</span><span>Le programme 2027 n’est pas encore publié : c’est le cas de tous les candidats aujourd’hui.</span></div>' +
      "</div>" +
      '<section class="box flat"><p class="eb">Nos règles</p><ul class="list">' +
      "<li>Une source par information, cliquable. Pas de source, pas de publication.</li>" +
      "<li>Aucune consigne de vote. On compare chaque candidat à ses propres promesses, jamais les candidats entre eux.</li>" +
      "<li>Ordre alphabétique, jamais par sondage. Aucune couleur de parti.</li>" +
      "<li>Quand un candidat a siégé, on affiche son vote personnel. Sinon, on l’écrit : les votes de son groupe sont du contexte, pas ses votes.</li>" +
      "<li>Les chiffres des votes viennent des données ouvertes de l’Assemblée nationale, collectées chaque nuit et relues avant publication.</li>" +
      "<li>Les textes préparés avec l’IA sont relus et validés par l’équipe.</li>" +
      "<li>Les programmes sont recopiés mot pour mot, jamais résumés. Un programme vérifie que chaque mesure se trouve telle quelle dans la source.</li>" +
      "<li>Sans compte. Le quiz et le débat se jouent dans ton navigateur : rien n’est envoyé, aucun résultat n’est publié.</li>" +
      "</ul></section>" +
      '<a class="btn-dark" href="https://github.com/SimonPelissier/agenticIA-VF/issues/new" target="_blank" rel="noopener">Signaler une erreur</a>' +
      foot() + "</div>";
  }

  function lexicon() {
    return '<div class="screen enter">' + topbar("#/methode", "Lexique") +
      '<h1 class="h1">Les mots <span>compliqués</span></h1>' +
      '<section class="box flat"><dl class="gloss">' + D.glossary.map(function (g) {
        return "<div><dt>" + esc(g.term) + "</dt><dd>" + esc(g.def) + "</dd></div>";
      }).join("") + "</dl></section>" + foot() + "</div>";
  }

  function notFound() {
    return '<div class="screen">' + topbar("#/", "Page introuvable") + '<a class="btn-dark" href="#/">Retour à l’accueil</a></div>';
  }

  // ---------- Routeur ----------

  var TAB = { "": "accueil", debat: "debat", quiz: "quiz", sujets: "sujets", themes: "sujets", candidats: "candidats", programmes: "programmes" };

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var html;
    switch (parts[0]) {
      case "": html = home(); break;
      case "debat": html = debate(); break;
      case "sujets": case "themes": html = parts[1] ? topic(parts[1]) : topics(); break;
      case "candidats": html = parts[1] ? candidate(parts[1]) : candidates(); break;
      case "programmes": html = parts[1] ? programme(parts[1]) : programmes(); break;
      case "quiz": html = quizScreen(); break;
      case "methode": html = method(); break;
      case "lexique": html = lexicon(); break;
      default: html = notFound();
    }
    app.innerHTML = html;
    var tab = TAB[parts[0]] || "";
    var links = document.querySelectorAll(".tabbar a");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("data-tab") === tab) links[i].setAttribute("aria-current", "page");
      else links[i].removeAttribute("aria-current");
    }
  }

  function rerender() {
    var y = window.scrollY;
    route();
    // Pas d'animation d'entrée quand on met seulement à jour l'écran en cours.
    var e = app.querySelector(".enter");
    if (e) e.classList.remove("enter");
    window.scrollTo(0, y);
  }

  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });

  // ---------- Interactions ----------

  var sheet = document.getElementById("sheet");
  var lastFocus = null;

  function openTerm(i) {
    var g = D.glossary[i];
    if (!g) return;
    lastFocus = document.activeElement;
    document.getElementById("sheet-title").textContent = g.term;
    document.getElementById("sheet-body").textContent = g.def;
    sheet.hidden = false;
    sheet.querySelector(".btn-dark").focus();
  }

  function closeSheet() {
    sheet.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  function share(text, btn) {
    var url = location.href.split("#")[0];
    if (navigator.share) {
      navigator.share({ title: D.appName, text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + " " + url).then(function () { btn.textContent = "Lien copié"; }, function () {});
    }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-term],[data-close],[data-debate],[data-sort],[data-acc],[data-pick],[data-next],[data-restart],[data-share],[data-share-debate]");
    if (!t) return;
    if (t.hasAttribute("data-term")) openTerm(+t.getAttribute("data-term"));
    else if (t.hasAttribute("data-close")) closeSheet();
    else if (t.hasAttribute("data-debate")) {
      var choice = t.getAttribute("data-debate");
      debateChoice = debateChoice === choice && !t.hasAttribute("data-go") ? null : choice;
      if (t.hasAttribute("data-go")) location.hash = "#/debat"; else rerender();
    }
    else if (t.hasAttribute("data-sort")) { var s = t.getAttribute("data-sort"); sortBy = sortBy === s ? null : s; rerender(); }
    else if (t.hasAttribute("data-acc")) { var a = t.getAttribute("data-acc"); openTopic = openTopic === a ? null : a; rerender(); }
    else if (t.hasAttribute("data-pick")) {
      if (quiz.picked !== null) return;
      quiz.picked = +t.getAttribute("data-pick");
      var ok = quiz.picked === quiz.order[quiz.i].answer;
      quiz.results.push(ok);
      quiz.streak = ok ? quiz.streak + 1 : 0;
      quiz.points += ok ? 10 : 0;
      rerender();
    }
    else if (t.hasAttribute("data-next")) {
      if (quiz.picked === null) { quiz.results.push(false); quiz.streak = 0; } // « Passer » compte comme raté
      quiz.i++; quiz.picked = null; route(); window.scrollTo(0, 0);
    }
    else if (t.hasAttribute("data-restart")) { newQuiz(); route(); window.scrollTo(0, 0); }
    else if (t.hasAttribute("data-share")) {
      share("J’ai trouvé " + quiz.results.filter(Boolean).length + "/" + quiz.order.length + " à « Qui a voté ça ? » sur " + D.appName + ". Qui dit mieux ?", t);
    }
    else if (t.hasAttribute("data-share-debate")) share(D.debate.question + " Regarde comment les candidats ont voté sur " + D.appName + ".", t);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.hidden) closeSheet();
  });

  // Écran de chargement : une fois par visite, retiré au bout d'un instant ou au toucher.
  var splash = document.getElementById("splash");
  function hideSplash() {
    if (!splash || splash.classList.contains("out")) return;
    splash.classList.add("out");
    setTimeout(function () { splash.hidden = true; }, 400);
  }
  if (splash) {
    var shown = false;
    try { shown = sessionStorage.getItem("marian:splash") === "1"; sessionStorage.setItem("marian:splash", "1"); } catch (e) { /* ignoré */ }
    if (shown) splash.hidden = true;
    else {
      splash.addEventListener("click", hideSplash);
      splash.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") hideSplash(); });
      setTimeout(hideSplash, 1600);
    }
  }

  route();
})();
