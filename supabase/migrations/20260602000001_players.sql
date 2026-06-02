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
