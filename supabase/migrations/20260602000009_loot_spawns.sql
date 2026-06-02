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
