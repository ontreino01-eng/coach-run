-- ══════════════════════════════════════════════════════════════
-- CoachEndurance — Schema Supabase (versão 2, à prova de reexecução)
-- Cole isso inteiro numa "New query" do SQL Editor e clique em Run.
-- Pode rodar quantas vezes precisar — não dá erro se já existir.
-- ══════════════════════════════════════════════════════════════

-- Garante a extensão que gera os IDs únicos (gen_random_uuid)
create extension if not exists pgcrypto;

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  cpf text unique not null,
  code text unique not null,
  email text not null,
  kiwify_order_id text,
  status text not null default 'pendente',
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf text unique references licenses(cpf),
  nome text,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table licenses enable row level security;

-- Remove policies antigas (se existirem) antes de recriar, pra nunca dar erro de duplicata
drop policy if exists "Aluno vê o próprio perfil" on profiles;
drop policy if exists "Aluno edita o próprio perfil" on profiles;
drop policy if exists "Aluno cria o próprio perfil" on profiles;

create policy "Aluno vê o próprio perfil" on profiles for select using (auth.uid() = id);
create policy "Aluno edita o próprio perfil" on profiles for update using (auth.uid() = id);
create policy "Aluno cria o próprio perfil" on profiles for insert with check (auth.uid() = id);

create or replace function gen_license_code() returns text as $$
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
$$ language plpgsql;

-- Prova visual: isso mostra na tela se deu tudo certo
select
  (select count(*) from information_schema.tables where table_name = 'licenses' and table_schema = 'public') as tabela_licenses_existe,
  (select count(*) from information_schema.tables where table_name = 'profiles' and table_schema = 'public') as tabela_profiles_existe;
