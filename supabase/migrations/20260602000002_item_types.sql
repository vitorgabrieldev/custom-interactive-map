-- ============================================================
-- 002 — ITEM_TYPES
-- Tabela de referência para tipos de item.
-- Usar tabela em vez de ENUM permite adicionar novos tipos
-- sem migration de schema — só um INSERT.
-- ============================================================

create table public.item_types (
  id          serial      primary key,
  slug        text        not null unique,  -- chave usada no código: 'SUPRIMENTO', 'ARMA', etc.
  label       text        not null,         -- nome exibido na UI
  description text,
  icon        text,                         -- emoji ou código de ícone
  sort_order  integer     not null default 0,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.item_types is 'Tipos de item. Extensível sem migration de schema.';

-- ── Seed ─────────────────────────────────────────────────────
insert into public.item_types (slug, label, description, icon, sort_order) values
  ('SUPRIMENTO', 'Suprimento',  'Ração, água, medicamento — usados para curar base ou trocar com players.',     '🥫', 10),
  ('FERRAMENTA', 'Ferramenta',  'Rádio, binóculo, detector — ativam mecânicas do mapa.',                       '🔧', 20),
  ('ARMA',       'Arma',        'Faca, pistola, molotov — usados em conflitos e sabotagens.',                   '🔫', 30),
  ('BLUEPRINT',  'Blueprint',   'Esquemas de construção — necessários para upgrades de base.',                  '📋', 40),
  ('CHAVE',      'Chave',       'Abre zonas de quarentena ou dead drops específicos.',                          '🗝️', 50);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.item_types enable row level security;

-- Leitura pública (catálogo visível a todos)
create policy "item_types_select_public"
  on public.item_types for select
  using (true);

-- Escrita apenas para service_role (admin / migrations)
-- Nenhuma policy de insert/update/delete para authenticated → bloqueado por RLS
