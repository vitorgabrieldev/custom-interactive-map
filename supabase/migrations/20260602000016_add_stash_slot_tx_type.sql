-- Adiciona o tipo de transação para compra de slot de stash.
-- Era ausente, causando null value em type_id ao chamar buy_stash_slot.

insert into public.rad_transaction_types (slug, label, direction, description, sort_order)
values ('COMPRAR_SLOT_STASH', 'Compra de slot de stash', 'DÉBITO', 'Compra de slot extra no stash de uma base.', 180);
