-- ============================================================
-- 004 — ITEMS_CATALOG
-- Catálogo global de todos os itens existentes no jogo.
-- Cada linha é um "template" de item. Instâncias ficam em
-- player_inventory e base_stash.
-- ============================================================

create table public.items_catalog (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  slug             text        not null unique,             -- chave técnica, ex: 'racao_c47'
  item_type_id     integer     not null references public.item_types(id),
  rarity_id        integer     not null references public.item_rarities(id),
  description      text,
  icon             text,                                    -- emoji ou nome de asset
  -- Propriedades extensíveis sem migration
  attributes       jsonb       not null default '{}',      -- ex: {"durability": 3, "heal_amount": 50}
  -- Crafting
  craftable        boolean     not null default false,      -- pode ser resultado de crafting?
  craft_result_of  uuid        references public.items_catalog(id), -- auto-ref: qual item resulta deste
  -- Loot
  lootable         boolean     not null default true,       -- pode aparecer em loot spawns?
  -- Estado
  active           boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.items_catalog              is 'Templates de itens. Instâncias ficam em player_inventory e base_stash.';
comment on column public.items_catalog.attributes   is 'Atributos livres em JSONB — adicione propriedades sem novas colunas.';
comment on column public.items_catalog.craftable    is 'Se true, este item pode ser criado via crafting (dois itens de nível inferior).';

-- ── Índices ──────────────────────────────────────────────────
create index idx_items_catalog_type     on public.items_catalog (item_type_id);
create index idx_items_catalog_rarity   on public.items_catalog (rarity_id);
create index idx_items_catalog_lootable on public.items_catalog (lootable) where lootable = true;
create index idx_items_catalog_active   on public.items_catalog (active)   where active   = true;

-- ── updated_at ───────────────────────────────────────────────
create trigger trg_items_catalog_updated_at
  before update on public.items_catalog
  for each row execute procedure public.set_updated_at();

-- ── Seed: itens iniciais ─────────────────────────────────────
-- SUPRIMENTOS
insert into public.items_catalog (name, slug, item_type_id, rarity_id, description, icon, lootable) values
  ('Ração C-47',       'racao_c47',        (select id from public.item_types where slug = 'SUPRIMENTO'), (select id from public.item_rarities where slug = 'NORMAL'),   'Ração militar básica. Mantém você em pé por mais um dia.',        '🥫', true),
  ('Água Purificada',  'agua_purificada',  (select id from public.item_types where slug = 'SUPRIMENTO'), (select id from public.item_rarities where slug = 'NORMAL'),   'Garrafa de água tratada. Essencial para sobreviver na zona.',     '💧', true),
  ('Medicamento',      'medicamento',      (select id from public.item_types where slug = 'SUPRIMENTO'), (select id from public.item_rarities where slug = 'INCOMUM'),  'Kit básico de curativo. Restaura parcialmente a integridade da base.', '💊', true),
  ('Kit Médico',       'kit_medico',       (select id from public.item_types where slug = 'SUPRIMENTO'), (select id from public.item_rarities where slug = 'RARO'),     'Kit completo. Restaura significativamente a integridade da base.','🏥', true);

-- FERRAMENTAS
insert into public.items_catalog (name, slug, item_type_id, rarity_id, description, icon, lootable) values
  ('Rádio de Campo',   'radio_campo',      (select id from public.item_types where slug = 'FERRAMENTA'), (select id from public.item_rarities where slug = 'NORMAL'),   'Transmite mensagens curtas. Necessário para o Rádio de Emergência.', '📻', true),
  ('Binóculo',         'binoculo',         (select id from public.item_types where slug = 'FERRAMENTA'), (select id from public.item_rarities where slug = 'INCOMUM'),  'Revela área nebulada ao redor do cursor por 10 min.',             '🔭', true),
  ('Detector de Sinal','detector_sinal',   (select id from public.item_types where slug = 'FERRAMENTA'), (select id from public.item_rarities where slug = 'RARO'),     'Detecta espias e raids em andamento no seu território.',         '📡', true),
  ('Scanner Tático',   'scanner_tatico',   (select id from public.item_types where slug = 'FERRAMENTA'), (select id from public.item_rarities where slug = 'LENDÁRIO'), 'Revela conteúdo do stash de bases próximas por 5 min.',          '🖥️', true);

-- ARMAS
insert into public.items_catalog (name, slug, item_type_id, rarity_id, description, icon, lootable) values
  ('Faca de Combate',  'faca_combate',     (select id from public.item_types where slug = 'ARMA'), (select id from public.item_rarities where slug = 'NORMAL'),   'Arma silenciosa. Reduz timer de raid em 30 min.',               '🔪', true),
  ('Pistola 9mm',      'pistola_9mm',      (select id from public.item_types where slug = 'ARMA'), (select id from public.item_rarities where slug = 'INCOMUM'),  'Aumenta chance de sucesso em sabotagens.',                       '🔫', true),
  ('Molotov',          'molotov',          (select id from public.item_types where slug = 'ARMA'), (select id from public.item_rarities where slug = 'RARO'),     'Destrói 2 slots do stash inimigo instantaneamente. Uso único.',  '🍾', true),
  ('Granada EMP',      'granada_emp',      (select id from public.item_types where slug = 'ARMA'), (select id from public.item_rarities where slug = 'LENDÁRIO'), 'Cancela raid ativo em qualquer base aliada. Uso único.',         '💣', true);

-- BLUEPRINTS
insert into public.items_catalog (name, slug, item_type_id, rarity_id, description, icon, lootable) values
  ('Planta Nível 2',   'blueprint_lvl2',   (select id from public.item_types where slug = 'BLUEPRINT'), (select id from public.item_rarities where slug = 'INCOMUM'),  'Necessário para fazer upgrade da base para nível 2.',            '📋', true),
  ('Planta Nível 3',   'blueprint_lvl3',   (select id from public.item_types where slug = 'BLUEPRINT'), (select id from public.item_rarities where slug = 'RARO'),     'Necessário para fazer upgrade da base para nível 3.',            '📐', true),
  ('Planta Bunker',    'blueprint_bunker', (select id from public.item_types where slug = 'BLUEPRINT'), (select id from public.item_rarities where slug = 'LENDÁRIO'), 'Transforma a base em bunker — imune a raids por 24h após ativação.', '🏗️', true);

-- CHAVES
insert into public.items_catalog (name, slug, item_type_id, rarity_id, description, icon, lootable) values
  ('Chave de Quarentena', 'chave_quarentena', (select id from public.item_types where slug = 'CHAVE'), (select id from public.item_rarities where slug = 'RARO'),     'Abre zonas de quarentena no mapa. Uso único.',                   '🗝️', true),
  ('Chave de Dead Drop',  'chave_dead_drop',  (select id from public.item_types where slug = 'CHAVE'), (select id from public.item_rarities where slug = 'INCOMUM'),  'Revela o conteúdo de um dead drop específico.',                  '🔑', true),
  ('Passe de Acesso',     'passe_acesso',     (select id from public.item_types where slug = 'CHAVE'), (select id from public.item_rarities where slug = 'ÚNICO'),    'Acesso único a área bloqueada de evento especial.',              '💳', false);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.items_catalog enable row level security;

create policy "items_catalog_select_public"
  on public.items_catalog for select
  using (active = true);
