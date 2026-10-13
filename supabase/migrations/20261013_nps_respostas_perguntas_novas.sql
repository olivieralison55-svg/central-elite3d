-- Três perguntas novas na Pesquisa de Satisfação da sessão (13/10/2026).
-- Nulas nas respostas anteriores: o formulário não as fazia.
--   clareza        "Ao finalizar a sessão, você sente que tem clareza sobre seus próximos passos?"
--                  Sim, totalmente | Parcialmente | Não, ainda tenho dúvidas
--   direcionamento "O direcionamento recebido foi adequado ao momento atual do seu negócio?"
--                  Sim | Parcialmente | Não
--   apoio          "Existe alguma dificuldade ou necessidade em que você gostaria de receber mais apoio?" (texto)
alter table nps_respostas
  add column if not exists clareza text,
  add column if not exists direcionamento text,
  add column if not exists apoio text;
