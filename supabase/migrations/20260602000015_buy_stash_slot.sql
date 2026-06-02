-- Compra de slots de stash. Cada slot custa 20 RAD. Máximo 50 slots por base.

create or replace function public.buy_stash_slot(p_base_id uuid, p_player_id uuid)
returns integer  -- retorna novo total de slots
language plpgsql security definer as $$
declare
  v_slots    integer;
  v_owner_id uuid;
  v_status   text;
begin
  select owner_id, stash_slots, status
    into v_owner_id, v_slots, v_status
    from public.bases
   where id = p_base_id;

  if not found then
    raise exception 'BASE_NÃO_ENCONTRADA';
  end if;

  if v_owner_id <> p_player_id then
    raise exception 'ACESSO_NEGADO: somente o dono pode expandir o stash.';
  end if;

  if v_status <> 'ATIVA' then
    raise exception 'BASE_INATIVA: não é possível expandir uma base em ruína.';
  end if;

  if v_slots >= 50 then
    raise exception 'STASH_MÁXIMO: limite de 50 slots atingido.';
  end if;

  -- Debita RAD (lança exceção se saldo insuficiente)
  perform public.debit_rad(
    p_player_id,
    'COMPRAR_SLOT_STASH',
    20,
    'Compra de slot de stash (base: ' || p_base_id::text || ')',
    null, null
  );

  update public.bases
     set stash_slots = stash_slots + 1
   where id = p_base_id;

  return v_slots + 1;
end;
$$;

grant execute on function public.buy_stash_slot(uuid, uuid) to authenticated;
