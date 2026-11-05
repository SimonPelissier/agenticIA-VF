// Charge les données collectées depuis Supabase (lecture seule), puis lance l'application.
// Remet les données dans la forme qu'avaient les anciens fichiers data/app.js, data/votes.js et data/actu.js :
// js/app.js n'a pas à savoir d'où elles viennent.
(function () {
  var C = window.MARIAN_SUPABASE;
  var app = document.getElementById("app");
  app.innerHTML = '<p class="note" style="padding:48px 0;text-align:center">Chargement des données…</p>';

  function lire(chemin) {
    return fetch(C.url + "/rest/v1/" + chemin, { headers: { apikey: C.cle, Authorization: "Bearer " + C.cle } })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " (" + chemin.split("?")[0] + ")");
        return r.json();
      });
  }

  // Articles des 30 derniers jours, comme l'ancien fichier data/actu.js.
  var depuis = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  Promise.all([
    // site_donnees et site_votes : préparés chaque nuit par l'agent de collecte ; medias : noms des journaux.
    lire("collecte?select=cle,valeur&cle=in.(site_donnees,site_votes,medias)"),
    lire("articles?select=id,media,titre,url,candidats,date&date=gte." + depuis + "&order=date.desc,id.desc"),
    // Les règles d'accès ne renvoient au public que les déclarations validées par l'équipe.
    lire("declarations?select=*&order=id")
  ]).then(function (r) {
    var c = {};
    r[0].forEach(function (l) { c[l.cle] = l.valeur; });
    window.MARIAN_DONNEES = c.site_donnees;
    window.MARIAN_VOTES = c.site_votes;
    window.MARIAN_ACTU = {
      medias: c.medias || {},
      articles: r[1].map(function (a) {
        return { id: a.id, media: a.media, titre: a.titre, url: a.url, candidats: a.candidats || [], date: (a.date || "").slice(0, 16) };
      }),
      declarations: r[2].map(function (d) {
        return {
          id: d.id, candidat: d.candidat, date: d.date, media: d.media, url: d.url, titreArticle: d.titre_article,
          citation: d.citation, resume: d.resume, type: d.type, theme: d.theme, voteLie: d.vote_lie,
          factcheck: d.factcheck, statut: d.verification, verifieDans: d.verifie_dans, ajouteLe: d.ajoute_le
        };
      })
    };
  }).catch(function (erreur) {
    // Sans Supabase, l'application s'ouvre quand même (programmes, lexique), avec un message.
    if (window.console) console.error("Supabase injoignable :", erreur);
    var alerte = document.createElement("div");
    alerte.className = "banner";
    alerte.setAttribute("role", "alert");
    alerte.style.margin = "12px auto";
    alerte.style.maxWidth = "640px";
    alerte.innerHTML = "<p>Les votes et l’actualité n’ont pas pu être chargés. Vérifie ta connexion, puis recharge la page.</p>";
    app.parentNode.insertBefore(alerte, app);
  }).then(function () {
    var s = document.createElement("script");
    s.src = "js/app.js";
    document.body.appendChild(s);
  });
})();
