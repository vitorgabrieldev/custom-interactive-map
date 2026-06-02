-- ============================================================
-- 003 — ITEM_RARITIES
-- Tabela de referência para raridades de item.
-- Cada raridade carrega um multiplicador de valor (usado em
-- cálculos de crafting, loot e comércio futuramente).
-- ============================================================

create table public.item_rarities (
  id                serial      primary key,
  slug              text        not null unique,   -- 'NORMAL', 'RARO', etc.
  label             text        not null,
  color_hex         text        not null,          -- cor de destaque na UI
  utility_level     integer     not null unique check (utility_level >= 1),
  drop_weight       numeric(5,4) not null default 1.0, -- peso relativo no loot (1.0 = base)
  sort_order        integer     not null default 0,
  active            boolean     not null default true,
  created_at        timestamptz not null default now()
);

comment on table  public.item_rarities               is 'Raridades de item. Extensível sem migration de schema.';
comment on column public.item_rarities.utility_level is 'Nível de utilidade (1–6+). Crafting: mesmo tipo + mesmo nível → nível+1.';
comment on column public.item_rarities.drop_weight   is 'Peso relativo no sistema de loot. Valores menores = mais raro.';

-- ── Seed ─────────────────────────────────────────────────────
-- utility_level define a escala de crafting:
--   NORMAL(1) + NORMAL(1) → INCOMUM(2)
--   INCOMUM(2) + INCOMUM(2) → RARO(3) ... e assim por diante
insert into public.item_rarities (slug, label, color_hex, utility_level, drop_weight, sort_order) values
  ('NORMAL',    'Normal',   '#9ca3af', 1, 0.5500, 10),
  ('INCOMUM',   'Incomum',  '#4ade80', 2, 0.2800, 20),
  ('RARO',      'Raro',     '#60a5fa', 3, 0.1000, 30),
  ('LENDÁRIO',  'Lendário', '#f59e0b', 4, 0.0500, 40),
  ('ÚNICO',     'Único',    '#ec4899', 5, 0.0150, 50),
  ('ARTEFATO',  'Artefato', '#8b5cf6', 6, 0.0050, 60);

-- A soma dos drop_weight = 1.0 (usado como distribuição de probabilidade)

-- ── RLS ──────────────────────────────────────────────────────
alter table public.item_rarities enable row level security;

create policy "item_rarities_select_public"
  on public.item_rarities for select
  using (true);
