import type { SupabaseClient } from "@supabase/supabase-js";

import { ETAPA_ORD } from "@/lib/constantes";

import { cliente } from "./cliente";
import type { Parcela, Resultado } from "./esquemas";

// As escritas W01–W21 (mapeamento §4.2), uma função por escrita, com os nomes de hoje. Relação,
// operação, payload e `onConflict` são os do index.html (WRITE-01). O que muda é o `.select`,
// que traz as linhas afetadas para conferir (WRITE-02). Capacidade, trava e sessão ficam no
// executor (src/lib/escrita.ts), por onde toda escrita passa. Toda função recebe o cliente por
// último, com `cliente()` de padrão: os testes passam um falso.

// O RLS filtra `update` e `delete` sem permissão sem devolver erro: 0 linhas não é sucesso. A
// escrita de várias linhas que volta com menos do que pediu também não (THREAT-11). `aviso` é a
// falha de um passo depois da escrita, que já gravou (WRITE-07).
export type ResultadoEscrita =
  | { ok: true; linhas: number; aviso?: string }
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
  // `.single()` devolve a linha, não uma lista.
  const linhas = Array.isArray(data) ? data.length : data ? 1 : 0;
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

// W09: a evolução de um marco. A rota simples grava só status e data; a rica leva também o teste
// de passagem, com `criterios_ok`, `criterios_pendentes` e `progresso` já derivados (OPS-18).
export interface EvolucaoSimples {
  status: string;
  data: string | null;
}

export interface EvolucaoRica extends EvolucaoSimples {
  criterios_ok: string[];
  criterios_pendentes: string[];
  progresso: number | null;
  bloqueios: string[];
  proxima_acao: string | null;
}

// W06 (index.html:2479): um canal de venda por mentorado e rota.
export function salvarCanalMentorado(mentoradoId: string, rotaId: string, canalId: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir(
    "mentorado_canais",
    db
      .from("mentorado_canais")
      .upsert({ mentorado_id: mentoradoId, rota_id: rotaId, canal_id: canalId }, { onConflict: "mentorado_id,rota_id" })
      .select("mentorado_id"),
  );
}

// W07 (index.html:2488): `mes` chega como AAAA-MM e vai como o primeiro dia; valor vazio vale 0.
export function salvarFaturamento(mentoradoId: string, mes: string, canalId: string, valor: number | null, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir(
    "faturamento_mensal",
    db
      .from("faturamento_mensal")
      .upsert({ mentorado_id: mentoradoId, mes: `${mes}-01`, canal_id: canalId, valor: valor ?? 0 }, { onConflict: "mentorado_id,mes,canal_id" })
      .select("id"),
  );
}

// W08 (index.html:2498).
export function excluirFaturamento(id: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("faturamento_mensal", db.from("faturamento_mensal").delete().eq("id", id).select("id"));
}

// W09 (index.html:2521).
export function salvarMarco(mentoradoId: string, marcoId: string, evolucao: EvolucaoSimples | EvolucaoRica, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const simples = { mentorado_id: mentoradoId, marco_id: marcoId, status: evolucao.status, data: ouNulo(evolucao.data) };
  const payload =
    "criterios_ok" in evolucao
      ? {
          ...simples,
          criterios_ok: evolucao.criterios_ok,
          criterios_pendentes: evolucao.criterios_pendentes,
          progresso: evolucao.progresso,
          bloqueios: evolucao.bloqueios,
          proxima_acao: evolucao.proxima_acao,
        }
      : simples;
  return conferir("mentorado_marcos", db.from("mentorado_marcos").upsert(payload, { onConflict: "mentorado_id,marco_id" }).select("mentorado_id"));
}

// W10 (index.html:3396): a chave é o `mentorado_id`. O `conteudo` chega do sanitizador e o
// `atualizado_em` é o relógio de quem grava, lido por quem chama: relógio fica fora da porta (AD-007).
export function salvarNota(mentoradoId: string, conteudo: string, atualizadoEm: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir(
    "mentorado_notas",
    db.from("mentorado_notas").upsert({ mentorado_id: mentoradoId, conteudo, atualizado_em: atualizadoEm }).select("mentorado_id"),
  );
}

// Rpc sem linha para conferir: o que volta é o erro dela, nunca ignorado (WRITE-06, WRITE-07).
// SPEC_DEVIATION: o design diz que toda função da porta devolve ResultadoEscrita.
// Reason: a rpc não tem linha a conferir (design, tabela "Escritas": W11b confere o erro da rpc).
async function chamar(rpc: string, pedido: Resposta): Promise<Resultado<null>> {
  const { error } = await pedido;
  if (!error) return { ok: true, dados: null };
  console.error(`[central-elite3d] ${rpc}`, error);
  return { ok: false, erro: error.message };
}

// W11, aba Cadastro. Nome e e-mail chegam validados e normalizados pelo formulário.
export interface CadastroMentorado {
  aba: "cadastro";
  nome: string;
  email: string | null;
  data_fechamento: string | null;
  link_drive: string | null;
  link_mapa_mental: string | null;
  link_whatsapp: string | null;
}

// W11, aba Financeiro.
export interface FinanceiroMentorado {
  aba: "financeiro";
  contrato_status: string | null;
  entrada_status: string | null;
  entrada_forma_pgto: string | null;
  restante_status: string | null;
  restante_forma_pgto: string | null;
}

// W12: a situação e as datas da pausa, como o formulário as tem.
export interface SituacaoMentorado {
  situacao: string;
  pausado_em: string | null;
  retorno_previsto: string | null;
}

// W14: o formulário de Novo mentorado, com nome e e-mail já validados e normalizados.
export interface NovoMentorado {
  nome: string;
  email: string | null;
  data_fechamento: string | null;
  entrada_status: string;
  entrada_forma_pgto: string | null;
  contrato_status: string;
  restante_status: string;
}

// W11 (index.html:3451), uma aba por vez. Salvar o cadastro é alguém responder por ele: a marca
// de incompleto que a Lia pôs ao criar sai. No financeiro, status nulo continua nulo (OPS-15).
export function salvarMentorado(id: string, campos: CadastroMentorado | FinanceiroMentorado, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const payload =
    campos.aba === "cadastro"
      ? {
          nome: campos.nome,
          cadastro_incompleto: false,
          email: ouNulo(campos.email),
          data_fechamento: ouNulo(campos.data_fechamento),
          link_drive: ouNulo(campos.link_drive),
          link_mapa_mental: ouNulo(campos.link_mapa_mental),
          link_whatsapp: ouNulo(campos.link_whatsapp),
        }
      : {
          contrato_status: ouNulo(campos.contrato_status),
          entrada_status: ouNulo(campos.entrada_status),
          entrada_forma_pgto: ouNulo(campos.entrada_forma_pgto),
          restante_status: ouNulo(campos.restante_status),
          restante_forma_pgto: ouNulo(campos.restante_forma_pgto),
        };
  return conferir("mentorados", db.from("mentorados").update(payload).eq("id", id).select("id"));
}

// W11b (index.html:3490): adota as cobranças órfãs da Lia com o e-mail do mentorado. Hoje o erro
// é ignorado; aqui ele volta para quem chama.
export function adotarOrfas(mentoradoId: string, db: SupabaseClient = cliente()): Promise<Resultado<null>> {
  return chamar("lia_adotar_orfas", db.rpc("lia_adotar_orfas", { p_mentorado: mentoradoId }));
}

// W12 (index.html:3533): só "pausado" guarda as datas, e a pausa sem data vale hoje. `hoje` vem
// de quem chama, lido na hora: o relógio fica fora da porta (AD-007).
export function salvarSituacao(id: string, campos: SituacaoMentorado, hoje: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const pausado = campos.situacao === "pausado";
  const payload = {
    situacao: campos.situacao,
    pausado_em: pausado ? campos.pausado_em || hoje : null,
    retorno_previsto: pausado ? ouNulo(campos.retorno_previsto) : null,
  };
  return conferir("mentorados", db.from("mentorados").update(payload).eq("id", id).select("id"));
}

// W13 (index.html:3731): a única escrita que já conferia as linhas hoje.
export function excluirMentorado(id: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("mentorados", db.from("mentorados").delete().eq("id", id).select("id"));
}

// W14 (index.html:3769).
export function criarMentorado(novo: NovoMentorado, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const payload = {
    nome: novo.nome,
    email: novo.email,
    data_fechamento: ouNulo(novo.data_fechamento),
    entrada_status: novo.entrada_status,
    entrada_forma_pgto: ouNulo(novo.entrada_forma_pgto),
    contrato_status: novo.contrato_status,
    restante_status: novo.restante_status,
    cancelado: false,
  };
  return conferir("mentorados", db.from("mentorados").insert(payload).select().single());
}

// W20: o formulário de parcela, com o número ≥ 1 e único no mentorado já conferido por ele.
export interface CamposParcela {
  numero: number;
  vencimento: string | null;
  valor: number | null;
  status: string;
}

// O reflexo das cobranças da Lia no financeiro do mentorado: a mesma função do banco que o
// webhook usa (20260918_lia_refletir_financeiro.sql).
export function refletirFinanceiro(mentoradoId: string, db: SupabaseClient = cliente()): Promise<Resultado<null>> {
  return chamar("lia_refletir_financeiro", db.rpc("lia_refletir_financeiro", { p_mentorado: mentoradoId }));
}

// W15–W17: a cobrança gravada e, com dono, o reflexo no financeiro dele. A falha do reflexo não
// desfaz o que já gravou: volta à parte, como `aviso` (WRITE-07).
async function comReflexo(escrita: Promise<ResultadoEscrita>, dono: string | null, db: SupabaseClient): Promise<ResultadoEscrita> {
  const gravada = await escrita;
  if (!gravada.ok || dono === null) return gravada;
  const reflexo = await refletirFinanceiro(dono, db);
  return reflexo.ok ? gravada : { ...gravada, aviso: reflexo.erro };
}

const cobranca = (billId: string, payload: { mentorado_id: string } | { ignorada: boolean }, db: SupabaseClient) =>
  conferir("lia_cobrancas", db.from("lia_cobrancas").update(payload).eq("lia_bill_id", billId).select("lia_bill_id"));

// W15 (index.html:3501): vincula à mão uma cobrança órfã ao mentorado.
export function vincularCobranca(billId: string, mentoradoId: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return comReflexo(cobranca(billId, { mentorado_id: mentoradoId }, db), mentoradoId, db);
}

// W16 (index.html:3513): descartar em vez de apagar, porque o próximo webhook recriaria a linha.
// `dono` é o mentorado_id da cobrança, null quando ela é órfã.
export function descartarCobranca(billId: string, dono: string | null, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return comReflexo(cobranca(billId, { ignorada: true }, db), dono, db);
}

// W17 (index.html:3522).
export function restaurarCobranca(billId: string, dono: string | null, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return comReflexo(cobranca(billId, { ignorada: false }, db), dono, db);
}

// W18 (index.html:3542): alterna aberta ↔ paga a partir do status que a tela mostra.
export function toggleParcela(id: string, status: string | null, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("parcelas", db.from("parcelas").update({ status: status === "paga" ? "aberta" : "paga" }).eq("id", id).select("id"));
}

// W19 (index.html:3549): o número é o maior do mentorado + 1, contado nas parcelas que a tela
// tem, como hoje. A 13ª é recusada antes de sair.
export async function addParcela(
  mentoradoId: string,
  parcelas: readonly Parcela[],
  vencimento: string | null,
  valor: number | null,
  db: SupabaseClient = cliente(),
): Promise<ResultadoEscrita> {
  const numero = Math.max(0, ...parcelas.filter((p) => p.mentorado_id === mentoradoId).map((p) => p.numero ?? 0)) + 1;
  if (numero > 12) return { ok: false, erro: "Limite de 12 parcelas atingido" };
  const payload = { mentorado_id: mentoradoId, numero, status: "aberta", vencimento: ouNulo(vencimento), valor };
  return conferir("parcelas", db.from("parcelas").insert(payload).select("id"));
}

// W20 (index.html:3578).
export function salvarParcela(id: string, parcela: CamposParcela, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  const payload = { numero: parcela.numero, vencimento: ouNulo(parcela.vencimento), valor: parcela.valor, status: parcela.status };
  return conferir("parcelas", db.from("parcelas").update(payload).eq("id", id).select("id"));
}

// W21 (index.html:3589).
export function delParcela(id: string, db: SupabaseClient = cliente()): Promise<ResultadoEscrita> {
  return conferir("parcelas", db.from("parcelas").delete().eq("id", id).select("id"));
}
