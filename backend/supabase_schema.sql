-- ══════════════════════════════════════════════════════════════
-- PersonalCoach — Schema Supabase (CONSOLIDADO — única fonte da verdade)
-- Idempotente: pode rodar quantas vezes precisar, em banco novo ou existente.
-- Rode isso em: Supabase Dashboard > SQL Editor > New query > Run
-- ══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Licenças geradas a partir da compra no Kiwify (assinatura mensal).
create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  cpf text unique not null,
  code text unique not null,
  email text not null,
  kiwify_order_id text,
  status text not null default 'pendente',              -- pendente | ativo (código já usado no cadastro)
  subscription_status text not null default 'ativa',    -- ativa | atrasada | cancelada
  current_period_end timestamptz,                        -- data até quando o acesso vale
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table licenses add column if not exists subscription_status text not null default 'ativa';
alter table licenses add column if not exists current_period_end timestamptz;

-- Perfis de aluno (dados de avaliação/ciclos) — 1 linha por usuário autenticado.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf text unique references licenses(cpf),
  nome text,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Leads: nome+telefone capturados ANTES do pagamento, na primeira tela do funil.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  assessment jsonb,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table licenses enable row level security;
alter table leads enable row level security;

drop policy if exists "Aluno vê o próprio perfil" on profiles;
drop policy if exists "Aluno edita o próprio perfil" on profiles;
drop policy if exists "Aluno cria o próprio perfil" on profiles;
create policy "Aluno vê o próprio perfil" on profiles for select using ((select auth.uid()) = id);
create policy "Aluno edita o próprio perfil" on profiles for update using ((select auth.uid()) = id);
create policy "Aluno cria o próprio perfil" on profiles for insert with check ((select auth.uid()) = id);

-- licenses: sem policy pública — só Edge Functions com service_role acessam (decisão consciente).

drop policy if exists "Qualquer um pode criar lead" on leads;
create policy "Qualquer um pode criar lead" on leads for insert with check (true);
-- leads: sem policy de SELECT pública — só você vendo pelo Table Editor ou via service_role.

-- Índices úteis
create index if not exists idx_licenses_cpf on licenses(cpf);
create index if not exists idx_licenses_code on licenses(code);
create index if not exists idx_profiles_cpf on profiles(cpf);

-- Função que gera o código de acesso (ex: "F3K9-XQ2P") — search_path fixo (boa prática de segurança)
create or replace function gen_license_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I pra evitar confusão
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    if i = 4 then result := result || '-'; end if;
  end loop;
  return result;
end;
$$ language plpgsql set search_path = public;

select
  (select count(*) from information_schema.tables where table_name = 'licenses' and table_schema = 'public') as tabela_licenses,
  (select count(*) from information_schema.tables where table_name = 'profiles' and table_schema = 'public') as tabela_profiles,
  (select count(*) from information_schema.tables where table_name = 'leads' and table_schema = 'public') as tabela_leads;
