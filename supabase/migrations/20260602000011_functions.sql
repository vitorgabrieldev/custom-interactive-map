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
