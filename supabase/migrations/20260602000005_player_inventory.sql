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
