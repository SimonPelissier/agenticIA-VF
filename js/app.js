// marIAn — design « V3 Colorful ». Sans compte ni serveur : tout est calculé dans le navigateur.
(function () {
  "use strict";

  var D = window.DATA;
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

  // Stockage local, uniquement sur l'appareil, pour la barre « thèmes explorés ».
  var STORE_KEY = "marian:themes-vus";
  function seenThemes() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
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

  // ---------- Icônes ----------

  var ARROW = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  var CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var BOX = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16v9H4z"/><path d="M9 11V4h6v7"/><path d="M8 15h8"/></svg>';
  var FILTER = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';
  var CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var CROSS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // Thermomètre à bulletin, état « en attente » : aucune promesse 2027 publiée, donc pas d'indice.
  var THERMO_EMPTY = '<svg viewBox="0 0 280 36" aria-hidden="true"><rect x="20" y="16" width="252" height="12" rx="6" fill="#fff" stroke="#796F91" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="14" cy="22" r="11" fill="#fff" stroke="#796F91" stroke-width="1.5" stroke-dasharray="4 3"/></svg>';
  var THERMO_MINI = '<svg width="72" height="22" viewBox="0 0 72 22" aria-hidden="true"><rect x="10" y="9" width="60" height="8" rx="4" fill="#fff" stroke="#796F91" stroke-width="1.3" stroke-dasharray="3 2"/><circle cx="7" cy="13" r="6" fill="#fff" stroke="#796F91" stroke-width="1.3" stroke-dasharray="3 2"/></svg>';

  function thermo() {
    return '<div class="thermo"><div class="thermo-top"><span class="thermo-state">En attente</span><span class="thermo-kind">Promesse vs votes</span></div>' +
      '<div class="thermo-text">Pas d’indice tant que le programme 2027 n’est pas publié.</div>' + THERMO_EMPTY +
      '<div class="thermo-scale"><span>+ souple</span><span>conforme</span><span>+ rigide</span></div></div>';
  }

  // ---------- Briques ----------

  var POS_LABEL = { pour: "Pour", contre: "Contre", abstention: "Abstention", divise: "Divisé", autre: "Autre" };

  function posPill(p) {
    if (!p) return '<span class="pos pos-autre">Non documenté</span>';
    return '<span class="pos pos-' + p.pos + '">' + POS_LABEL[p.pos] + "</span>";
  }

  function groupPos(v, group) {
    var hit = null;
    v.positions.forEach(function (p) { if (p.groups.indexOf(group) !== -1) hit = p; });
    return hit;
  }

  function sitsAtAN(c) { return c.filter === "AN"; }

  function groupNote(c) {
    var g = D.groups[c.group];
    return sitsAtAN(c)
      ? "Positions du groupe " + g + ". Le vote personnel de " + c.name + " sera ajouté depuis les scrutins publics."
      : c.name + " ne siège pas à l’Assemblée nationale : ce sont les votes du groupe " + g + ", donnés comme contexte.";
  }

  function voteRow(v, c) {
    var p = groupPos(v, c.group);
    return '<a class="row-link" href="' + esc(v.source.url) + '" target="_blank" rel="noopener"><span><span class="row-title">' + esc(v.title) + "</span>" +
      '<span class="row-meta">' + fmtDate(v.date) + (p && p.note ? " · " + esc(p.note) : "") + " · " + esc(v.source.label) + " ↗</span></span>" + posPill(p) + "</a>";
  }

  function voteCard(v) {
    var rows = v.positions.map(function (p) {
      var names = p.groups.map(function (g) { return D.groups[g] || g; }).join(", ");
      return "<div>" + posPill(p) + "<span>" + esc(names) + (p.note ? " <em>(" + esc(p.note) + ")</em>" : "") + "</span></div>";
    }).join("");
    return '<article class="card soft">' +
      '<p class="eb">Scrutin · ' + esc(v.chamber) + " · " + fmtDate(v.date) + "</p>" +
      '<div class="vote-head"><h3 class="vote-title">' + esc(v.title) + '</h3><p class="cap">' + withTerms(v.context) + "</p></div>" +
      '<p class="vote-summary">' + withTerms(v.summary) + "</p>" +
      '<span class="result">' + esc(v.result) + " · " + esc(v.count) + "</span>" +
      '<div class="groups">' + rows + "</div>" +
      (v.after ? '<p class="note">' + withTerms(v.after) + "</p>" : "") +
      (v.incomplete ? '<p class="cap">Positions des autres groupes à compléter.</p>' : "") +
      '<a class="link" href="' + esc(v.source.url) + '" target="_blank" rel="noopener">Source : ' + esc(v.source.label) + " ↗</a>" +
      "</article>";
  }

  function foot() {
    return '<p class="foot">Sans compte. Aucune donnée personnelle collectée.<br>Chaque information renvoie à sa source officielle.<br>' +
      "Données au " + esc(D.updatedAt) + ' · <a href="#/methode">Méthode</a> · <a href="#/lexique">Lexique</a></p>';
  }

  function backBar(href, label, right) {
    return '<div class="topbar"><a class="round-btn" href="' + href + '" aria-label="' + esc(label) + '">' + BACK + "</a>" + (right || "") + "</div>";
  }

  // ---------- Accueil ----------

  function home() {
    var seen = seenThemes().length;
    var seg = D.themes.map(function (t, i) { return '<span class="' + (i < seen ? "on" : "") + '"></span>'; }).join("");
    return '<div class="screen home">' +
      '<div class="home-head"><a class="brand" href="#/">' + esc(D.appName) + '</a><span class="pill">Présidentielle 2027</span></div>' +
      '<div class="card raised" style="gap:6px"><p class="eb">Compte à rebours</p>' +
      '<p class="count" aria-label="J moins ' + daysLeft() + ' jours">J-<span>' + daysLeft() + "</span></p>" +
      '<p class="count-sub">avant la présidentielle</p>' +
      (D.electionDateProvisional ? '<p class="cap">1er tour le ' + fmtDate(D.electionDate) + " · date provisoire</p>" : "") + "</div>" +
      '<h1 class="headline">Ce qu’ils promettent.<br><span>Ce qu’ils ont voté.</span></h1>' +
      '<nav class="nav-list" aria-label="Comparer">' +
      '<a class="nav-card dark" href="#/themes"><span><span class="nav-title">Par thème</span><span class="nav-sub">Logement, travail, climat…</span></span>' + ARROW + "</a>" +
      '<a class="nav-card" href="#/candidats"><span><span class="nav-title">Par candidat</span><span class="nav-sub">Mandats, présence, positions</span></span>' + ARROW + "</a>" +
      "</nav>" +
      '<a class="quiz-card" href="#/quiz"><span class="quiz-mark" aria-hidden="true">?</span><span><span class="quiz-title">Jouer à « Qui a voté ça ? »</span><span class="quiz-sub">' + D.quiz.length + " questions sur de vrais votes. Devine qui a voté quoi.</span></span></a>" +
      '<div><div class="progress-row"><span>Thèmes explorés</span><span>' + seen + " / " + D.themes.length + '</span></div><div class="seg" aria-hidden="true">' + seg + "</div></div>" +
      foot() + "</div>";
  }

  // ---------- Par thème ----------

  var sortBy = "nom";
  var MANDATE_ORDER = ["AN", "AN (2022-2024)", "PE", "Sénat", "Pas de mandat"];

  function sortedCandidates() {
    var list = D.candidates.slice();
    if (sortBy === "parti") list.sort(function (a, b) { return a.party.localeCompare(b.party, "fr"); });
    if (sortBy === "mandat") list.sort(function (a, b) { return MANDATE_ORDER.indexOf(a.filter) - MANDATE_ORDER.indexOf(b.filter); });
    return list;
  }

  function themeCandidate(c, votes) {
    return '<article class="card soft" style="gap:16px">' +
      '<div class="cand-head"><span class="avatar" aria-hidden="true">' + initials(c.name) + "</span>" +
      '<div style="min-width:0"><a class="cand-name" href="#/candidats/' + c.id + '">' + esc(c.name) + "</a>" +
      '<div class="cand-meta"><span class="party">' + esc(c.party) + '</span><span class="cand-role">' + esc(c.filter) + "</span></div></div></div>" +
      thermo() +
      '<div class="promise"><p class="eb">Promesse 2027</p><p>Pas encore publiée.</p><span class="cap">Citation exacte et page du programme dès sa publication.</span></div>' +
      '<div class="since"><p class="eb muted">Depuis 2022 · votes de son groupe</p>' +
      (votes.length ? "<div>" + votes.map(function (v) { return voteRow(v, c); }).join("") + "</div>" : '<p class="note">Aucun vote documenté sur ce thème pour l’instant.</p>') +
      '<p class="cap">' + esc(groupNote(c)) + "</p></div>" +
      "</article>";
  }

  function themes(id) {
    var theme = byId(D.themes, id) || D.themes[0];
    markSeen(theme.id);
    var votes = D.votes.filter(function (v) { return v.theme === theme.id; });
    var chips = D.themes.map(function (t) {
      return '<a class="chip" href="#/themes/' + t.id + '"' + (t.id === theme.id ? ' aria-current="true"' : "") + ">" + esc(t.label) + "</a>";
    }).join("");
    var seg = [["nom", "Par nom"], ["parti", "Par parti"], ["mandat", "Par mandat"]].map(function (s) {
      return '<button type="button" data-sort="' + s[0] + '" aria-pressed="' + (sortBy === s[0]) + '">' + s[1] + "</button>";
    }).join("");
    return '<div class="screen" style="padding:0;gap:0">' +
      '<div class="band">' + backBar("#/", "Retour à l’accueil") +
      '<p class="eb">Comparer par thème</p>' +
      '<nav class="chips" aria-label="Thèmes">' + chips + "</nav>" +
      "<h1>" + esc(theme.label) + '</h1><p class="lede">' + esc(theme.questions) + "</p>" +
      '<div class="filter-label">' + FILTER + 'Trier</div><div class="segmented" role="group" aria-label="Trier les candidats">' + seg + "</div>" +
      "</div>" +
      '<div class="list">' +
      sortedCandidates().map(function (c) { return themeCandidate(c, votes); }).join("") +
      '<h2 class="section-h">Les votes en détail</h2>' +
      (votes.length ? votes.map(voteCard).join("") : '<div class="empty"><strong>Aucun vote documenté sur ce thème.</strong>Les scrutins publics de l’Assemblée sont en cours de collecte.</div>') +
      foot() + "</div></div>";
  }

  // ---------- Par candidat ----------

  var candFilter = "Tous";
  function filterKey(c) { return c.filter.indexOf("AN") === 0 ? "AN" : c.filter; }

  function candidates() {
    var keys = [["Tous", "Tous"], ["AN", "Assemblée"], ["PE", "Parlement européen"], ["Sénat", "Sénat"], ["Pas de mandat", "Sans mandat"]];
    var list = D.candidates.filter(function (c) { return candFilter === "Tous" || filterKey(c) === candFilter; });
    return '<div class="screen">' + backBar("#/", "Retour à l’accueil", '<span class="pill">Par candidat</span>') +
      '<h1 class="headline" style="font-size:32px">Les candidats</h1>' +
      '<p class="note">Principaux candidats déclarés ou pressentis au ' + esc(D.updatedAt) + '. La liste officielle viendra au printemps 2027, après les <button type="button" class="term" data-term="6">parrainages</button>.</p>' +
      '<div class="chips" role="group" aria-label="Filtrer par mandat">' + keys.map(function (k) {
        return '<button type="button" class="chip" data-filter="' + esc(k[0]) + '"' + (k[0] === candFilter ? ' aria-current="true"' : "") + ">" + esc(k[1]) + "</button>";
      }).join("") + "</div>" +
      '<div class="card raised" style="padding:6px 20px"><div class="cand-list">' + (list.length ? list.map(function (c) {
        return '<a href="#/candidats/' + c.id + '"><span class="avatar" aria-hidden="true">' + initials(c.name) + '</span><span class="grow"><span class="cand-name" style="display:block">' + esc(c.name) + '</span><span class="cand-role">' + esc(c.party) + " · " + esc(c.status) + '</span></span><span class="mandate-tag">' + esc(c.filter) + "</span></a>";
      }).join("") : '<p class="note" style="padding:16px 0">Aucun candidat dans cette catégorie.</p>') + "</div></div>" +
      '<p class="cap">Ordre alphabétique. Aucune couleur de parti. Mandats en cours de vérification.</p>' + foot() + "</div>";
  }

  function candidate(id) {
    var c = byId(D.candidates, id);
    if (!c) return notFound();
    var related = D.votes.filter(function (v) { return groupPos(v, c.group); });
    var rows = D.themes.map(function (t) {
      return '<a class="theme-row" href="#/themes/' + t.id + '"><b>' + esc(t.label) + '</b><span class="mini-thermo">' + THERMO_MINI + "En attente</span></a>";
    }).join("");
    return '<div class="screen">' + backBar("#/candidats", "Tous les candidats", '<span class="pill" style="color:var(--mute)">Programme à venir</span>') +
      '<section class="card raised profile">' +
      '<div class="profile-head"><span class="avatar lg" aria-hidden="true">' + initials(c.name) + "</span><div>" +
      "<h1>" + esc(c.name) + '</h1><span class="party">' + esc(c.party) + '</span><p class="cap" style="padding:4px 0 0">' + esc(c.status) + "</p></div></div>" +
      '<div class="stats"><div><b class="accent">—</b><span>présence</span></div><div><b>' + related.length + "</b><span>votes suivis</span></div><div><b>—</b><span>amend.</span></div><div><b>—</b><span>propositions</span></div></div>" +
      '<p class="cap">« Votes suivis » : votes de son groupe documentés ici. Présence, amendements et propositions : collecte en cours (data.assemblee-nationale.fr).</p>' +
      "</section>" +
      '<section class="card"><p class="eb">Mandats depuis 2022</p><div>' +
      '<div class="kv"><span>' + esc(c.mandate) + (c.mandateVerified ? "" : '<span class="flag">à vérifier</span>') + "</span><span>" + esc(c.filter) + "</span></div>" +
      '<div class="kv"><span>Groupe à l’Assemblée</span><span>' + esc(D.groups[c.group]) + "</span></div>" +
      "</div></section>" +
      '<section class="card"><p class="eb">Position par thème</p><div>' + rows + "</div></section>" +
      '<section class="card yellow evo"><p class="eb">Évolution</p><h2>Ce qui a changé depuis 2022</h2>' +
      '<div class="evo-grid"><div><b>2022</b><p>Programme 2022 en cours de collecte.</p></div><div><b class="accent">2027</b><p>Programme 2027 pas encore publié.</p></div></div></section>' +
      '<section class="card"><p class="eb">Votes de son groupe</p><p class="group-note">' + esc(groupNote(c)) + "</p><div>" +
      related.map(function (v) { return voteRow(v, c); }).join("") + "</div>" +
      (D.votes.length - related.length ? '<p class="cap">' + (D.votes.length - related.length) + " vote(s) sans position documentée pour ce groupe.</p>" : "") +
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

  function newQuiz() { quiz = { order: shuffle(D.quiz), i: 0, results: [], picked: null }; }

  function slips() {
    return '<div class="slips" aria-label="Question ' + (quiz.i + 1) + " sur " + quiz.order.length + '">' + quiz.order.map(function (q, n) {
      var rot = [-4, 3, -2, 5, -3, 2, -5, 3, -2, 4][n % 10];
      if (n < quiz.results.length) return '<div class="slip ' + (quiz.results[n] ? "done" : "miss") + '" style="transform:rotate(' + rot + 'deg)"></div>';
      if (n === quiz.i) return '<div class="slip current" style="transform:translateY(-4px)"><i style="width:70%"></i><i style="width:45%"></i></div>';
      return '<div class="slip todo" style="transform:rotate(' + rot + 'deg)"></div>';
    }).join("") + "</div>";
  }

  function quizScreen() {
    if (!quiz) newQuiz();
    if (quiz.i >= quiz.order.length) return quizEnd();
    var q = quiz.order[quiz.i];
    var v = byId(D.votes, q.vote);
    var picked = quiz.picked;
    var answered = picked !== null;
    var opts = q.options.map(function (label, k) {
      var cls = "option";
      if (answered) cls += k === q.answer ? " right" : k === picked ? " wrong" : " dim";
      return '<button type="button" class="' + cls + '" data-pick="' + k + '"' + (answered ? " disabled" : "") + ">" + esc(label) + "</button>";
    }).join("");
    return '<div class="screen">' +
      '<div class="topbar"><a class="round-btn" href="#/" aria-label="Quitter le jeu">' + CLOSE + '</a><span class="ballot-pill">' + BOX + "Bulletin " + (quiz.i + 1) + " / " + quiz.order.length + "</span></div>" +
      slips() +
      '<div class="card raised question"><p class="eb">Scrutin · ' + esc(v.chamber) + " · " + fmtMonth(v.date) + "</p>" +
      "<blockquote>" + esc(v.title) + '</blockquote><p class="vote-summary">' + withTerms(v.summary) + "</p>" +
      '<p class="ask">' + esc(q.prompt) + "</p></div>" +
      '<div class="options">' + opts + "</div>" +
      (answered ? '<div class="feedback" role="status"><b>' + (picked === q.answer ? "Bien vu." : "Raté. C’était : " + esc(q.options[q.answer]) + ".") + "</b>" +
        "<p>" + esc(q.explain) + '</p><a class="link" href="' + esc(v.source.url) + '" target="_blank" rel="noopener">Voir le vote (' + esc(v.source.label) + ") ↗</a></div>" +
        '<button type="button" class="btn" data-next>' + (quiz.i + 1 < quiz.order.length ? "Question suivante" : "Voir mon score") + "</button>" : "") +
      "</div>";
  }

  function quizEnd() {
    var n = quiz.order.length;
    var score = quiz.results.filter(Boolean).length;
    var ballots = quiz.results.map(function (ok, i) {
      var rot = [-4, 3, -2, 5, -3, 2, -5, 3, -2, 4][i % 10];
      return ok
        ? '<div class="ballot" style="transform:rotate(' + rot + 'deg)"><i style="width:80%"></i><i style="width:55%"></i>' + CHECK + "</div>"
        : '<div class="ballot ko" style="transform:rotate(' + rot + 'deg)">' + CROSS + "</div>";
    }).join("");
    var host = location.host || "marian.fr";
    return '<div class="screen">' +
      '<div class="topbar"><a class="round-btn" href="#/" aria-label="Retour à l’accueil">' + CLOSE + '</a><span class="pill">Ton score</span></div>' +
      '<div class="story" id="story">' +
      '<span class="pill">Qui a voté ça ?</span>' +
      '<div class="score-card"><span>J’ai trouvé</span><span class="score-num">' + score + "<small>/ " + n + "</small></span><span>bonnes réponses.</span></div>" +
      '<div class="ballots" aria-label="' + score + " bonnes réponses sur " + n + '">' + ballots + "</div>" +
      '<p class="story-line">Et toi, tu sais qui vote quoi ?</p>' +
      '<div class="story-foot"><span>' + esc(D.appName) + "</span><span>" + esc(host) + "</span></div>" +
      "</div>" +
      '<button type="button" class="btn" data-share>Partager</button>' +
      '<button type="button" class="btn btn-light" data-restart>Rejouer</button>' +
      '<p class="cap">Fais une capture de la carte pour la poster en story. Ton score n’est enregistré nulle part.</p>' +
      "</div>";
  }

  // ---------- Pages annexes ----------

  function lexicon() {
    return '<div class="screen">' + backBar("#/", "Retour à l’accueil", '<span class="pill">Lexique</span>') +
      '<h1 class="headline" style="font-size:32px">Les mots <span>compliqués</span></h1>' +
      '<section class="card"><dl class="gloss" style="margin:0">' + D.glossary.map(function (g) {
        return "<div><dt>" + esc(g.term) + "</dt><dd>" + esc(g.def) + "</dd></div>";
      }).join("") + "</dl></section>" + foot() + "</div>";
  }

  function method() {
    return '<div class="screen">' + backBar("#/", "Retour à l’accueil", '<span class="pill">Méthode</span>') +
      '<h1 class="headline" style="font-size:32px">Nos <span>règles</span></h1>' +
      '<p class="note">Une plateforme faite par des jeunes, pour des jeunes. Mêmes règles pour tous, méthode publique.</p>' +
      '<section class="card"><ul class="rules">' +
      "<li>Une source par information, cliquable. Pas de source, pas de publication.</li>" +
      "<li>Aucune consigne de vote. On compare chaque candidat à ses propres promesses, jamais les candidats entre eux.</li>" +
      "<li>Ordre alphabétique, jamais par sondage. Aucune couleur de parti.</li>" +
      "<li>Même format pour chaque candidat : même longueur de résumé, même nombre de votes affichés.</li>" +
      "<li>Quand un candidat n’est pas député, on l’écrit : les votes de son groupe sont du contexte, pas ses votes.</li>" +
      "<li>L’indice « + souple / conforme / + rigide » n’apparaîtra qu’avec ses définitions publiées, thème par thème.</li>" +
      "<li>Les textes préparés avec l’IA sont relus et validés par l’équipe avant publication.</li>" +
      "<li>Sans compte. Le quiz se joue dans ton navigateur et rien n’est envoyé.</li>" +
      "</ul></section>" + foot() + "</div>";
  }

  function notFound() {
    return '<div class="screen">' + backBar("#/", "Retour à l’accueil") + '<h1 class="headline">Page introuvable</h1><a class="btn" href="#/">Retour à l’accueil</a></div>';
  }

  // ---------- Routeur ----------

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    var html;
    switch (parts[0]) {
      case "": html = home(); break;
      case "themes": html = themes(parts[1]); break;
      case "candidats": html = parts[1] ? candidate(parts[1]) : candidates(); break;
      case "quiz": html = quizScreen(); break;
      case "lexique": html = lexicon(); break;
      case "methode": html = method(); break;
      default: html = notFound();
    }
    app.innerHTML = html;
  }

  function rerender() {
    var y = window.scrollY;
    route();
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
    sheet.querySelector(".btn").focus();
  }

  function closeSheet() {
    sheet.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-term],[data-close],[data-filter],[data-sort],[data-pick],[data-next],[data-restart],[data-share]");
    if (!t) return;
    if (t.hasAttribute("data-term")) openTerm(+t.getAttribute("data-term"));
    else if (t.hasAttribute("data-close")) closeSheet();
    else if (t.hasAttribute("data-filter")) { candFilter = t.getAttribute("data-filter"); rerender(); }
    else if (t.hasAttribute("data-sort")) { sortBy = t.getAttribute("data-sort"); rerender(); }
    else if (t.hasAttribute("data-pick")) {
      if (quiz.picked !== null) return;
      quiz.picked = +t.getAttribute("data-pick");
      quiz.results.push(quiz.picked === quiz.order[quiz.i].answer);
      rerender();
    }
    else if (t.hasAttribute("data-next")) { quiz.i++; quiz.picked = null; route(); window.scrollTo(0, 0); }
    else if (t.hasAttribute("data-restart")) { newQuiz(); route(); window.scrollTo(0, 0); }
    else if (t.hasAttribute("data-share")) share(t);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.hidden) closeSheet();
  });

  function share(btn) {
    var score = quiz.results.filter(Boolean).length;
    var text = "J’ai trouvé " + score + "/" + quiz.order.length + " à « Qui a voté ça ? » sur " + D.appName + ". Et toi, tu sais qui vote quoi ?";
    var url = location.href.split("#")[0];
    if (navigator.share) {
      navigator.share({ title: D.appName, text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + " " + url).then(function () { btn.textContent = "Lien copié"; }, function () {});
    }
  }

  route();
})();
