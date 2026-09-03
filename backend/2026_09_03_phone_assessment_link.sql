-- Vínculo seguro entre avaliação pré-compra, licença e usuário autenticado.
alter table public.licenses add column if not exists telefone text;
alter table public.profiles add column if not exists telefone text;

create index if not exists idx_licenses_telefone on public.licenses(telefone);
create index if not exists idx_leads_telefone_created_at on public.leads(telefone, created_at desc);

comment on column public.licenses.telefone is 'Telefone normalizado em dígitos, informado na avaliação e/ou recebido da Kiwify.';
comment on column public.profiles.telefone is 'Telefone normalizado vinculado ao usuário autenticado.';
