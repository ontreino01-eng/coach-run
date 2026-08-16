-- ══════════════════════════════════════════════════════════════
-- CoachEndurance — Schema Supabase
-- Rode isso em: Supabase Dashboard > SQL Editor > New query > Run
-- ══════════════════════════════════════════════════════════════

-- Licenças geradas a partir da compra no Kiwify.
-- Uma linha = um CPF que pagou = um código de acesso.
create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  cpf text unique not null,
  code text unique not null,               -- código de 8 caracteres entregue ao aluno
  email text not null,
  kiwify_order_id text,
  status text not null default 'pendente', -- pendente | ativo | cancelado
  redeemed_at timestamptz,                 -- quando o código foi usado no cadastro
  created_at timestamptz not null default now()
);

-- Perfis de aluno (dados de avaliação/ciclos) — 1 linha por usuário autenticado.
-- auth.users já é gerenciado pelo Supabase Auth (login/senha + verificação de e-mail).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf text unique references licenses(cpf),
  nome text,
  state jsonb not null default '{}'::jsonb,  -- guarda o "state" inteiro do app (profile, plan, logs, history, tests)
  updated_at timestamptz not null default now()
);

-- Row Level Security: cada aluno só enxerga o próprio perfil.
alter table profiles enable row level security;

create policy "Aluno vê o próprio perfil"
  on profiles for select
  using (auth.uid() = id);

create policy "Aluno edita o próprio perfil"
  on profiles for update
  using (auth.uid() = id);

create policy "Aluno cria o próprio perfil"
  on profiles for insert
  with check (auth.uid() = id);

-- licenses NÃO tem policy de select pública — só as Edge Functions
-- (que rodam com a service_role key, ignorando RLS) podem ler/escrever nela.
alter table licenses enable row level security;

-- Função utilitária: gera um código de 8 caracteres tipo "F3K9-XQ2P"
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
$$ language plpgsql;
