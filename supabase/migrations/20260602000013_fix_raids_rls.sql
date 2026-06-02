-- Fix: RLS update policies for raids were missing WITH CHECK clause.
-- PostgreSQL uses the USING clause as implicit WITH CHECK for UPDATE policies,
-- meaning status='PENDENTE' was evaluated against the NEW row too — blocking the update.

drop policy if exists "raids_update_raider_cancel" on public.raids;
drop policy if exists "raids_update_owner_defend"  on public.raids;

-- Raider cancels (PENDENTE → CANCELADO)
create policy "raids_update_raider_cancel"
  on public.raids for update
  using (
    auth.uid() = raider_id
    and status = 'PENDENTE'
  )
  with check (true);

-- Owner defends (PENDENTE → DEFENDIDO)
create policy "raids_update_owner_defend"
  on public.raids for update
  using (
    status = 'PENDENTE'
    and exists (
      select 1 from public.bases
      where bases.id = raids.base_id
        and bases.owner_id = auth.uid()
    )
  )
  with check (true);
