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
