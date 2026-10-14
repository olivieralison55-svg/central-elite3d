import type { SupabaseClient } from "@supabase/supabase-js";

import { ETAPA_ORD } from "@/lib/constantes";

import { cliente } from "./cliente";

// As escritas W01–W21 (mapeamento §4.2), uma função por escrita, com os nomes de hoje. Relação,
// operação, payload e `onConflict` são os do index.html (WRITE-01). O que muda é o `.select`,
// que traz as linhas afetadas para conferir (WRITE-02). Capacidade, trava e sessão ficam no
// executor (src/lib/escrita.ts), por onde toda escrita passa. Toda função recebe o cliente por
// último, com `cliente()` de padrão: os testes passam um falso.

// O RLS filtra `update` e `delete` sem permissão sem devolver erro: 0 linhas não é sucesso. A
// escrita de várias linhas que volta com menos do que pediu também não (THREAT-11).
export type ResultadoEscrita =
  | { ok: true; linhas: number }
  | { ok: false; erro: string }
  | { ok: false; zeroLinhas: true }
  | { ok: false; linhas: number; esperadas: number };

type Resposta = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function conferir(rel: string, pedido: Resposta, esperadas = 1): Promise<ResultadoEscrita> {
  const { data, error } = await pedido;
  if (error) {
    console.error(`[central-elite3d] ${rel}`, error);
    return { ok: false, erro: error.message };
  }
  const linhas = Array.isArray(data) ? data.length : 0;
  if (linhas === 0) {
    console.error(`[central-elite3d] ${rel}`, "0 linhas");
    return { ok: false, zeroLinhas: true };
  }
  if (linhas < esperadas) {
    console.error(`[central-elite3d] ${rel}`, `${linhas} de ${esperadas} linhas`);
    return { ok: false, linhas, esperadas };
  }
  return { ok: true, linhas };
}

// Campo de texto do formulário: vazio vira null, como o `value || null` de hoje.
const ouNulo = (valor: string | null) => valor || null;
const ordemDaEtapa = (etapa: string) => ETAPA_ORD[etapa] ?? 99;

// W02: os campos de um encontro em grupo, iguais para todos os participantes.
export interface EncontroGrupo {
  etapa: string;
  status: string;
  mentor: string | null;
  data: string | null;
  hora: string | null;
  link_meet: string | null;
  link_gravacao: string | null;
}

// W03: o formulário de sessão.
export interface CamposSessao extends EncontroGrupo {
  mentorado_id: string;
  link_anotacoes: string | null;
}

// W01 (index.html:2024): as presenças pendentes do encontro viram concluídas, com quem atendeu.
export function confirmarGrupo(ids: string[], mentor: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("sessoes", db.from("sessoes").update({ status: "Concluída", mentor }).in("id", ids).select("id"), ids.length);
}

// W02 (index.html:2089): uma linha por participante, com a mesma etapa, data, hora, mentor e status (OPS-06).
export function criarSessaoGrupo(mentoradoIds: string[], encontro: EncontroGrupo, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const base = {
    etapa: encontro.etapa,
    ordem: ordemDaEtapa(encontro.etapa),
    status: encontro.status,
    mentor: ouNulo(encontro.mentor),
    data: ouNulo(encontro.data),
    hora: ouNulo(encontro.hora),
    link_meet: ouNulo(encontro.link_meet),
    link_gravacao: ouNulo(encontro.link_gravacao),
  };
  const linhas = mentoradoIds.map((mentorado_id) => ({ mentorado_id, ...base }));
  return conferir("sessoes", db.from("sessoes").insert(linhas).select("id"), mentoradoIds.length);
}

// W03 (index.html:3631): sem id cria, com id atualiza. Salvar pelo formulário é alguém
// respondendo pela etapa: ela deixa de ser palpite do sync (OPS-08).
export function salvarSessao(sessaoId: string | null, sessao: CamposSessao, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const payload = {
    mentorado_id: sessao.mentorado_id,
    etapa: sessao.etapa,
    ordem: ordemDaEtapa(sessao.etapa),
    etapa_deduzida: false,
    status: sessao.status,
    mentor: ouNulo(sessao.mentor),
    data: ouNulo(sessao.data),
    hora: ouNulo(sessao.hora),
    link_meet: ouNulo(sessao.link_meet),
    link_gravacao: ouNulo(sessao.link_gravacao),
    link_anotacoes: ouNulo(sessao.link_anotacoes),
  };
  const pedido = sessaoId
    ? db.from("sessoes").update(payload).eq("id", sessaoId).select("id")
    : db.from("sessoes").insert(payload).select("id");
  return conferir("sessoes", pedido);
}

// W04 (index.html:3670): confirmar não mexe em `etapa_deduzida` (OPS-08).
export function confirmarSessao(id: string, mentor: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("sessoes", db.from("sessoes").update({ status: "Concluída", mentor }).eq("id", id).select("id"));
}

// W05 (index.html:3677).
export function delSessao(id: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("sessoes", db.from("sessoes").delete().eq("id", id).select("id"));
}
