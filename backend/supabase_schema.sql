-- Base do Corre — schema consolidado do Supabase
-- InfinitePay + Resend + ativação por telefone/CPF e código.
-- Execute no Supabase SQL Editor. As operações principais são idempotentes.

create extension if not exists pgcrypto;

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  cpf text unique not null,
  code text unique not null,
  email text not null,
  telefone text,
  status text not null default 'pendente',
  subscription_status text not null default 'ativa',
  current_period_end timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  payment_provider text,
  payment_order_id text,
  payment_transaction_id text,
  payment_invoice_slug text
);

alter table public.licenses add column if not exists telefone text;
alter table public.licenses add column if not exists subscription_status text not null default 'ativa';
alter table public.licenses add column if not exists current_period_end timestamptz;
alter table public.licenses add column if not exists payment_provider text;
alter table public.licenses add column if not exists payment_order_id text;
alter table public.licenses add column if not exists payment_transaction_id text;
alter table public.licenses add column if not exists payment_invoice_slug text;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf text unique references public.licenses(cpf),
  telefone text,
  nome text,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists telefone text;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  email text,
  assessment jsonb,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

alter table public.leads add column if not exists email text;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  provider text not null default 'infinitepay',
  order_nsu text unique not null,
  email text not null,
  telefone text not null,
  cpf text not null,
  nome text,
  amount integer not null default 990,
  status text not null default 'pending',
  checkout_url text,
  transaction_nsu text,
  invoice_slug text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  license_id uuid references public.licenses(id),
  activation_email_sent_at timestamptz,
  activation_email_error text
);

-- Segurança: o frontend só cria leads. Licenças e pedidos ficam disponíveis
-- apenas para as Edge Functions com service_role.
alter table public.profiles enable row level security;
alter table public.licenses enable row level security;
alter table public.leads enable row level security;
alter table public.payment_orders enable row level security;

drop policy if exists "Aluno vê o próprio perfil" on public.profiles;
drop policy if exists "Aluno edita o próprio perfil" on public.profiles;
drop policy if exists "Aluno cria o próprio perfil" on public.profiles;
create policy "Aluno vê o próprio perfil" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "Aluno edita o próprio perfil" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Aluno cria o próprio perfil" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "Qualquer um pode criar lead" on public.leads;
create policy "Qualquer um pode criar lead" on public.leads
  for insert with check (true);

-- Não crie policies públicas em licenses ou payment_orders.
-- As Edge Functions usam a service_role no backend.

create index if not exists idx_licenses_cpf on public.licenses(cpf);
create index if not exists idx_licenses_code on public.licenses(code);
create index if not exists idx_licenses_telefone on public.licenses(telefone);
create index if not exists idx_profiles_cpf on public.profiles(cpf);
create index if not exists idx_leads_telefone_created_at on public.leads(telefone, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders(status);
create index if not exists payment_orders_activation_email_idx on public.payment_orders(activation_email_sent_at);

create or replace function public.gen_license_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    if i = 4 then result := result || '-'; end if;
  end loop;
  return result;
end;
$$ language plpgsql security invoker set search_path = public;

select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'licenses') as tabela_licenses,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'profiles') as tabela_profiles,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'leads') as tabela_leads,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'payment_orders') as tabela_payment_orders;
