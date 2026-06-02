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
