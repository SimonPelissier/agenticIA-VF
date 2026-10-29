// MarIAn — 4 pages : Accueil, Actualité, Programmes, Qui a voté quoi ?
// Sans compte ni serveur : tout est calculé dans le navigateur, à partir des fichiers produits par les agents.
(function () {
  "use strict";

  var D = window.DATA;
  var MD = window.MARIAN_DONNEES || { candidats: {} };          // agent de collecte : votes clés, participation
  var MV = window.MARIAN_VOTES || { lois: [], categories: [], candidats: [], noms: {} }; // agent de collecte : grands votes
  var MA = window.MARIAN_ACTU || { medias: {}, articles: [], declarations: [] };          // veille médias
  var PR = window.MARIAN_PROGRAMMES || { partis: [] };          // programmes vérifiés (Kevan)
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
    var p = iso.slice(0, 10).split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function when(iso) {
    var d = new Date(iso.length > 10 ? iso : iso + "T12:00"), h = (Date.now() - d) / 3600000;
    if (h < 1) return "à l’instant";
    if (h < 24) return "il y a " + Math.floor(h) + " h";
    if (h < 48) return "hier";
    if (h < 24 * 7) return "il y a " + Math.floor(h / 24) + " j";
    return fmtDate(iso);
  }
  function daysLeft() {
    var p = D.electionDate.split("-");
    var target = new Date(+p[0], +p[1] - 1, +p[2]), now = new Date();
    return Math.max(0, Math.round((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000));
  }
  function initials(name) { var w = name.split(/\s+/); return (w[0][0] + w[w.length - 1][0]).toUpperCase(); }
  function icon(d, size) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var I = {
    back: "M19 12H5M11 6l-6 6 6 6",
    arrow: "M5 12h14M13 6l6 6-6 6",
    out: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
    news: "M4 5h13v14H6a2 2 0 0 1-2-2zM17 8h3v9a2 2 0 0 1-2 2M8 9h6M8 13h6",
    vote: "M4 11h16v9H4zM9 11V4h6v7M8 15h8",
    sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
    spark: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"
  };

  // Stockage local, uniquement sur l'appareil : préférences du fil d'actualité.
  function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* navigation privée */ } }

  // ---------- Briques communes ----------

  function foot() {
    return '<p class="foot">Sans compte. Aucune donnée personnelle collectée. Chaque information renvoie à sa source.<br>' +
      (MD.dernierScrutin ? "Votes à jour au " + fmtDate(MD.dernierScrutin) + " · " : "") +
      '<a href="#/methode">Comment on travaille</a> · <a href="#/lexique">Lexique</a></p>';
  }
  function topbar(back, title, right) {
    return '<div class="topbar"><div style="display:flex;align-items:center;gap:12px">' +
      (back ? '<a class="round-btn" href="' + back + '" aria-label="Retour">' + icon(I.back, 20) + "</a>" : "") +
      (title ? '<span class="topbar-title">' + title + "</span>" : "") + "</div>" + (right || "") + "</div>";
  }
  function brandBar() {
    return '<div class="topbar"><a class="brand" href="#/">Mar<span>(IA)</span>n</a><span class="pill-dark" title="1er tour le ' +
      fmtDate(D.electionDate) + (D.electionDateProvisional ? ", date provisoire" : "") + '">J–' + daysLeft() + "<span>avant le vote</span></span></div>";
  }
  function candidate(id) { return byId(D.candidates, id); }

  // ======================================================================
  // ACCUEIL
  // ======================================================================

  function home() {
    var semaine = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    var recents = MA.articles.filter(function (a) { return a.date >= semaine; });
    var publies = PR.partis.filter(function (p) { return p.statut === "publie"; });
    var dernier = MV.lois[0];
    return '<div class="screen enter">' + brandBar() +
      '<h1 class="headline">Ce qu’ils promettent.<br><span>Ce qu’ils ont voté.</span></h1>' +
      '<a class="home-card dark" href="#/actu"><span class="hc-top"><span class="hc-ic">' + icon(I.news) + '</span><span class="hc-n">' + recents.length + " article" + (recents.length > 1 ? "s" : "") + " cette semaine</span></span>" +
      '<span class="hc-title">L’actu qui te parle</span>' +
      MA.articles.slice(0, 2).map(function (a) { return '<span class="hc-line">' + esc(MA.medias[a.media] || a.media) + " · " + esc(a.titre) + "</span>"; }).join("") +
      '<span class="hc-go">Voir l’actualité' + icon(I.arrow, 18) + "</span></a>" +
      '<a class="home-card" href="#/programmes"><span class="hc-top"><span class="hc-ic">' + icon(I.doc) + '</span><span class="hc-n">' + publies.length + " partis</span></span>" +
      '<span class="hc-title">Ce qu’ils proposent</span><span class="hc-line">Les mesures de leurs programmes, recopiées mot pour mot.</span>' +
      '<span class="hc-go">Voir les programmes' + icon(I.arrow, 18) + "</span></a>" +
      '<a class="home-card accent" href="#/votes"><span class="hc-top"><span class="hc-ic">' + icon(I.vote) + '</span><span class="hc-n">' + MV.lois.length + " grands votes</span></span>" +
      '<span class="hc-title">Qui a voté quoi ?</span>' +
      (dernier ? '<span class="hc-line">Dernier : ' + esc(dernier.titre) + " · " + (dernier.sort === "adopté" ? "adopté" : "rejeté") + " le " + fmtDate(dernier.date) + "</span>" : "") +
      '<span class="hc-go">Voir les votes' + icon(I.arrow, 18) + "</span></a>" +
      foot() + "</div>";
  }

  // ======================================================================
  // ACTUALITÉ (maquette d'Anaïs) — données : veille médias (data/actu.js)
  // ======================================================================

  var actu = { mode: "cand", pick: "all" };
  var FIL_KEY = "marian:fil";
  function prefs() { return load(FIL_KEY, { cands: [], sujets: [], medias: null }); }
  function declsOf(a) { return MA.declarations.filter(function (d) { return d.url === a.url; }); }
  function themeLabel(id) { var t = byId(D.themes, id); return t ? t.label : null; }
  // Programme du parti d'un candidat (section de Kevan), quand il existe.
  var PROG_DU_PARTI = { "La France insoumise": "lfi", "Parti socialiste": "ps", "Place publique": "place-publique", "Les Républicains": "lr", "Les Écologistes": "ecologistes", "Horizons": "horizons", "PCF": "pcf", "Rassemblement national": "rn", "Renaissance": "renaissance" };

  function articlesVisibles() {
    var p = prefs();
    return MA.articles.filter(function (a) { return !p.medias || p.medias.indexOf(a.media) !== -1; });
  }

  function newsCard(a) {
    var ds = declsOf(a);
    var sujet = ds.length && ds[0].theme ? themeLabel(ds[0].theme) : null;
    return '<article class="news">' +
      '<div class="news-top"><span><b>' + esc(MA.medias[a.media] || a.media) + "</b> · " + when(a.date) + "</span>" +
      '<span class="ntag' + (ds.length ? " decl" : "") + '">' + (ds.length ? "Déclaration" : "Article") + "</span></div>" +
      '<a class="news-title" href="#/actu/a/' + a.id + '">' + esc(a.titre) + "</a>" +
      (ds.length ? '<div class="essentiel"><span class="eb">L’essentiel</span>' + ds.slice(0, 2).map(function (d) {
        var c = candidate(d.candidat);
        return '<span class="pt">' + esc((c ? c.name + " : " : "") + d.resume) + "</span>";
      }).join("") + "</div>" : "") +
      '<div class="news-foot"><span class="news-tags">' + a.candidats.slice(0, 2).map(function (id) {
        var c = candidate(id);
        return c ? '<span class="ctag">' + esc(c.name) + "</span>" : "";
      }).join("") + (sujet ? '<span class="stag">' + esc(sujet) + "</span>" : "") + "</span>" +
      '<a class="link" href="' + esc(a.url) + '" target="_blank" rel="noopener">Article complet ↗</a></div></article>';
  }

  function actuFeed() {
    var p = prefs(), list = articlesVisibles();
    var chips = actu.mode === "cand"
      ? [{ id: "all", label: "Tous les candidats" }].concat(D.candidates.map(function (c) { return { id: c.id, label: c.name }; }))
      : [{ id: "all", label: "Tous les sujets" }].concat(D.themes.map(function (t) { return { id: t.id, label: t.label }; }));
    if (actu.pick !== "all") {
      list = list.filter(function (a) {
        return actu.mode === "cand" ? a.candidats.indexOf(actu.pick) !== -1
          : declsOf(a).some(function (d) { return d.theme === actu.pick; });
      });
    } else if (p.cands.length || p.sujets.length) {
      // « Mon fil » : les articles qui concernent ce que je suis passent en premier.
      var score = function (a) {
        return (a.candidats.some(function (c) { return p.cands.indexOf(c) !== -1; }) ? 2 : 0) +
          (declsOf(a).some(function (d) { return p.sujets.indexOf(d.theme) !== -1; }) ? 1 : 0);
      };
      list = list.slice().sort(function (x, y) { return score(y) - score(x) || (y.date > x.date ? 1 : -1); });
    }
    var cur = byId(chips, actu.pick) || chips[0];
    var nomsMedias = Object.keys(MA.medias).filter(function (m) { return !p.medias || p.medias.indexOf(m) !== -1; }).map(function (m) { return MA.medias[m]; });
    return '<div class="screen enter">' + brandBar() +
      '<div class="actu-head"><h1 class="h1">L’actu <span>qui te parle</span></h1><a class="square-btn" href="#/actu/perso" aria-label="Personnaliser mon fil">' + icon(I.sliders) + "</a></div>" +
      '<div class="tabs2" role="tablist"><button type="button" role="tab" data-amode="cand" aria-selected="' + (actu.mode === "cand") + '">Par candidat</button>' +
      '<button type="button" role="tab" data-amode="sujet" aria-selected="' + (actu.mode === "sujet") + '">Par sujet</button></div>' +
      '<div class="chips">' + chips.map(function (c) { return '<button type="button" class="chip" data-apick="' + c.id + '" aria-pressed="' + (actu.pick === c.id) + '">' + esc(c.label) + "</button>"; }).join("") + "</div>" +
      '<p class="cap"><b style="color:var(--ink)">' + list.length + " news</b> · " + esc(cur.label) + (p.cands.length || p.sujets.length ? " · mon fil d’abord" : "") +
      "<br>Sources : " + esc(nomsMedias.join(", ")) + "</p>" +
      (list.length ? list.slice(0, 40).map(newsCard).join("")
        : '<div class="empty"><strong>Pas encore de news sur ce filtre.</strong>' + (actu.mode === "sujet" ? "Le sujet d’un article vient des déclarations relevées par la veille ; elles arrivent après relecture." : "On te prévient dès qu’il y a du nouveau.") + "</div>") +
      '<p class="cap">Titres et liens des articles d’origine : MarIAn ne reproduit pas les articles. « L’essentiel » reprend les déclarations relevées et vérifiées mot pour mot.</p>' +
      foot() + "</div>";
  }

  function actuDetail(id) {
    var a = byId(MA.articles, id);
    if (!a) return notFound();
    var ds = declsOf(a), cands = a.candidats.map(candidate).filter(Boolean);
    var sujet = ds.length && ds[0].theme ? themeLabel(ds[0].theme) : null;
    var plus = cands.map(function (c) {
      var prog = PROG_DU_PARTI[c.party], pp = prog && byId(PR.partis, prog);
      return (pp ? '<a class="go-row" href="#/programmes/' + prog + '"><span><b>Ce que propose son parti</b><small>' + esc(c.party) + " · Programmes</small></span>" + icon(I.arrow, 18) + "</a>" : "") +
        '<a class="go-row" href="#/votes/personnes/' + c.id + '"><span><b>Ce qu’a voté ' + esc(c.name) + "</b><small>" + (candVoteData(c.id).mandats.length ? "Ses votes, ou ceux de son groupe" : "Les votes de son groupe") + " · Qui a voté quoi</small></span>" + icon(I.arrow, 18) + "</a>";
    }).join("");
    return '<div class="screen enter">' +
      '<div class="topbar"><a class="round-btn" href="#/actu" aria-label="Retour au fil">' + icon(I.back, 20) + '</a><span class="news-tags">' +
      cands.slice(0, 2).map(function (c) { return '<span class="ctag">' + esc(c.name) + "</span>"; }).join("") + (sujet ? '<span class="stag">' + esc(sujet) + "</span>" : "") + "</span></div>" +
      '<span class="ntag' + (ds.length ? " decl" : "") + '" style="align-self:flex-start">' + (ds.length ? "Déclaration" : "Article") + "</span>" +
      '<h1 class="h1" style="font-size:26px">' + esc(a.titre) + "</h1>" +
      '<div class="source-card"><span><span class="eb muted">Source</span><b>' + esc(MA.medias[a.media] || a.media) + "</b><small>Publié le " + fmtDate(a.date) + "</small></span>" +
      '<a class="btn-dark small" href="' + esc(a.url) + '" target="_blank" rel="noopener">Lire l’article' + icon(I.out, 16) + "</a></div>" +
      (ds.length
        ? '<section class="thirty"><span class="eb">' + icon(I.spark, 14) + " En 30 secondes</span>" +
          ds.map(function (d) { var c = candidate(d.candidat); return "<p>" + esc((c ? c.name : "") + " : " + d.resume) + "</p>"; }).join("") + "</section>" +
          '<section style="display:flex;flex-direction:column;gap:10px"><h2 class="h2">Ses mots exacts</h2>' + ds.map(function (d) {
            var c = candidate(d.candidat);
            return '<div class="quote-card"><blockquote>« ' + esc(d.citation) + " »</blockquote>" +
              '<div class="keys"><span>Qui</span><b>' + esc(c ? c.name : d.candidat) + "</b><span>Quoi</span><b>" + (d.type === "engagement" ? "Un engagement" : "Une position") + "</b>" +
              (d.theme ? "<span>Sujet</span><b>" + esc(themeLabel(d.theme) || d.theme) + "</b>" : "") +
              "<span>Vérifié</span><b>" + (d.statut === "verifiee" ? "Mot pour mot dans l’article" : "À la main (article payant)") + "</b></div></div>";
          }).join("") + "</section>"
        : '<div class="empty"><strong>Pas encore de déclaration relevée dans cet article.</strong>La veille lit les articles chaque jour et relève les citations directes des candidats ; elles apparaissent ici une fois vérifiées et relues.</div>') +
      (plus ? '<section style="display:flex;flex-direction:column;gap:10px"><h2 class="h2">Pour aller plus loin</h2>' + plus + "</section>" : "") +
      '<p class="cap">MarIAn affiche le titre et le lien de l’article, sans le reproduire. Une erreur ? <a href="https://github.com/SimonPelissier/agenticIA-VF/issues/new" target="_blank" rel="noopener">Signale-la</a>.</p>' +
      foot() + "</div>";
  }

  function actuPerso() {
    var p = prefs(), medias = p.medias || Object.keys(MA.medias);
    var nc = p.cands.length, ns = p.sujets.length;
    return '<div class="screen enter">' + topbar("#/actu", null) +
      '<h1 class="h1">Ton fil, <span>à ta façon</span></h1><p class="note">Choisis qui et quoi suivre : on te montre d’abord ces news-là. Tes choix restent sur ton téléphone.</p>' +
      '<div class="section-head"><h2 class="h2" style="font-size:18px">Mes candidats</h2><span>' + nc + " suivi" + (nc > 1 ? "s" : "") + "</span></div>" +
      '<div class="follow-grid">' + D.candidates.map(function (c) {
        var on = p.cands.indexOf(c.id) !== -1;
        return '<button type="button" class="follow' + (on ? " on" : "") + '" data-follow="' + c.id + '" aria-pressed="' + on + '"><span class="avatar sm">' + initials(c.name) + "</span><span><b>" + esc(c.name) + "</b><small>" + esc(c.party) + "</small></span></button>";
      }).join("") + "</div>" +
      '<h2 class="h2" style="font-size:18px">Les sujets qui me tiennent à cœur</h2><div class="chips wrap">' + D.themes.map(function (t) {
        var on = p.sujets.indexOf(t.id) !== -1;
        return '<button type="button" class="chip" data-fsujet="' + t.id + '" aria-pressed="' + on + '">' + (on ? "✓ " : "+ ") + esc(t.label) + "</button>";
      }).join("") + "</div>" +
      '<h2 class="h2" style="font-size:18px">Mes journaux</h2><div class="box flat" style="padding:0;gap:0">' + Object.keys(MA.medias).map(function (m) {
        return '<label class="check-row"><b>' + esc(MA.medias[m]) + '</b><input type="checkbox" data-fmedia="' + m + '"' + (medias.indexOf(m) !== -1 ? " checked" : "") + "></label>";
      }).join("") + "</div>" +
      '<a class="btn-dark" href="#/actu">Voir mon fil · ' + nc + " candidat" + (nc > 1 ? "s" : "") + ", " + ns + " sujet" + (ns > 1 ? "s" : "") + "</a>" +
      foot() + "</div>";
  }

  // ======================================================================
  // PROGRAMMES (section de Kevan, reprise telle quelle)
  // Des mesures recopiées mot pour mot, sans lien avec les candidats ni les votes.
  // Le texte vient de data/programmes.js, écrit par agents/verification/programmes.py après vérification.
  // ======================================================================

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
      '<p class="note">Les mesures sont recopiées mot pour mot depuis le programme de chaque parti. On ne résume pas et on ne choisit pas : ce sont les mesures que le parti met lui-même en avant, ou, s’il n’en désigne pas, celle qu’il présente en premier dans chaque partie de son programme.</p>' +
      '<div class="people stagger">' + PARTIS.map(function (p) {
        return '<a class="person' + (p.statut === "publie" ? "" : " off") + '" href="#/programmes/' + p.id + '"><span class="n">' + esc(p.nom) + '</span><span class="p">' + esc(progStatus(p)) + "</span></a>";
      }).join("") + "</div>" +
      '<p class="cap">Ordre alphabétique, aucune couleur de parti.</p>' + foot() + "</div>";
  }

  var openChapter = null;

  // Ce qui est affiché et pourquoi : la sélection vient toujours du parti, jamais de MarIAn.
  function progRule(p) {
    if (p.structure === "mesures-cles") {
      return "<b>" + esc(p.nom) + " présente lui-même ces mesures comme « " + esc(p.libelle) + " ».</b> On les recopie telles quelles, dans son ordre, sans en choisir ni en reformuler aucune.";
    }
    var u = p.unite || "chapitre";
    return "<b>" + esc(p.nom) + " ne met pas de mesures en avant.</b> Pour chaque " + esc(u) +
      ", on affiche donc celle qui ouvre sa liste dans le programme : c’est l’ordre choisi par le parti, pas une sélection de MarIAn. Les autres mesures sont dans le programme.";
  }

  function openMeasure(ref) {
    var k = ref.lastIndexOf(":"), p = byId(PARTIS, ref.slice(0, k)), n = +ref.slice(k + 1);
    var m = p && p.mesures.filter(function (x) { return x.ordre === n; })[0];
    if (!m) return;
    var eb = p.structure === "mesures-cles" ? p.libelle + (m.repere ? " · " + m.repere : "")
      : (m.repere ? m.repere + " · " : "") + "1re mesure de la liste";
    var extra = (m.chapitre ? '<p class="cap">' + esc(m.chapitre) + "</p>" : "") +
      (p.structure === "mesures-cles" ? "" : '<p class="group-note">C’est la première mesure que ' + esc(p.nom) + " présente pour ce " + esc(p.unite || "chapitre") + ". Elle n’a pas été choisie par MarIAn.</p>") +
      '<a class="link" href="' + esc(m.url) + '" target="_blank" rel="noopener">Lire dans le programme' + (m.page ? ", page " + m.page : "") + " ↗</a>" +
      '<p class="cap">Texte reproduit mot pour mot.</p>';
    showSheet(eb, m.titre || p.nom, m.texte, extra, true);
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
    // Par chapitre, dans l'ordre du programme ; une partie s'affiche en titre quand elle change.
    var html = "", partie = null, groupe = null, groupes = [];
    p.mesures.forEach(function (m) {
      if (!groupe || groupe.chapitre !== m.chapitre || groupe.partie !== m.partie) {
        groupe = { partie: m.partie, chapitre: m.chapitre, mesures: [] };
        groupes.push(groupe);
      }
      groupe.mesures.push(m);
    });
    groupes.forEach(function (g, i) {
      if (g.partie && g.partie !== partie) {
        partie = g.partie;
        html += '<p class="eb muted" style="margin-top:8px">' + esc(g.partie) + "</p>";
      }
      var key = p.id + ":" + i, open = openChapter === key;
      html += '<div class="acc"><button type="button" class="acc-head" data-chap="' + esc(key) + '" aria-expanded="' + open + '">' +
        '<span class="l">' + esc(g.chapitre || "Mesures") + '</span><span class="c">' + g.mesures.length + " " + (open ? "▴" : "▾") + "</span></button>" +
        (open ? '<div class="acc-body">' + g.mesures.map(function (m) {
          return '<button type="button" class="vote-item" data-mesure="' + p.id + ":" + m.ordre + '"><span>' +
            (m.repere ? '<span class="m" style="margin:0 0 2px">' + esc(m.repere) + "</span>" : "") +
            '<span class="t">' + esc(m.titre || m.texte) + "</span></span>" + icon(I.arrow, 18) + "</button>";
        }).join("") + "</div>" : "") + "</div>";
    });
    return '<div class="screen enter">' + topbar("#/programmes", "Programme") + head +
      '<p class="group-note">' + progRule(p) + "</p>" +
      '<p class="cap">Touche un titre pour lire la mesure en entier.</p>' +
      '<div class="stagger" style="display:flex;flex-direction:column;gap:10px">' + html + "</div>" +
      '<section class="box flat"><p class="eb">Sources</p>' + p.sources.map(function (s) {
        return '<div class="kv"><a class="link" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.titre) + " ↗</a><span>consulté le " + fmtDate(s.consulte_le) + "</span></div>";
      }).join("") +
      '<p class="cap">Texte reproduit sans modification. Vérifié par un programme le ' + fmtDate(PR.verifieLe) +
      " : chaque mesure a été retrouvée mot pour mot dans la source archivée.</p></section>" +
      '<a class="btn-dark" href="https://github.com/SimonPelissier/agenticIA-VF/issues/new" target="_blank" rel="noopener">Signaler une erreur</a>' +
      foot() + "</div>";
  }

  // ======================================================================
  // QUI A VOTÉ QUOI ? — données : grands votes de l'agent de collecte (data/votes.js)
  // ======================================================================

  var COL = { p: "#2E9D57", a: "#8C9BB5", c: "#D9480F", n: "#E6DFC6" };
  var PV = { p: "Pour", c: "Contre", a: "Abstention", n: "Non-votant", x: "Absent", aucun: "N’a pas voté" };
  var CAT_ICON = { institutions: "🏛", retraites: "⏳", immigration: "🛂", securite: "🛡", logement: "⌂", sante: "✚", economie: "€", travail: "💼", climat: "🌿", ecole: "✎", numerique: "📱", societe: "⚖", culture: "🎭", international: "🌍", autres: "…" };
  var catLabel = {};
  MV.categories.forEach(function (c) { catLabel[c.id] = c.label; });
  var vs = { filter: "tout", limit: 12, q: "", g: null };

  function loi(id) { return byId(MV.lois, id); }
  function candVoteData(id) { return byId(MV.candidats, id) || { mandats: [], votes: {}, famille: null }; }
  function siegeait(cv, date) { return cv.mandats.some(function (m) { return m.debut <= date && (!m.fin || date <= m.fin); }); }
  function groupVote(cv, l) {
    var g = l.groupes.filter(function (x) { return x.f === cv.famille; })[0];
    if (!g) return null;
    var max = Math.max(g.p, g.c, g.a);
    return { pos: max === 0 ? "aucun" : g.p === max ? "p" : g.c === max ? "c" : "a", g: g.g, coh: g.coh };
  }
  // Son vote s'il siégeait ce jour-là ; absent : son groupe en contexte ; pas député : le vote de son groupe.
  function candVote(id, l) {
    var cv = candVoteData(id), gv = groupVote(cv, l);
    if (siegeait(cv, l.date)) {
      var mine = cv.votes[l.id];
      return mine ? { perso: true, pos: mine, g: gv && gv.g } : { perso: true, pos: "x", g: gv && gv.g, gpos: gv && gv.pos, coh: gv && gv.coh };
    }
    return gv ? { perso: false, pos: gv.pos, g: gv.g, coh: gv.coh } : { perso: false, pos: null };
  }
  function candRole(c) {
    var cv = candVoteData(c.id);
    if (!cv.mandats.length) return "Pas de mandat de député : votes de son groupe";
    var last = cv.mandats[cv.mandats.length - 1];
    return last.fin ? "A siégé " + cv.mandats[0].debut.slice(0, 4) + "-" + last.fin.slice(0, 4) : "Siège à l’Assemblée";
  }

  function miniBar(l) {
    var t = l.pour + l.contre + l.abst || 1;
    return '<span class="mini"><i style="width:' + (100 * l.pour / t) + "%;background:" + COL.p + '"></i><i style="width:' + (100 * l.abst / t) + "%;background:" + COL.a + '"></i><i style="width:' + (100 * l.contre / t) + "%;background:" + COL.c + '"></i></span>';
  }
  function resPill(l) { return '<span class="res ' + (l.sort === "adopté" ? "ok" : "ko") + '">' + (l.sort === "adopté" ? "Adopté" : "Rejeté") + "</span>"; }
  function lawRow(l, query, extra) {
    return '<a class="law" href="#/votes/loi/' + l.id + (query || "") + '"><span class="m"><span>' + fmtDate(l.date) + (l.lecture ? " · " + esc(l.lecture) : "") + "</span>" + resPill(l) + "</span>" +
      "<b>" + esc(l.titre) + "</b>" + (extra || miniBar(l)) + "</a>";
  }

  function votesStart() {
    return '<div class="screen enter">' + topbar(null, "Qui a voté quoi ?") +
      '<h1 class="h1">Qui a voté <span>quoi</span> ?</h1><p class="note">Les ' + MV.lois.length + " grands votes de l’Assemblée depuis 2022 : le vote final des lois, les motions de censure, les déclarations du gouvernement. Données officielles, mises à jour chaque nuit.</p>" +
      '<div class="modes"><a class="mode dark" href="#/votes/sujets"><span class="mode-ic">🗂</span><span><b>Par sujet</b><small>Économie, sécurité, logement… puis les dernières lois</small></span></a>' +
      '<a class="mode" href="#/votes/personnes"><span class="mode-ic">👤</span><span><b>Par personne</b><small>Comment chaque candidat a voté, ou son groupe s’il n’était pas député</small></span></a></div>' +
      '<p class="eb">Les derniers votes</p>' + MV.lois.slice(0, 3).map(function (l) { return lawRow(l); }).join("") + foot() + "</div>";
  }

  function votesSujets() {
    var counts = {}, last = {};
    MV.lois.forEach(function (l) { counts[l.cat] = (counts[l.cat] || 0) + 1; if (!last[l.cat]) last[l.cat] = l.date; });
    var q = vs.q.trim().toLowerCase();
    var res = q ? MV.lois.filter(function (l) { return l.titre.toLowerCase().indexOf(q) !== -1; }).slice(0, 20) : null;
    return '<div class="screen enter">' + topbar("#/votes", "Par sujet") +
      '<label class="search">' + icon(I.search, 18) + '<input id="q" type="search" placeholder="Chercher une loi (ex. « logement »)" value="' + esc(vs.q) + '"></label>' +
      (res ? '<p class="eb">' + res.length + " résultat" + (res.length > 1 ? "s" : "") + "</p>" + (res.map(function (l) { return lawRow(l); }).join("") || '<p class="cap">Aucune loi trouvée.</p>')
        : '<p class="eb">Choisis une catégorie</p><div class="cat-tiles">' + MV.categories.filter(function (c) { return counts[c.id]; }).map(function (c) {
          return '<a class="cat-tile" href="#/votes/sujets/' + c.id + '"><span class="cat-ic">' + CAT_ICON[c.id] + "</span><b>" + esc(c.label) + "</b><small>" + counts[c.id] + " votes · dernier le " + fmtDate(last[c.id]) + "</small></a>";
        }).join("") + "</div>" +
        '<p class="cap">Classement automatique d’après le titre du texte (règles publiques dans agents/collecte/grands_votes.py).</p>') +
      foot() + "</div>";
  }

  function votesCat(cat) {
    if (!catLabel[cat]) return notFound();
    var list = MV.lois.filter(function (l) {
      return l.cat === cat && (vs.filter === "tout" || (vs.filter === "adopte" ? l.sort === "adopté" : vs.filter === "rejete" ? l.sort !== "adopté" : l.leg === vs.filter));
    });
    var f = [["tout", "Tout"], ["17", "Depuis 2024"], ["16", "2022-2024"], ["adopte", "Adoptés"], ["rejete", "Rejetés"]];
    return '<div class="screen enter">' + topbar("#/votes/sujets", null).replace("</a></div>", '</a><span class="tag">' + CAT_ICON[cat] + " " + esc(catLabel[cat]) + "</span></div>") +
      '<h1 class="h1">Les derniers votes<br><span>' + esc(catLabel[cat].toLowerCase()) + "</span></h1>" +
      '<div class="chips wrap">' + f.map(function (x) { return '<button type="button" class="chip" data-vfilter="' + x[0] + '" aria-pressed="' + (vs.filter === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<p class="cap">' + list.length + " vote" + (list.length > 1 ? "s" : "") + ", du plus récent au plus ancien. Touche une loi pour voir son hémicycle.</p>" +
      list.slice(0, vs.limit).map(function (l) { return lawRow(l, "?c=" + cat); }).join("") +
      (list.length > vs.limit ? '<button type="button" class="next-btn" data-vmore="1">Voir plus</button>' : "") + foot() + "</div>";
  }

  // Positions des sièges d'un hémicycle de n places, de gauche à droite.
  function seats(n) {
    var ROWS = 11, R0 = 62, R1 = 172, CX = 200, CY = 192, radii = [], tot = 0;
    for (var r = 0; r < ROWS; r++) { var rad = R0 + (R1 - R0) * r / (ROWS - 1); radii.push(rad); tot += rad; }
    var per = radii.map(function (rad) { return Math.round(n * rad / tot); });
    per[ROWS - 1] += n - per.reduce(function (a, b) { return a + b; }, 0);
    var pts = [];
    radii.forEach(function (rad, i) {
      for (var k = 0; k < per[i]; k++) {
        var a = Math.PI * (1 - (per[i] > 1 ? k / (per[i] - 1) : 0.5));
        pts.push({ x: CX + rad * Math.cos(a), y: CY - rad * Math.sin(a), a: a });
      }
    });
    pts.sort(function (p, q) { return q.a - p.a || Math.hypot(p.x - CX, p.y - CY) - Math.hypot(q.x - CX, q.y - CY); });
    return { pts: pts, cx: CX, cy: CY, r1: R1 };
  }

  function votesLoi(id, query) {
    var l = loi(id);
    if (!l) return notFound();
    var person = query.p && candidate(query.p), banner = "";
    var gs = l.groupes.filter(function (g) { return g.m > 0; });
    if (person) {
      var v = candVote(person.id, l), gp = v.g || (groupVote(candVoteData(person.id), l) || {}).g;
      if (vs.g === null && gp) vs.g = gp;
      banner = '<div class="banner"><span class="avatar sm">' + initials(person.name) + "</span><p><b>" + esc(person.name) + "</b><br>" +
        (v.perso ? (v.pos === "x" ? "Siégeait mais <b>n’a pas voté</b>" + (v.gpos ? ". Son groupe " + v.g + " : <b>" + PV[v.gpos] + "</b>" : "") : "Son vote : <b>" + PV[v.pos] + "</b>")
          : v.pos ? "Pas député à cette date. Son groupe " + v.g + " : <b>" + PV[v.pos] + "</b>" + (v.coh !== null ? " (cohésion " + v.coh + " %)" : "") : "Pas député à cette date, et son groupe n’existait pas.") +
        (gp ? " · son groupe est allumé" : "") + "</p></div>";
    }
    var n = gs.reduce(function (a, g) { return a + g.m; }, 0), H = seats(n), pts = H.pts, i = 0, dots = "", labels = "";
    gs.forEach(function (g) {
      var nv = Math.max(0, g.m - g.p - g.c - g.a), seq = [];
      [["p", g.p], ["a", g.a], ["c", g.c], ["n", nv]].forEach(function (x) { for (var j = 0; j < x[1]; j++) seq.push(x[0]); });
      var start = i;
      seq.slice(0, g.m).forEach(function (k) {
        var p = pts[i++];
        if (p) dots += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.9" fill="' + COL[k] + '" opacity="' + (vs.g && vs.g !== g.g ? 0.15 : 1) + '"/>';
      });
      var mid = pts[Math.floor((start + i - 1) / 2)];
      if (g.m >= 12 && mid) {
        labels += '<text data-vg="' + g.g + '" x="' + (H.cx + (H.r1 + 15) * Math.cos(mid.a)).toFixed(1) + '" y="' + (H.cy - (H.r1 + 15) * Math.sin(mid.a)).toFixed(1) +
          '" text-anchor="middle" dominant-baseline="middle" font-size="9.5" font-weight="800" fill="' + (vs.g === g.g ? "#6D28D9" : "#4C426C") + '" style="cursor:pointer">' + g.g + "</text>";
      }
    });
    var sel = vs.g && gs.filter(function (g) { return g.g === vs.g; })[0];
    var back = person ? "#/votes/personnes/" + person.id : query.c ? "#/votes/sujets/" + query.c : "#/votes";
    return '<div class="screen enter">' + topbar(back, null).replace("</a></div>", '</a><span class="tag">' + CAT_ICON[l.cat] + " " + esc(catLabel[l.cat]) + "</span></div>") + banner +
      '<div class="box"><p class="cap">' + fmtDate(l.date) + (l.lecture ? " · " + esc(l.lecture) : "") + (l.solennel ? " · scrutin solennel" : "") + " · " + l.leg + "e législature</p>" +
      '<h1 class="vote-title">' + esc(l.titre) + "</h1>" +
      '<span class="result">' + (l.sort === "adopté" ? "Adopté" : "Rejeté") + " · " + l.pour + " pour, " + l.contre + " contre, " + l.abst + " abst.</span>" +
      '<svg class="hemi" viewBox="0 0 400 205" role="img" aria-label="Hémicycle : ' + l.pour + " pour, " + l.contre + ' contre">' + dots + labels +
      '<text x="200" y="172" text-anchor="middle" font-size="24" font-weight="800" fill="#1D1836">' + l.pour + " / " + l.requis + '</text><text x="200" y="190" text-anchor="middle" font-size="10.5" font-weight="600" fill="#796F91">voix pour / voix nécessaires</text></svg>' +
      '<div class="legend"><span><i style="background:' + COL.p + '"></i>Pour</span><span><i style="background:' + COL.a + '"></i>Abstention</span><span><i style="background:' + COL.c + '"></i>Contre</span><span><i style="background:' + COL.n + '"></i>N’a pas voté (' + (n - l.pour - l.contre - l.abst) + ")</span></div>" +
      '<div class="tbar"><i style="width:' + (100 * l.pour / n) + "%;background:" + COL.p + '"></i><i style="width:' + (100 * l.abst / n) + "%;background:" + COL.a + '"></i><i style="width:' + (100 * l.contre / n) + "%;background:" + COL.c + '"></i><span class="thr" style="left:' + (100 * l.requis / n) + '%"></span></div>' +
      '<p class="cap">Trait noir : seuil de ' + l.requis + " voix. " + (l.leg === "16" ? "Ordre des groupes de 2022-2024 à vérifier." : "Groupes placés de gauche à droite comme dans l’hémicycle (d’après les numéros de siège officiels).") + " Dans un groupe, la place de chaque député est indicative.</p>" +
      (sel ? '<div class="gdetail"><b>' + esc(MV.noms[sel.g] || sel.g) + "</b>" + sel.p + " pour, " + sel.c + " contre, " + sel.a + " abstention, " + Math.max(0, sel.m - sel.p - sel.c - sel.a) + " n’ont pas voté, sur " + sel.m + " députés" + (sel.coh !== null ? " · cohésion " + sel.coh + " %" + (sel.coh < 67 ? " (groupe divisé)" : "") : "") + ".</div>"
        : '<p class="cap">Touche un groupe pour allumer ses sièges.</p>') +
      '<a class="link" href="' + esc(l.url) + '" target="_blank" rel="noopener">Voir le scrutin officiel ↗</a></div>' +
      '<p class="eb">Groupe par groupe, de gauche à droite</p><div>' + gs.map(function (g) {
        return '<button type="button" class="grow" data-vg="' + g.g + '" aria-pressed="' + (vs.g === g.g) + '" title="' + esc(MV.noms[g.g] || g.g) + '"><span>' + g.g + '</span><span class="stack"><i style="width:' + (100 * g.p / g.m) + "%;background:" + COL.p + '"></i><i style="width:' + (100 * g.a / g.m) + "%;background:" + COL.a + '"></i><i style="width:' + (100 * g.c / g.m) + "%;background:" + COL.c + '"></i></span><span class="gn">' + (g.p + g.c + g.a) + "/" + g.m + "</span></button>";
      }).join("") + "</div>" + foot() + "</div>";
  }

  function votesPersonnes() {
    return '<div class="screen enter">' + topbar("#/votes", "Par personne") +
      '<h1 class="h1">Qui veux-tu <span>checker</span> ?</h1><div class="people stagger">' + D.candidates.map(function (c) {
        return '<a class="person" href="#/votes/personnes/' + c.id + '"><span class="avatar" aria-hidden="true">' + initials(c.name) + '</span><span class="n">' + esc(c.name) + '</span><span class="p">' + esc(c.party) + "<br>" + esc(candRole(c)) + "</span></a>";
      }).join("") + '</div><p class="cap">Ordre alphabétique, aucune couleur de parti.</p>' + foot() + "</div>";
  }

  function votesPersonne(id) {
    var c = candidate(id);
    if (!c) return notFound();
    var cv = candVoteData(id), fam = D.groups[c.group] || c.group;
    var all = MV.lois.map(function (l) { return { l: l, v: candVote(id, l) }; }).filter(function (x) { return x.v.pos; });
    var perso = all.filter(function (x) { return x.v.perso; }), grp = all.filter(function (x) { return !x.v.perso; });
    var voted = perso.filter(function (x) { return x.v.pos !== "x"; });
    function dist(arr, title) {
      if (!arr.length) return "";
      var n = {};
      arr.forEach(function (x) { n[x.v.pos] = (n[x.v.pos] || 0) + 1; });
      return '<div class="dist"><p class="eb muted">' + title + " · " + arr.length + " votes</p>" + ["p", "c", "a", "n", "aucun"].filter(function (k) { return n[k]; }).map(function (k) {
        return '<div class="drow"><span>' + PV[k] + '</span><span class="dbar"><i style="width:' + (100 * n[k] / arr.length) + "%;background:" + (COL[k] || COL.n) + '"></i></span><span>' + n[k] + "</span></div>";
      }).join("") + "</div>";
    }
    // Participation aux scrutins solennels, la mesure juste (agent de collecte, data/app.js).
    var part = MD.candidats[id] && MD.candidats[id].participation, sol = part && part.solennels;
    var med = MD.medianeSolennels && MD.medianeSolennels.taux;
    var last = cv.mandats[cv.mandats.length - 1];
    var note = cv.mandats.length
      ? (last.fin ? c.name + " a siégé à l’Assemblée de " + fmtDate(cv.mandats[0].debut) + " à " + fmtDate(last.fin) + ". Pour les votes en dehors de cette période, on montre ceux de son groupe (" + fam + ")."
        : "Quand " + c.name + " siégeait, c’est son vote personnel. Sinon (avant son élection, ou pendant un passage au gouvernement), c’est celui de son groupe (" + fam + ").")
      : c.name + " n’a pas été député depuis 2022 (" + c.mandate + ", à vérifier). On montre les votes de son groupe à l’Assemblée (" + fam + "), à titre de contexte : ce ne sont pas ses votes.";
    var counts = {};
    all.forEach(function (x) { counts[x.l.cat] = (counts[x.l.cat] || 0) + 1; });
    var cats = [["tout", "Tous"]].concat(MV.categories.filter(function (k) { return counts[k.id]; }).map(function (k) { return [k.id, k.label]; }));
    var list = all.filter(function (x) { return vs.filter === "tout" || x.l.cat === vs.filter; });
    return '<div class="screen enter">' + topbar("#/votes/personnes", "Par personne") +
      '<section class="box"><div class="cand-head"><span class="avatar lg" aria-hidden="true">' + initials(c.name) + '</span><div><span class="name-tag">' + esc(c.name) + '</span><span class="meta">' + esc(c.party) + " · " + esc(candRole(c)) + "</span></div></div>" +
      '<p class="group-note">' + esc(note) + "</p>" +
      (sol && sol.taux !== null ? '<div class="stats"><div class="stat"><b class="accent">' + String(sol.taux).replace(".", ",") + ' %</b><span>des scrutins solennels</span></div><div class="stat"><b>' + voted.length + "/" + perso.length + "</b><span>grands votes où il a voté</span></div></div>" +
        '<p class="cap">Médiane de l’hémicycle aux scrutins solennels : ' + String(med).replace(".", ",") + " %. Beaucoup de lois sont votées dans un hémicycle peu rempli : c’est courant, d’où l’intérêt des scrutins solennels, annoncés à l’avance.</p>" : "") +
      dist(voted, "Quand il a voté") + dist(grp, "Votes de son groupe") + "</section>" +
      '<div class="chips">' + cats.map(function (x) { return '<button type="button" class="chip" data-vfilter="' + x[0] + '" aria-pressed="' + (vs.filter === x[0]) + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>" +
      list.slice(0, vs.limit).map(function (x) {
        var v = x.v;
        var who = v.perso ? (v.pos === "x" ? "Absent" + (v.gpos ? " · son groupe " + v.g + " : " + PV[v.gpos] : "") : "Son vote") : "Vote du groupe " + v.g + (v.coh !== null && v.coh < 67 ? " (divisé)" : "");
        return lawRow(x.l, "?p=" + id, '<span class="m" style="align-items:center"><span class="who">' + esc(who) + '</span><span class="pv ' + v.pos + '">' + PV[v.pos] + "</span></span>");
      }).join("") +
      (list.length > vs.limit ? '<button type="button" class="next-btn" data-vmore="1">Voir plus</button>' : "") + foot() + "</div>";
  }

  // ======================================================================
  // MÉTHODE, LEXIQUE
  // ======================================================================

  function method() {
    return '<div class="screen enter">' + topbar("#/", "Comment on travaille") +
      '<section class="box flat"><p class="eb">Nos règles</p><ul class="list">' +
      "<li>Une source par information, cliquable. Pas de source, pas de publication.</li>" +
      "<li>Aucune consigne de vote, aucune comparaison entre candidats. Ordre alphabétique, aucune couleur de parti.</li>" +
      "<li><b>Actualité</b> : titres et liens des articles de 10 médias généralistes ; les déclarations des candidats sont relevées en citation directe, vérifiées mot pour mot dans l’article, puis relues par l’équipe.</li>" +
      "<li><b>Programmes</b> : recopiés mot pour mot, jamais résumés. Un programme vérifie que chaque mesure se trouve telle quelle dans la source.</li>" +
      "<li><b>Qui a voté quoi ?</b> : votes officiels de l’Assemblée nationale, collectés chaque nuit et relus avant publication. Quand un candidat a siégé, c’est son vote ; sinon, celui de son groupe, toujours écrit comme tel.</li>" +
      "<li>Les textes préparés avec l’IA sont relus et validés par l’équipe.</li>" +
      "<li>Sans compte : tes préférences restent sur ton téléphone, rien n’est envoyé.</li>" +
      "</ul></section>" +
      '<a class="btn-dark" href="https://github.com/SimonPelissier/agenticIA-VF/issues/new" target="_blank" rel="noopener">Signaler une erreur</a>' +
      foot() + "</div>";
  }
  function lexicon() {
    return '<div class="screen enter">' + topbar("#/methode", "Lexique") + '<h1 class="h1">Les mots <span>compliqués</span></h1>' +
      '<section class="box flat"><dl class="gloss">' + D.glossary.map(function (g) { return "<div><dt>" + esc(g.term) + "</dt><dd>" + esc(g.def) + "</dd></div>"; }).join("") + "</dl></section>" + foot() + "</div>";
  }
  function notFound() { return '<div class="screen">' + topbar("#/", "Page introuvable") + '<a class="btn-dark" href="#/">Retour à l’accueil</a></div>'; }

  // ======================================================================
  // ROUTEUR
  // ======================================================================

  var TAB = { "": "accueil", actu: "actu", programmes: "programmes", votes: "votes" };
  var lastRoute = null;

  function parse() {
    var h = location.hash.replace(/^#\/?/, ""), q = {}, k = h.indexOf("?");
    if (k !== -1) {
      h.slice(k + 1).split("&").forEach(function (kv) { var p = kv.split("="); q[p[0]] = decodeURIComponent(p[1] || ""); });
      h = h.slice(0, k);
    }
    return { parts: h.split("/"), q: q, key: h };
  }

  function route() {
    var r = parse(), p = r.parts, html;
    if (r.key !== lastRoute) {
      // Nouvel écran : on oublie le groupe allumé et, hors fiche loi, les filtres de liste.
      vs.g = null;
      if (p[1] !== "loi") { vs.filter = "tout"; vs.limit = 12; }
      lastRoute = r.key;
    }
    switch (p[0]) {
      case "": html = home(); break;
      case "actu": html = p[1] === "a" ? actuDetail(p[2]) : p[1] === "perso" ? actuPerso() : actuFeed(); break;
      case "programmes": html = p[1] ? programme(p[1]) : programmes(); break;
      case "votes":
        html = p[1] === "sujets" ? (p[2] ? votesCat(p[2]) : votesSujets())
          : p[1] === "personnes" ? (p[2] ? votesPersonne(p[2]) : votesPersonnes())
          : p[1] === "loi" ? votesLoi(p[2], r.q) : votesStart();
        break;
      case "methode": html = method(); break;
      case "lexique": html = lexicon(); break;
      default: html = notFound();
    }
    app.innerHTML = html;
    var tab = TAB[p[0]] || "", links = document.querySelectorAll(".tabbar a");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("data-tab") === tab) links[i].setAttribute("aria-current", "page"); else links[i].removeAttribute("aria-current");
    }
  }

  function rerender(focusSearch) {
    var y = window.scrollY;
    route();
    var e = app.querySelector(".enter");
    if (e) e.classList.remove("enter");
    window.scrollTo(0, y);
    if (focusSearch) { var q = app.querySelector("#q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }

  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });

  // ---------- Interactions ----------

  var sheet = document.getElementById("sheet");
  var lastFocus = null;

  // Feuille du bas : lexique, ou une mesure de programme (texte posé en textContent, donc jamais interprété).
  function showSheet(eb, title, body, extraHtml, measure) {
    lastFocus = document.activeElement;
    document.getElementById("sheet-eb").textContent = eb;
    document.getElementById("sheet-title").textContent = title;
    document.getElementById("sheet-body").textContent = body;
    document.getElementById("sheet-extra").innerHTML = extraHtml || "";
    sheet.classList.toggle("measure-sheet", !!measure);
    sheet.hidden = false;
    sheet.querySelector(".sheet-panel").scrollTop = 0;
    sheet.querySelector(".btn-dark").focus();
  }
  function openTerm(i) { var g = D.glossary[i]; if (g) showSheet("Lexique", g.term, g.def); }
  function closeSheet() { sheet.hidden = true; if (lastFocus) lastFocus.focus(); }

  function toggleIn(list, v) { var i = list.indexOf(v); if (i === -1) list.push(v); else list.splice(i, 1); return list; }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-term],[data-close],[data-chap],[data-mesure],[data-amode],[data-apick],[data-follow],[data-fsujet],[data-vfilter],[data-vmore],[data-vg]");
    if (!t) return;
    var d = t.dataset;
    if (d.term !== undefined) openTerm(+d.term);
    else if (t.hasAttribute("data-close")) closeSheet();
    else if (d.chap) { openChapter = openChapter === d.chap ? null : d.chap; rerender(); }
    else if (d.mesure) openMeasure(d.mesure);
    else if (d.amode) { actu.mode = d.amode; actu.pick = "all"; rerender(); }
    else if (d.apick) { actu.pick = d.apick; rerender(); }
    else if (d.follow) { var p = prefs(); toggleIn(p.cands, d.follow); save(FIL_KEY, p); rerender(); }
    else if (d.fsujet) { var p2 = prefs(); toggleIn(p2.sujets, d.fsujet); save(FIL_KEY, p2); rerender(); }
    else if (d.vfilter) { vs.filter = d.vfilter; vs.limit = 12; rerender(); }
    else if (d.vmore) { vs.limit += 12; rerender(); }
    else if (d.vg) { vs.g = vs.g === d.vg ? null : d.vg; rerender(); }
  });

  document.addEventListener("change", function (e) {
    var m = e.target.getAttribute && e.target.getAttribute("data-fmedia");
    if (!m) return;
    var p = prefs(), all = Object.keys(MA.medias), cur = p.medias || all.slice();
    p.medias = e.target.checked ? cur.concat([m]).filter(function (x, i, a) { return a.indexOf(x) === i; }) : cur.filter(function (x) { return x !== m; });
    if (p.medias.length === all.length) p.medias = null;
    save(FIL_KEY, p);
    rerender();
  });

  document.addEventListener("input", function (e) { if (e.target.id === "q") { vs.q = e.target.value; rerender(true); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

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

  // Anciennes adresses : pages retirées (gardées dans la branche archive/v4-avant-4-pages).
  var anciennes = { sujets: "#/votes/sujets", themes: "#/votes/sujets", candidats: "#/votes/personnes", quiz: "#/", debat: "#/" };
  var p0 = parse().parts[0];
  if (anciennes[p0]) location.replace(anciennes[p0]);

  route();
})();
