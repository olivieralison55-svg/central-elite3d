# AD-011 — Gestão de usuários pela edge function `admin-usuarios`

- **Status**: active
- **Date**: 2026-10-20
- **Scope**: `supabase/functions/admin-usuarios/`, `src/lib/data/usuarios.ts`, `/usuarios`; emenda o AD-007 (DATA-08).
- **Decided by**: o Lucas pediu a tela (nome, e-mail, senha, tipo de conta, criar e excluir); a forma é do implementador.

## Decisão

1. **A tela Usuários fala com uma edge function, não com o banco.** Criar, excluir, trocar e-mail e
   senha é a Auth Admin API, que só aceita a chave secreta do projeto; papel (`profiles.role`) não é
   editável pelo cliente (ARCHITECTURE.md, *Permissões*). O app continua sem essa chave (AD-007):
   ela fica na função, que é a primeira chamada pelo browser.
2. **A função confere o papel, não só o JWT.** `verify_jwt = true` fixado no `config.toml`, e antes
   de qualquer ação ela lê `profiles.role` de quem chama: só `admin` passa. O admin não se exclui
   nem tira o próprio papel de admin (a função recusa; a tela nem oferece excluir a si mesmo).
3. **Senha gerada, mostrada uma vez.** Criar e "Nova senha" geram 14 caracteres sem ambíguos
   (0/O, 1/l/I) no servidor e devolvem para o admin copiar. Nada de senha guardada nem enviada
   por e-mail.
4. **DATA-08 vira lista de permissão**, como já era para as rpcs: `.functions.invoke(` só com o
   nome literal `admin-usuarios`.
5. **`profiles` é gravado pela função** (upsert de `nome`, `email`, `role`) depois do Auth:
   o trigger `handle_new_user()` cria todo usuário como mentor, e o tipo escolhido na tela
   sobrescreve.

## Por quê

- RPC `SECURITY DEFINER` mexendo em `auth.users` é escrever no schema interno do Auth à mão
  (hash de senha, identities): frágil e fora do contrato do Supabase. A Admin API é o caminho
  suportado, e ela exige servidor.
- Conferir papel dentro da função é o que impede um mentor logado de chamar a URL direto: o
  JWT válido sozinho não basta.

## Consequências

- Deploy: `supabase functions deploy admin-usuarios` (a chave secreta já é injetada pelo Supabase).
- Excluir usuário que é FK `NO ACTION` em alguma tabela falha com a mensagem do banco, sem apagar
  nada; `mentorado_notas.atualizado_por` é `SET NULL`.
- A lista lê até 1.000 usuários numa página (`ponytail:` no código).
