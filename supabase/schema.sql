-- MarIAn : base Supabase des données collectées (votes de l'Assemblée, articles, déclarations).
-- À coller une fois dans Supabase : SQL Editor → New query → Run. Peut être relancé sans risque.
--
-- Règles d'accès :
--   - le public (clé « anon », utilisée par le site) ne peut QUE LIRE, et seulement ce qui est publiable ;
--   - les agents écrivent avec la clé « service_role », rangée dans les secrets (GitHub, Claude),
--     jamais dans le code ni dans le site.
-- Les contenus écrits par l'équipe (votes clés, programmes, lexique) restent dans le dépôt GitHub.

-- ============================================================
-- Votes de l'Assemblée nationale (agent de collecte)
-- ============================================================

create table if not exists groupes (
  ref         text primary key,          -- identifiant officiel du groupe (ex. PO845401)
  abrege      text,                      -- sigle (ex. RN)
  nom         text,
  legislature text,
  debut       date,
  fin         date
);

create table if not exists scrutins (
  uid          text primary key,         -- identifiant officiel (ex. VTANR5L17V3300)
  legislature  text not null,
  numero       integer not null,
  date         date,
  titre        text,
  type         text,
  solennel     boolean default false,
  sort         text,                     -- adopté / rejeté
  pour         integer,
  contre       integer,
  abstentions  integer,
  votants      integer,
  requis       integer,
  url          text,
  groupes      jsonb,                    -- position, cohésion et voix de chaque groupe
  -- Renseignés seulement pour les « grands votes » (vote final d'un texte, motion de censure, déclaration) :
  genre        text,                     -- loi / censure / declaration ; null pour un amendement
  categorie    text,                     -- catégorie de « Qui a voté quoi ? »
  titre_court  text,
  lecture      text,
  groupes_hemicycle jsonb,               -- groupes dans l'ordre de l'hémicycle, de gauche à droite
  maj          timestamptz default now()
);
create index if not exists scrutins_date_idx on scrutins (date desc);
create index if not exists scrutins_grands_idx on scrutins (date desc) where genre is not null;
-- Pas d'unicité sur (législature, numéro) : le Congrès (identifiants VTCG…) a sa propre numérotation.
drop index if exists scrutins_leg_num_idx;
create index if not exists scrutins_leg_numero_idx on scrutins (legislature, numero);

create table if not exists candidats (
  id            text primary key,        -- ex. faure (mêmes identifiants que js/data.js)
  nom           text,
  parti         text,
  famille       text,                    -- famille de groupe à l'Assemblée
  acteur        text,                    -- identifiant de député, null si jamais député
  mandats       jsonb,
  groupes       jsonb,
  participation jsonb
);

create table if not exists votes_candidats (
  candidat        text references candidats (id) on delete cascade,
  scrutin         text references scrutins (uid) on delete cascade,
  position        text,                  -- pour / contre / abstention / non-votant
  groupe          text,
  par_delegation  boolean default false,
  primary key (candidat, scrutin)
);
create index if not exists votes_candidats_scrutin_idx on votes_candidats (scrutin);

-- Chiffres de la dernière collecte : date du dernier scrutin, médiane de participation, sources…
create table if not exists collecte (
  cle    text primary key,
  valeur jsonb,
  maj    timestamptz default now()
);

-- ============================================================
-- Veille médias (routine quotidienne)
-- ============================================================

create table if not exists articles (
  id         text primary key,           -- empreinte courte du lien
  media      text,
  titre      text,                       -- titre seulement : jamais le texte de l'article
  url        text unique,
  date       timestamptz,
  candidats  text[],
  vu_le      date,
  traite     boolean default false
);
create index if not exists articles_date_idx on articles (date desc);

create table if not exists declarations (
  id             text primary key,
  candidat       text,
  date           date,
  media          text,
  url            text,
  titre_article  text,
  citation       text not null,
  resume         text,
  type           text check (type in ('engagement', 'position')),
  theme          text,
  vote_lie       text,
  factcheck      jsonb,
  -- Vérification automatique (verifier.py) :
  verification   text check (verification in ('verifiee', 'a-verifier', 'rejetee')),
  verifie_dans   text,                   -- article / flux RSS
  motif          text,
  -- Validation humaine (dans l'éditeur de tables de Supabase) : seule « validee » est publiée.
  validation     text not null default 'a-valider' check (validation in ('a-valider', 'validee', 'refusee')),
  valide_par     text,
  valide_le      timestamptz,
  ajoute_le      date default current_date
);
create index if not exists declarations_validation_idx on declarations (validation, date desc);

-- ============================================================
-- Règles d'accès (Row Level Security)
-- ============================================================

alter table groupes          enable row level security;
alter table scrutins         enable row level security;
alter table candidats        enable row level security;
alter table votes_candidats  enable row level security;
alter table collecte         enable row level security;
alter table articles         enable row level security;
alter table declarations     enable row level security;

-- Lecture publique des données officielles et des articles (titres et liens).
drop policy if exists "lecture publique" on groupes;
create policy "lecture publique" on groupes for select to anon, authenticated using (true);
drop policy if exists "lecture publique" on scrutins;
create policy "lecture publique" on scrutins for select to anon, authenticated using (true);
drop policy if exists "lecture publique" on candidats;
create policy "lecture publique" on candidats for select to anon, authenticated using (true);
drop policy if exists "lecture publique" on votes_candidats;
create policy "lecture publique" on votes_candidats for select to anon, authenticated using (true);
drop policy if exists "lecture publique" on collecte;
create policy "lecture publique" on collecte for select to anon, authenticated using (true);
drop policy if exists "lecture publique" on articles;
create policy "lecture publique" on articles for select to anon, authenticated using (true);

-- Déclarations : le public ne voit que celles validées par l'équipe.
drop policy if exists "lecture des validées" on declarations;
create policy "lecture des validées" on declarations for select to anon, authenticated using (validation = 'validee');

-- Aucune règle d'écriture pour le public : seules les clés « service_role » des agents peuvent écrire.

-- Vue pratique : les grands votes, du plus récent au plus ancien.
create or replace view grands_votes with (security_invoker = true) as
  select uid, legislature, numero, date, titre_court, lecture, genre, categorie, sort,
         pour, contre, abstentions, requis, url, solennel, groupes_hemicycle
  from scrutins where genre is not null order by date desc, uid desc;
