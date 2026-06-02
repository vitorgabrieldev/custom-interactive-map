-- Cooldown de 12h por raider.
-- Um jogador só pode iniciar novo raid 12h após o último (qualquer status).

create or replace function public.check_raid_cooldown()
returns trigger language plpgsql as $$
declare
  last_raid timestamptz;
  cooldown_ends timestamptz;
begin
  select max(started_at)
    into last_raid
    from public.raids
   where raider_id = new.raider_id;

  if last_raid is not null then
    cooldown_ends := last_raid + interval '12 hours';
    if now() < cooldown_ends then
      raise exception 'RAID_COOLDOWN: aguarde até %', cooldown_ends;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_check_raid_cooldown
  before insert on public.raids
  for each row execute procedure public.check_raid_cooldown();
