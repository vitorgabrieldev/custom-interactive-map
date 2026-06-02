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
