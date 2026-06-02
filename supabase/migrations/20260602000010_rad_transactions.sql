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
