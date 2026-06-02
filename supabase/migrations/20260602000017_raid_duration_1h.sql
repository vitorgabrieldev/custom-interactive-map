-- Muda o timer de raid de 5h para 1h.
alter table public.raids
  alter column resolves_at set default now() + interval '1 hour';

comment on column public.raids.resolves_at is 'Quando o raid é executado automaticamente. Timer de 1h. Pode ser reduzido por armas (Faca = -30min).';
comment on table  public.raids            is 'Raids em andamento e histórico. Timer de 1h. Dono pode cancelar enquanto PENDENTE.';
