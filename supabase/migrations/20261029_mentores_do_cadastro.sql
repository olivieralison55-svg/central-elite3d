-- Mentores saem do cadastro, não de uma lista no código (AD-013).
--
-- `sessoes.mentor` é texto ("Luan"), e `profiles.nome` é o nome completo ("Luan
-- Alves Maker"): não dá para casar um com o outro. `mentor_nome` é a grafia
-- gravada nas sessões. O trigger a preenche com o primeiro nome quando o perfil
-- vira mentor (ou o nome inteiro, se o primeiro já é de outro mentor) e nunca a
-- reescreve: trocar o nome do perfil não parte o histórico em dois.
--
-- O mentor só lê o próprio perfil (profiles_select_own), então a lista chega ao
-- app por `mentores_ativos()`, que devolve só os nomes.

begin;

alter table profiles add column if not exists mentor_nome text;
create unique index if not exists profiles_mentor_nome_key on profiles (mentor_nome);

update profiles p set mentor_nome = v.nome
  from (values
    ('andreandradestlflix@gmail.com', 'André'),
    ('mkt.martinsoliveira@gmail.com', 'Diovani'),
    ('gabriellaandradestlflix@gmail.com', 'Gabriella'),
    ('contato.alvesmaker@gmail.com', 'Luan'),
    ('am.3d.printt@gmail.com', 'Michelle'),
    ('petarerp@gmail.com', 'Petare'),
    ('sergiodink@gmail.com', 'Sergio')
  ) v(email, nome)
  where lower(p.email) = v.email and p.mentor_nome is null;

create or replace function preencher_mentor_nome() returns trigger
  language plpgsql set search_path = public as $$
declare
  completo text := regexp_replace(trim(coalesce(new.nome, '')), '\s+', ' ', 'g');
begin
  -- Como profiles_trava_mentor_nome: só o admin (ou o service role da admin-usuarios) liga o
  -- login a um nome. Sem isto, um mentor ainda sem nome trocaria o próprio `nome` e se ligaria
  -- às sessões de outro.
  if new.role <> 'mentor' or new.mentor_nome is not null or completo = ''
     or (auth.uid() is not null and coalesce(get_my_role(), '') <> 'admin') then
    return new;
  end if;
  new.mentor_nome := split_part(completo, ' ', 1);
  if exists (select 1 from profiles where mentor_nome = new.mentor_nome and id <> new.id) then
    new.mentor_nome := completo;
  end if;
  return new;
end $$;

drop trigger if exists profiles_mentor_nome on profiles;
create trigger profiles_mentor_nome before insert or update of nome, role on profiles
  for each row execute function preencher_mentor_nome();

-- Perfis de mentor que não estavam no backfill (cadastrados antes desta migration).
update profiles set nome = nome where role = 'mentor' and mentor_nome is null;

create or replace function mentores_ativos()
  returns table (nome text)
  language sql stable security definer set search_path = public as $$
  select p.mentor_nome from profiles p
   where p.role = 'mentor' and p.mentor_nome is not null and get_my_role() is not null
   order by p.mentor_nome
$$;

revoke all on function mentores_ativos() from public, anon;
grant execute on function mentores_ativos() to authenticated;

commit;
