-- Mentores saem do cadastro, não de uma lista no código (AD-013).
--
-- `sessoes.mentor` é texto ("Luan"), e `profiles.nome` é o nome completo ("Luan
-- Alves Maker"): não dá para casar um com o outro. `nome_mentor` é a grafia
-- gravada nas sessões. O trigger a preenche com o primeiro nome quando o perfil
-- vira mentor (ou o nome inteiro, se o primeiro já é de outro mentor) e nunca a
-- reescreve: trocar o nome do perfil não parte o histórico em dois.
--
-- O mentor só lê o próprio perfil (profiles_select_own), então a lista chega ao
-- app por `mentores_ativos()`, que devolve só os nomes.

begin;

alter table profiles add column if not exists nome_mentor text unique;

update profiles p set nome_mentor = v.nome
  from (values
    ('andreandradestlflix@gmail.com', 'André'),
    ('mkt.martinsoliveira@gmail.com', 'Diovani'),
    ('gabriellaandradestlflix@gmail.com', 'Gabriella'),
    ('contato.alvesmaker@gmail.com', 'Luan'),
    ('am.3d.printt@gmail.com', 'Michelle'),
    ('petarerp@gmail.com', 'Petare'),
    ('sergiodink@gmail.com', 'Sergio')
  ) v(email, nome)
  where lower(p.email) = v.email and p.nome_mentor is null;

create or replace function preencher_nome_mentor() returns trigger
  language plpgsql set search_path = public as $$
declare
  completo text := regexp_replace(trim(coalesce(new.nome, '')), '\s+', ' ', 'g');
begin
  if new.role <> 'mentor' or new.nome_mentor is not null or completo = '' then
    return new;
  end if;
  new.nome_mentor := split_part(completo, ' ', 1);
  if exists (select 1 from profiles where nome_mentor = new.nome_mentor and id <> new.id) then
    new.nome_mentor := completo;
  end if;
  return new;
end $$;

drop trigger if exists profiles_nome_mentor on profiles;
create trigger profiles_nome_mentor before insert or update of nome, role on profiles
  for each row execute function preencher_nome_mentor();

-- Perfis de mentor que não estavam no backfill (cadastrados antes desta migration).
update profiles set nome = nome where role = 'mentor' and nome_mentor is null;

create or replace function mentores_ativos()
  returns table (nome text)
  language sql stable security definer set search_path = public as $$
  select p.nome_mentor from profiles p
   where p.role = 'mentor' and p.nome_mentor is not null and get_my_role() is not null
   order by p.nome_mentor
$$;

revoke all on function mentores_ativos() from public, anon;
grant execute on function mentores_ativos() to authenticated;

commit;
