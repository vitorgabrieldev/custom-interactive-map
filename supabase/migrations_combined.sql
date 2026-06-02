-- ============================================================
-- 001 — PLAYERS
-- Perfil público de cada jogador, vinculado ao auth.users.
-- Criado automaticamente via trigger no signup.
-- ============================================================

create table public.players (
  id               uuid        primary key references auth.users(id) on delete cascade,
  username         text        not null,
  rad_balance      integer     not null default 0 check (rad_balance >= 0),
  inventory_slots  integer     not null default 6  check (inventory_slots >= 6),
  streak_days      integer     not null default 0  check (streak_days >= 0),
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.players                is 'Perfil público de cada jogador.';
comment on column public.players.rad_balance    is 'Saldo atual em RAD. Nunca negativo — operações que zerariam o saldo são bloqueadas.';
comment on column public.players.inventory_slots is 'Slots do inventário pessoal (inviolável). Expansível com RAD.';
comment on column public.players.streak_days    is 'Dias consecutivos de login. Creditado pelo cron diário.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_players_username     on public.players (username);
create index idx_players_last_login   on public.players (last_login_at);

-- ── updated_at automático ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_players_updated_at
  before update on public.players
  for each row execute procedure public.set_updated_at();

-- ── Auto-criar perfil no signup ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.players enable row level security;

-- Qualquer um pode ver perfis públicos (username, streak, slots visíveis no mapa)
create policy "players_select_public"
  on public.players for select
  using (true);

-- Só o próprio player atualiza seu perfil
create policy "players_update_own"
  on public.players for update
  using (auth.uid() = id);
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
-- ============================================================
-- 005 — PLAYER_INVENTORY
-- Inventário pessoal do player. Inviolável — não pode ser
-- saqueado em raids. Limitado por players.inventory_slots.
-- ============================================================

create table public.player_inventory (
  id               uuid        primary key default gen_random_uuid(),
  player_id        uuid        not null references public.players(id) on delete cascade,
  item_catalog_id  uuid        not null references public.items_catalog(id),
  -- Metadados da instância (atributos que podem diferir do catálogo)
  instance_data    jsonb       not null default '{}',   -- ex: {"durability": 2} (estado atual)
  acquired_at      timestamptz not null default now(),
  acquired_from    text                                  -- 'LOOT' | 'CRAFT' | 'TRADE' | 'QUARENTENA' | 'RUÍNA'
);

comment on table  public.player_inventory              is 'Inventário pessoal — inviolável. Limitado por players.inventory_slots.';
comment on column public.player_inventory.instance_data is 'Estado atual da instância do item (durabilidade, cargas, etc.). Difere do catálogo quando o item é usado.';
comment on column public.player_inventory.acquired_from is 'Origem do item nesta instância.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_player_inv_player   on public.player_inventory (player_id);
create index idx_player_inv_item     on public.player_inventory (item_catalog_id);

-- ── Enforce slot limit ───────────────────────────────────────
-- Trigger que impede inserção quando inventário está cheio
create or replace function public.check_inventory_slots()
returns trigger language plpgsql as $$
declare
  current_count integer;
  max_slots     integer;
begin
  select count(*)            into current_count from public.player_inventory where player_id = new.player_id;
  select inventory_slots     into max_slots     from public.players           where id = new.player_id;

  if current_count >= max_slots then
    raise exception 'INVENTÁRIO_CHEIO: % slots ocupados de %', current_count, max_slots;
  end if;

  return new;
end;
$$;

create trigger trg_check_inventory_slots
  before insert on public.player_inventory
  for each row execute procedure public.check_inventory_slots();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.player_inventory enable row level security;

-- Player só vê seu próprio inventário
create policy "player_inv_select_own"
  on public.player_inventory for select
  using (auth.uid() = player_id);

-- Player só insere no próprio inventário
create policy "player_inv_insert_own"
  on public.player_inventory for insert
  with check (auth.uid() = player_id);

-- Player só deleta do próprio inventário (ao usar/craftar/depositar)
create policy "player_inv_delete_own"
  on public.player_inventory for delete
  using (auth.uid() = player_id);

-- Sem update direto — itens são consumidos e recriados (crafting, uso)
-- Exceção via service_role para operações de sistema
-- ============================================================
-- 006 — BASES
-- Bases plantadas pelos players no mapa. Cada base tem um
-- ciclo de vida: ATIVA → RUÍNA → DESTRUÍDA.
-- Custo de manutenção: 10 RAD/dia debitado do saldo do dono.
-- ============================================================

create table public.bases (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         uuid        not null references public.players(id) on delete cascade,
  name             text        not null,
  -- Posição geográfica
  lat              double precision not null,
  lng              double precision not null,
  -- Progressão
  level            integer     not null default 1 check (level between 1 and 10),
  -- Estado
  status           text        not null default 'ATIVA'
                               check (status in ('ATIVA', 'RUÍNA', 'DESTRUÍDA')),
  -- Stash
  stash_slots      integer     not null default 8  check (stash_slots >= 4),
  -- Economia
  daily_cost       integer     not null default 10 check (daily_cost >= 0),  -- RAD/dia
  -- Timestamps de ciclo de vida
  last_active_at   timestamptz not null default now(),  -- última ação do dono
  ruin_at          timestamptz,                          -- quando entrou em RUÍNA
  destroyed_at     timestamptz,                          -- quando foi para DESTRUÍDA
  -- Metadados extensíveis
  attributes       jsonb       not null default '{}',   -- ex: {"bunker_active": true, "faction": "alpha"}
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.bases                  is 'Bases plantadas no mapa. Ciclo de vida: ATIVA → RUÍNA → DESTRUÍDA.';
comment on column public.bases.level            is 'Nível da base (1–10). Cada nível requer blueprint e RAD.';
comment on column public.bases.stash_slots      is 'Slots de armazenamento interno. Expansível futuramente.';
comment on column public.bases.daily_cost       is 'RAD debitado por dia para manter a base ativa.';
comment on column public.bases.last_active_at   is 'Atualizado sempre que o dono faz qualquer ação. Usado pelo cron para detectar abandono.';
comment on column public.bases.attributes       is 'Atributos extensíveis: buffs ativos, facção, personalização visual, etc.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_bases_owner      on public.bases (owner_id);
create index idx_bases_status     on public.bases (status);
create index idx_bases_lat_lng on public.bases (lat, lng) where status != 'DESTRUÍDA';

-- ── updated_at ───────────────────────────────────────────────
create trigger trg_bases_updated_at
  before update on public.bases
  for each row execute procedure public.set_updated_at();

-- ── Limite de bases por player ───────────────────────────────
-- Por ora: 1 base ativa por player (expansível via atributo ou tabela futura)
create or replace function public.check_base_limit()
returns trigger language plpgsql as $$
declare
  active_count integer;
begin
  select count(*) into active_count
  from public.bases
  where owner_id = new.owner_id and status = 'ATIVA';

  if active_count >= 1 then
    raise exception 'LIMITE_DE_BASES: você já possui uma base ativa.';
  end if;

  return new;
end;
$$;

create trigger trg_check_base_limit
  before insert on public.bases
  for each row execute procedure public.check_base_limit();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.bases enable row level security;

-- Todos veem bases no mapa (exceto DESTRUÍDAS)
create policy "bases_select_public"
  on public.bases for select
  using (status != 'DESTRUÍDA');

-- Só o dono cria sua base
create policy "bases_insert_own"
  on public.bases for insert
  with check (auth.uid() = owner_id);

-- Só o dono atualiza (ex: renomear, depositar RAD)
-- Operações de sistema (cron) usam service_role (bypassa RLS)
create policy "bases_update_own"
  on public.bases for update
  using (auth.uid() = owner_id);
-- ============================================================
-- 007 — BASE_STASH
-- Itens armazenados dentro de uma base. Diferente do
-- inventário pessoal — pode ser saqueado em raids.
-- Acessível pelo dono e pelo ladrão após raid concluído.
-- ============================================================

create table public.base_stash (
  id               uuid        primary key default gen_random_uuid(),
  base_id          uuid        not null references public.bases(id) on delete cascade,
  item_catalog_id  uuid        not null references public.items_catalog(id),
  deposited_by     uuid        not null references public.players(id),
  instance_data    jsonb       not null default '{}',
  deposited_at     timestamptz not null default now()
);

comment on table  public.base_stash              is 'Stash da base — raidável. Slots limitados por bases.stash_slots.';
comment on column public.base_stash.deposited_by is 'Player que depositou o item (pode ser diferente do dono da base futuramente).';

-- ── Índices ──────────────────────────────────────────────────
create index idx_base_stash_base   on public.base_stash (base_id);
create index idx_base_stash_item   on public.base_stash (item_catalog_id);

-- ── Enforce slot limit do stash ──────────────────────────────
create or replace function public.check_stash_slots()
returns trigger language plpgsql as $$
declare
  current_count integer;
  max_slots     integer;
begin
  select count(*)   into current_count from public.base_stash where base_id = new.base_id;
  select stash_slots into max_slots    from public.bases       where id = new.base_id;

  if current_count >= max_slots then
    raise exception 'STASH_CHEIO: % slots ocupados de %', current_count, max_slots;
  end if;

  return new;
end;
$$;

create trigger trg_check_stash_slots
  before insert on public.base_stash
  for each row execute procedure public.check_stash_slots();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.base_stash enable row level security;

-- Dono da base vê tudo no stash da sua base
create policy "stash_select_owner"
  on public.base_stash for select
  using (
    exists (
      select 1 from public.bases
      where bases.id = base_stash.base_id
        and bases.owner_id = auth.uid()
    )
  );

-- Qualquer um vê o stash de bases em estado RUÍNA (loot liberado)
create policy "stash_select_ruin"
  on public.base_stash for select
  using (
    exists (
      select 1 from public.bases
      where bases.id = base_stash.base_id
        and bases.status = 'RUÍNA'
    )
  );

-- Dono deposita no stash
create policy "stash_insert_owner"
  on public.base_stash for insert
  with check (
    exists (
      select 1 from public.bases
      where bases.id = base_stash.base_id
        and bases.owner_id = auth.uid()
        and bases.status   = 'ATIVA'
    )
  );

-- Dono retira do stash
create policy "stash_delete_owner"
  on public.base_stash for delete
  using (
    exists (
      select 1 from public.bases
      where bases.id = base_stash.base_id
        and bases.owner_id = auth.uid()
    )
  );

-- Deleção por raid: executada via service_role na função de resolução
-- ============================================================
-- 008 — RAIDS
-- Sistema de invasão de bases. Timer de 5 horas.
-- Dono pode cancelar enquanto estiver PENDENTE.
-- Após resolves_at: cron executa o saque e marca CONCLUÍDO.
-- ============================================================

create table public.raids (
  id               uuid        primary key default gen_random_uuid(),
  raider_id        uuid        not null references public.players(id) on delete cascade,
  base_id          uuid        not null references public.bases(id)   on delete cascade,
  status           text        not null default 'PENDENTE'
                               check (status in ('PENDENTE', 'CONCLUÍDO', 'CANCELADO', 'DEFENDIDO')),
  -- Timing
  started_at       timestamptz not null default now(),
  resolves_at      timestamptz not null default now() + interval '5 hours',
  resolved_at      timestamptz,                        -- quando foi de fato resolvido
  -- Resultado (preenchido na resolução)
  items_taken      jsonb,                              -- snapshot [{item_catalog_id, name, rarity}]
  cancelled_by     text,                               -- 'OWNER' | 'RAIDER' | 'SYSTEM'
  cancel_reason    text,
  -- Metadados
  attributes       jsonb       not null default '{}',  -- ex: {"weapon_used": "faca_combate", "timer_reduction": 30}
  created_at       timestamptz not null default now()
);

comment on table  public.raids               is 'Raids em andamento e histórico. Timer de 5h. Dono pode cancelar enquanto PENDENTE.';
comment on column public.raids.resolves_at   is 'Quando o raid é executado automaticamente. Pode ser reduzido por armas (Faca = -30min).';
comment on column public.raids.items_taken   is 'Snapshot dos itens saqueados após resolução. Preserva histórico mesmo após exclusão do stash.';
comment on column public.raids.cancelled_by  is 'Quem cancelou: dono (defendeu), ladrão (desistiu) ou sistema.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_raids_raider      on public.raids (raider_id);
create index idx_raids_base        on public.raids (base_id);
create index idx_raids_status      on public.raids (status);
create index idx_raids_resolves_at on public.raids (resolves_at) where status = 'PENDENTE';

-- ── Impede raids duplicados na mesma base ────────────────────
create unique index idx_raids_unique_pending
  on public.raids (base_id)
  where status = 'PENDENTE';

-- ── Impede dono de atacar a própria base ─────────────────────
create or replace function public.check_raid_self()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.bases
    where id = new.base_id and owner_id = new.raider_id
  ) then
    raise exception 'RAID_INVÁLIDO: você não pode invadir sua própria base.';
  end if;
  return new;
end;
$$;

create trigger trg_check_raid_self
  before insert on public.raids
  for each row execute procedure public.check_raid_self();

-- ── Impede raid em base já em RUÍNA (loot direto, sem raid) ──
create or replace function public.check_raid_on_ruin()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.bases
    where id = new.base_id and status = 'RUÍNA'
  ) then
    raise exception 'BASE_EM_RUÍNA: acesse diretamente o loot sem raid.';
  end if;
  return new;
end;
$$;

create trigger trg_check_raid_on_ruin
  before insert on public.raids
  for each row execute procedure public.check_raid_on_ruin();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.raids enable row level security;

-- Raider vê seus próprios raids
create policy "raids_select_raider"
  on public.raids for select
  using (auth.uid() = raider_id);

-- Dono da base vê raids contra sua base
create policy "raids_select_owner"
  on public.raids for select
  using (
    exists (
      select 1 from public.bases
      where bases.id = raids.base_id
        and bases.owner_id = auth.uid()
    )
  );

-- Raider inicia raid
create policy "raids_insert_raider"
  on public.raids for insert
  with check (auth.uid() = raider_id);

-- Raider pode cancelar raid PENDENTE (desistência)
create policy "raids_update_raider_cancel"
  on public.raids for update
  using (
    auth.uid() = raider_id
    and status = 'PENDENTE'
  );

-- Dono pode cancelar raid PENDENTE (defesa)
create policy "raids_update_owner_defend"
  on public.raids for update
  using (
    status = 'PENDENTE'
    and exists (
      select 1 from public.bases
      where bases.id = raids.base_id
        and bases.owner_id = auth.uid()
    )
  );

-- Ladrão vê o stash se tiver um raid CONCLUÍDO na base
-- (policy adicionada aqui pois depende da tabela raids existir)
create policy "stash_select_raider"
  on public.base_stash for select
  using (
    exists (
      select 1 from public.raids
      where raids.base_id   = base_stash.base_id
        and raids.raider_id = auth.uid()
        and raids.status    = 'CONCLUÍDO'
        and raids.resolved_at > now() - interval '1 hour'
    )
  );
-- ============================================================
-- 009 — LOOT_SPAWNS
-- Marcadores de loot que spawnm no mapa em posições aleatórias.
-- Ficam visíveis a todos até serem coletados.
-- ============================================================

create table public.loot_spawns (
  id               uuid        primary key default gen_random_uuid(),
  item_catalog_id  uuid        not null references public.items_catalog(id),
  -- Posição
  lat              double precision not null,
  lng              double precision not null,
  -- Estado
  spawned_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '2 hours',  -- some do mapa se não coletado
  collected_by     uuid        references public.players(id),
  collected_at     timestamptz,
  -- Metadados
  spawn_reason     text        not null default 'RANDOM'
                               check (spawn_reason in ('RANDOM', 'EVENTO', 'HORDA', 'MISSÃO')),
  attributes       jsonb       not null default '{}'
);

comment on table  public.loot_spawns             is 'Loot spawnado no mapa. Visível a todos. Desaparece ao ser coletado ou ao expirar.';
comment on column public.loot_spawns.expires_at  is 'Loot não coletado expira em 2h e é removido pelo cron.';
comment on column public.loot_spawns.spawn_reason is 'Origem do spawn. RANDOM = cron aleatório; outros = eventos específicos.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_loot_spawns_active on public.loot_spawns (spawned_at)
  where collected_at is null;

create index idx_loot_spawns_location on public.loot_spawns (lat, lng)
  where collected_at is null;

-- ── RLS ──────────────────────────────────────────────────────
alter table public.loot_spawns enable row level security;

-- Todos veem loot disponível no mapa
create policy "loot_select_available"
  on public.loot_spawns for select
  using (collected_at is null and expires_at > now());

-- Player autenticado pode coletar (marcar como coletado)
create policy "loot_update_collect"
  on public.loot_spawns for update
  using (
    auth.uid() is not null
    and collected_at is null
    and expires_at > now()
  )
  with check (
    collected_by = auth.uid()
  );
-- ============================================================
-- 010 — RAD_TRANSACTIONS
-- Ledger imutável de todas as movimentações de RAD.
-- Positivo = crédito. Negativo = débito.
-- O saldo real fica em players.rad_balance (atualizado via trigger).
-- ============================================================

-- Tabela de referência para tipos de transação (extensível)
create table public.rad_transaction_types (
  id          serial  primary key,
  slug        text    not null unique,
  label       text    not null,
  direction   text    not null check (direction in ('CRÉDITO', 'DÉBITO', 'AMBOS')),
  description text,
  sort_order  integer not null default 0,
  active      boolean not null default true
);

comment on table public.rad_transaction_types is 'Tipos de transação RAD. Extensível sem migration.';

insert into public.rad_transaction_types (slug, label, direction, description, sort_order) values
  ('STREAK',          'Streak diário',       'CRÉDITO', 'Bônus diário por login consecutivo.',                     10),
  ('EXPLORAR_PIN',    'Explorar pin novo',   'CRÉDITO', 'Primeiro player a explorar um marcador.',                 20),
  ('COMPLETAR_MISSÃO','Completar missão',    'CRÉDITO', 'Recompensa por concluir missão.',                         30),
  ('COLETAR_LOOT',    'Coletar loot',        'CRÉDITO', 'Item coletado no mapa.',                                  40),
  ('VENDA',           'Venda no mercado',    'CRÉDITO', 'Venda de item para outro player.',                        50),
  ('EVENTO',          'Recompensa de evento','CRÉDITO', 'Recompensa por participação em evento do mapa.',          60),
  ('PLANTAR_BASE',    'Plantar base',        'DÉBITO',  'Custo de criação de nova base.',                          110),
  ('MANUTENÇÃO_BASE', 'Manutenção de base',  'DÉBITO',  'Débito diário automático por base ativa.',                120),
  ('RADIO_EMERGÊNCIA','Rádio de emergência', 'DÉBITO',  'Transmissão de mensagem no mapa.',                        130),
  ('REIVINDICAR',     'Reivindicar território','DÉBITO','Reivindicação de zona no mapa.',                          140),
  ('SLOT_INVENTÁRIO', 'Slot de inventário',  'DÉBITO',  'Compra de slot extra no inventário pessoal.',             150),
  ('COMPRA',          'Compra no mercado',   'DÉBITO',  'Compra de item de outro player.',                         160),
  ('UPGRADE_BASE',    'Upgrade de base',     'DÉBITO',  'Custo de upgrade de nível da base.',                      170),
  ('AJUSTE_SISTEMA',  'Ajuste de sistema',   'AMBOS',   'Correção manual de saldo por admin ou bug.',              999);

-- ── Ledger principal ─────────────────────────────────────────
create table public.rad_transactions (
  id               uuid        primary key default gen_random_uuid(),
  player_id        uuid        not null references public.players(id) on delete cascade,
  type_id          integer     not null references public.rad_transaction_types(id),
  amount           integer     not null check (amount != 0),  -- positivo = crédito, negativo = débito
  balance_before   integer     not null,                      -- saldo antes desta transação
  balance_after    integer     not null,                      -- saldo após (= before + amount)
  -- Referências opcionais ao objeto que gerou a transação
  ref_base_id      uuid        references public.bases(id)         on delete set null,
  ref_raid_id      uuid        references public.raids(id)         on delete set null,
  ref_loot_id      uuid        references public.loot_spawns(id)   on delete set null,
  -- Metadados
  description      text,                                      -- descrição human-readable opcional
  created_at       timestamptz not null default now()
);

comment on table  public.rad_transactions                is 'Ledger imutável de RAD. Nunca deletar linhas — use ajuste de sistema para corrigir.';
comment on column public.rad_transactions.balance_before is 'Saldo snapshottado antes da transação. Auditoria e rollback.';
comment on column public.rad_transactions.balance_after  is 'Deve sempre ser igual a balance_before + amount.';

-- ── Índices ──────────────────────────────────────────────────
create index idx_rad_tx_player     on public.rad_transactions (player_id, created_at desc);
create index idx_rad_tx_type       on public.rad_transactions (type_id);
create index idx_rad_tx_created_at on public.rad_transactions (created_at desc);

-- ── Trigger: atualiza players.rad_balance a cada transação ───
create or replace function public.apply_rad_transaction()
returns trigger language plpgsql security definer as $$
declare
  current_balance integer;
begin
  -- Lê saldo atual com lock para evitar race condition
  select rad_balance into current_balance
  from public.players
  where id = new.player_id
  for update;

  -- Garante que balance_before bate
  if new.balance_before != current_balance then
    raise exception 'RAD_RACE_CONDITION: saldo esperado % mas era %.', new.balance_before, current_balance;
  end if;

  -- Garante que balance_after = before + amount
  if new.balance_after != (new.balance_before + new.amount) then
    raise exception 'RAD_INCONSISTENTE: balance_after deve ser balance_before + amount.';
  end if;

  -- Impede saldo negativo
  if new.balance_after < 0 then
    raise exception 'RAD_INSUFICIENTE: saldo insuficiente para esta operação.';
  end if;

  -- Aplica
  update public.players
  set rad_balance = new.balance_after
  where id = new.player_id;

  return new;
end;
$$;

create trigger trg_apply_rad_transaction
  before insert on public.rad_transactions
  for each row execute procedure public.apply_rad_transaction();

-- Ledger é imutável — sem updates ou deletes por ninguém
create or replace function public.block_rad_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'RAD_LEDGER_IMUTÁVEL: transações não podem ser alteradas ou excluídas.';
end;
$$;

create trigger trg_block_rad_update
  before update on public.rad_transactions
  for each row execute procedure public.block_rad_mutation();

create trigger trg_block_rad_delete
  before delete on public.rad_transactions
  for each row execute procedure public.block_rad_mutation();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.rad_transactions     enable row level security;
alter table public.rad_transaction_types enable row level security;

-- Player vê apenas suas próprias transações
create policy "rad_tx_select_own"
  on public.rad_transactions for select
  using (auth.uid() = player_id);

-- Apenas service_role insere (via funções de sistema, nunca direto do client)
-- Nenhuma policy de insert para authenticated — requer service_role

-- Tipos de transação: leitura pública
create policy "rad_tx_types_select_public"
  on public.rad_transaction_types for select
  using (true);
-- ============================================================
-- 011 — FUNÇÕES DE SISTEMA (crons e operações atômicas)
-- Estas funções são chamadas por Edge Functions ou pg_cron.
-- Todas usam security definer para bypassar RLS onde necessário.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- F1: credit_rad
-- Credita RAD a um player de forma atômica.
-- Cria a entrada no ledger e atualiza o saldo via trigger.
-- ────────────────────────────────────────────────────────────
create or replace function public.credit_rad(
  p_player_id  uuid,
  p_type_slug  text,
  p_amount     integer,
  p_description text default null,
  p_ref_base_id uuid default null,
  p_ref_raid_id uuid default null,
  p_ref_loot_id uuid default null
)
returns void language plpgsql security definer as $$
declare
  v_current_balance integer;
  v_type_id         integer;
begin
  if p_amount <= 0 then
    raise exception 'credit_rad: amount deve ser positivo.';
  end if;

  select rad_balance into v_current_balance from public.players where id = p_player_id for update;
  select id          into v_type_id         from public.rad_transaction_types where slug = p_type_slug;

  insert into public.rad_transactions
    (player_id, type_id, amount, balance_before, balance_after, description, ref_base_id, ref_raid_id, ref_loot_id)
  values
    (p_player_id, v_type_id, p_amount, v_current_balance, v_current_balance + p_amount, p_description, p_ref_base_id, p_ref_raid_id, p_ref_loot_id);
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F2: debit_rad
-- Debita RAD de um player. Falha se saldo insuficiente.
-- ────────────────────────────────────────────────────────────
create or replace function public.debit_rad(
  p_player_id   uuid,
  p_type_slug   text,
  p_amount      integer,
  p_description text default null,
  p_ref_base_id uuid default null,
  p_ref_raid_id uuid default null
)
returns void language plpgsql security definer as $$
declare
  v_current_balance integer;
  v_type_id         integer;
begin
  if p_amount <= 0 then
    raise exception 'debit_rad: amount deve ser positivo.';
  end if;

  select rad_balance into v_current_balance from public.players where id = p_player_id for update;

  if v_current_balance < p_amount then
    raise exception 'RAD_INSUFICIENTE: saldo % < necessário %.', v_current_balance, p_amount;
  end if;

  select id into v_type_id from public.rad_transaction_types where slug = p_type_slug;

  insert into public.rad_transactions
    (player_id, type_id, amount, balance_before, balance_after, description, ref_base_id, ref_raid_id)
  values
    (p_player_id, v_type_id, -p_amount, v_current_balance, v_current_balance - p_amount, p_description, p_ref_base_id, p_ref_raid_id);
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F3: cron_daily_base_maintenance
-- Drena 10 RAD/dia de cada base ATIVA.
-- Se RAD do dono zerar → base vira RUÍNA.
-- Chamada 1x/dia via Supabase Edge Function ou pg_cron.
-- ────────────────────────────────────────────────────────────
create or replace function public.cron_daily_base_maintenance()
returns jsonb language plpgsql security definer as $$
declare
  v_base        record;
  v_processed   integer := 0;
  v_ruined      integer := 0;
  v_errors      integer := 0;
begin
  for v_base in
    select b.id, b.owner_id, b.daily_cost, b.name
    from public.bases b
    where b.status = 'ATIVA'
  loop
    begin
      perform public.debit_rad(
        v_base.owner_id,
        'MANUTENÇÃO_BASE',
        v_base.daily_cost,
        format('Manutenção diária: %s', v_base.name),
        v_base.id
      );
      v_processed := v_processed + 1;
    exception when others then
      -- Saldo insuficiente: transforma em ruína
      update public.bases
      set status   = 'RUÍNA',
          ruin_at  = now()
      where id = v_base.id;
      v_ruined := v_ruined + 1;
    end;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'ruined',    v_ruined,
    'errors',    v_errors,
    'run_at',    now()
  );
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F4: cron_ruin_inactive_bases
-- Marca como RUÍNA bases cujo dono não logou em 3 dias.
-- Chamada 1x/hora.
-- ────────────────────────────────────────────────────────────
create or replace function public.cron_ruin_inactive_bases()
returns jsonb language plpgsql security definer as $$
declare
  v_count integer;
begin
  with ruined as (
    update public.bases b
    set    status  = 'RUÍNA',
           ruin_at = now()
    from   public.players p
    where  b.owner_id       = p.id
      and  b.status         = 'ATIVA'
      and  p.last_login_at  < now() - interval '3 days'
    returning b.id
  )
  select count(*) into v_count from ruined;

  return jsonb_build_object('ruined', v_count, 'run_at', now());
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F5: cron_destroy_old_ruins
-- Remove bases em RUÍNA há mais de 7 dias sem atividade.
-- Chamada 1x/dia.
-- ────────────────────────────────────────────────────────────
create or replace function public.cron_destroy_old_ruins()
returns jsonb language plpgsql security definer as $$
declare
  v_count integer;
begin
  with destroyed as (
    update public.bases
    set status       = 'DESTRUÍDA',
        destroyed_at = now()
    where status  = 'RUÍNA'
      and ruin_at < now() - interval '7 days'
    returning id
  )
  select count(*) into v_count from destroyed;

  return jsonb_build_object('destroyed', v_count, 'run_at', now());
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F6: cron_daily_streak
-- Credita +5 RAD a quem logou nas últimas 24h.
-- Incrementa streak_days. Zera se ficou mais de 48h sem logar.
-- Chamada 1x/dia.
-- ────────────────────────────────────────────────────────────
create or replace function public.cron_daily_streak()
returns jsonb language plpgsql security definer as $$
declare
  v_credited integer := 0;
  v_zeroed   integer := 0;
  v_player   record;
begin
  -- Credita streak para quem logou nas últimas 24h
  for v_player in
    select id from public.players
    where last_login_at >= now() - interval '24 hours'
  loop
    perform public.credit_rad(v_player.id, 'STREAK', 5, 'Streak diário de login');
    update public.players set streak_days = streak_days + 1 where id = v_player.id;
    v_credited := v_credited + 1;
  end loop;

  -- Zera streak de quem ficou mais de 48h sem logar
  update public.players
  set streak_days = 0
  where last_login_at < now() - interval '48 hours'
    and streak_days > 0;
  get diagnostics v_zeroed = row_count;

  return jsonb_build_object('credited', v_credited, 'zeroed', v_zeroed, 'run_at', now());
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F7: cron_resolve_raids
-- Executa raids cujo resolves_at já passou.
-- Pega todos os itens do stash e entrega ao raider.
-- Chamada 1x/hora.
-- ────────────────────────────────────────────────────────────
create or replace function public.cron_resolve_raids()
returns jsonb language plpgsql security definer as $$
declare
  v_raid      record;
  v_item_rec  record;
  v_items     jsonb;
  v_count     integer := 0;
begin
  for v_raid in
    select r.id, r.raider_id, r.base_id
    from public.raids r
    where r.status      = 'PENDENTE'
      and r.resolves_at <= now()
  loop
    -- Snapshot de tudo que está no stash antes de mover
    select jsonb_agg(
      jsonb_build_object(
        'item_catalog_id', bs.item_catalog_id,
        'instance_data',   bs.instance_data
      )
    ) into v_items
    from public.base_stash bs
    where bs.base_id = v_raid.base_id;

    -- Tenta inserir cada item no inventário do raider
    -- Itens que não couberem (trigger STASH_CHEIO) são perdidos — saem do stash mas não chegam ao raider
    for v_item_rec in
      select value as item from jsonb_array_elements(coalesce(v_items, '[]'))
    loop
      begin
        insert into public.player_inventory (player_id, item_catalog_id, instance_data, acquired_from)
        values (
          v_raid.raider_id,
          (v_item_rec.item->>'item_catalog_id')::uuid,
          (v_item_rec.item->'instance_data'),
          'RAID'
        );
      exception when others then
        null; -- inventário cheio: item perdido
      end;
    end loop;

    -- Esvazia o stash da base completamente (raid bem-sucedido limpa tudo)
    delete from public.base_stash where base_id = v_raid.base_id;

    -- Marca raid como concluído com snapshot do que havia
    update public.raids
    set status      = 'CONCLUÍDO',
        resolved_at = now(),
        items_taken = coalesce(v_items, '[]')
    where id = v_raid.id;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('resolved', v_count, 'run_at', now());
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F8: cron_cleanup_loot
-- Remove loot expirado do mapa.
-- Chamada 1x/hora.
-- ────────────────────────────────────────────────────────────
create or replace function public.cron_cleanup_loot()
returns jsonb language plpgsql security definer as $$
declare
  v_count integer;
begin
  delete from public.loot_spawns
  where collected_at is null
    and expires_at   < now();
  get diagnostics v_count = row_count;

  return jsonb_build_object('removed', v_count, 'run_at', now());
end;
$$;

-- ────────────────────────────────────────────────────────────
-- F9: record_login
-- Chamada pelo app a cada login para atualizar last_login_at.
-- Retorna saldo atual do player.
-- ────────────────────────────────────────────────────────────
create or replace function public.record_login(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_player record;
begin
  update public.players
  set last_login_at = now()
  where id = p_player_id
  returning rad_balance, streak_days, inventory_slots into v_player;

  return jsonb_build_object(
    'rad_balance',     v_player.rad_balance,
    'streak_days',     v_player.streak_days,
    'inventory_slots', v_player.inventory_slots
  );
end;
$$;
