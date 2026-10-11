create table public.assessment_cycles (
 user_id uuid not null references auth.users(id) on delete cascade,
 cycle_num integer not null check(cycle_num > 0),
 period_end timestamptz,
 status text not null default 'pending' check(status in ('pending','ready','failed')),
 decision jsonb,
 plan jsonb,
 inputs jsonb,
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 primary key(user_id,cycle_num)
);
alter table public.assessment_cycles enable row level security;
revoke all on public.assessment_cycles from public,anon,authenticated;
grant all on public.assessment_cycles to service_role;
create function public.claim_assessment_cycle(p_user uuid,p_cycle integer,p_period timestamptz,p_inputs jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare token uuid := gen_random_uuid(); result uuid;
begin
 insert into public.assessment_cycles(user_id,cycle_num,period_end,inputs,lease_token,lease_until)
 values(p_user,p_cycle,p_period,p_inputs,token,now()+interval '5 minutes')
 on conflict(user_id,cycle_num) do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until,status='pending'
 where assessment_cycles.status <> 'ready' and (assessment_cycles.lease_until is null or assessment_cycles.lease_until < now())
 returning lease_token into result;
 return result;
end $$;
revoke all on function public.claim_assessment_cycle(uuid,integer,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.claim_assessment_cycle(uuid,integer,timestamptz,jsonb) to service_role;
create function public.protect_training_state() returns trigger language plpgsql security invoker set search_path = '' as $$
declare k text;
begin
 if current_user in ('authenticated','anon') then
  if new.cpf is distinct from old.cpf or new.telefone is distinct from old.telefone then raise exception 'Identidade do aluno protegida'; end if;
  foreach k in array array['assessed','cycleNum','plan','profile','scores','lesoes','parqAlert','tests','history','baselineScores'] loop
   if new.state->k is distinct from old.state->k then
    -- Keep authoritative assessment/plan even when a stale offline client syncs progress.
    if old.state ? k then new.state := jsonb_set(new.state,array[k],old.state->k); else new.state := new.state-k; end if;
   end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.protect_training_state() from public,anon,authenticated;
create trigger protect_training_state before update on public.profiles for each row execute function public.protect_training_state();
revoke insert on public.profiles from authenticated,anon;
create function public.protect_initial_assessment() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.assessment->'tests' is not null and new.assessment->'tests' <> 'null'::jsonb and new.assessment->'tests' <> '{}'::jsonb then
  perform pg_advisory_xact_lock(hashtextextended(new.telefone,0));
  if exists(select 1 from public.leads l where l.telefone=new.telefone and l.id<>new.id and l.assessment->'tests' is not null and l.assessment->'tests'<>'null'::jsonb and l.assessment->'tests'<>'{}'::jsonb) then raise exception 'Avaliação inicial já concluída para este contato'; end if;
 end if;
 if old.assessment->'tests' is not null and old.assessment->'tests' <> 'null'::jsonb and old.assessment->'tests' <> '{}'::jsonb and new.assessment is distinct from old.assessment then
  raise exception 'Avaliação inicial já concluída; use a reavaliação do ciclo';
 end if;
 return new;
end $$;
revoke all on function public.protect_initial_assessment() from public,anon,authenticated;
create trigger protect_initial_assessment before update on public.leads for each row execute function public.protect_initial_assessment();
-- Preserve existing subscribers without charging or generating another initial cycle.
insert into public.assessment_cycles(user_id,cycle_num,period_end,status,plan)
select p.id,greatest(1,coalesce((p.state->>'cycleNum')::integer,1)),l.current_period_end,'ready',p.state->'plan'
from public.profiles p join lateral (select current_period_end from public.licenses where cpf=p.cpf order by created_at desc limit 1) l on true
where p.state->>'assessed'='true' and jsonb_array_length(coalesce(p.state->'plan'->'weeks','[]'::jsonb))=4
on conflict do nothing;
