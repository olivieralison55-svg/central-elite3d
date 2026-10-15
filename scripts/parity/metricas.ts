import { ETAPAS_GRUPO } from "@/lib/constantes";
import type { Dataset } from "@/lib/data/esquemas";
import { fmtD } from "@/lib/datas";
import { motivoOrfa, painelFinanceiro } from "@/lib/financeiro";
import { chaveMentorado, contagemRisco, leiturasPorMentor, leiturasPorMentorado, numerosDoMentor } from "@/lib/ia";
import { matrizMentores } from "@/lib/matriz";
import { ehAtivo, filtrarMentorados } from "@/lib/mentorados";
import { resumosDosMentores } from "@/lib/mentores";
import { fmtMedia, fmtNps, linhaDoPeriodo, mediaNps, mentoresDoNps, type PeriodoNps, periodosDoNps, resumoExperiencia, rotuloPeriodoNps, scoreNps } from "@/lib/nps";
import { painel } from "@/lib/painel";
import { type Papel, pode } from "@/lib/papeis";
import { canaisDaRota, estadoDoMarco, marcosDaRota, metaDoMarco, progressoMarco, reguaFaturamento, ultimosMeses } from "@/lib/rotas";
import { agruparGrupo, blocos1a1, concluidas1a1De, eh1a1, ehGrupo, implementacaoDe, plantoesDe, sessoes1a1De } from "@/lib/sessoes";
import { ANALISE_FILTROS, agregadosAnalise, concentracaoAnalise, contagemStatusReal, linhasAnalise, listaAnalise, recorteAnalise, topAnuncios } from "@/lib/stlseller";

import { centavos, chaveDeNome, chaveMentor, ordenados, type Valores } from "./chaves";

// As 17 métricas de paridade do lado novo (GATE-06, Apêndice A da spec), com as chaves e os
// valores do lado antigo (metricas-legado.mjs). Cada uma chama as regras de src/lib/ que a tela
// chama: o script não tem regra própria, só a forma da chave.

type Metrica = (dados: Dataset, papel: Papel, hoje: string) => Valores;

const semParentese = (rotulo: string) => rotulo.replace(/\s*\(.*$/, "");

export const par01: Metrica = (dados, papel, hoje) => {
  const p = painel(dados, papel, hoje, "");
  const valores: Valores = Object.fromEntries(p.atencao.map((item) => [semParentese(item.rotulo), item.contagem]));
  if (p.adesao) valores["Poucas respostas na Pesquisa de Experiência"] = `${p.adesao.respostas}/${p.adesao.total}`;
  return valores;
};

export const par02: Metrica = (dados, papel, hoje) => {
  const { listas } = painel(dados, papel, hoje, "");
  return {
    orfas: listas.orfas.itens.map((o) => o.mentorado_id),
    risco: listas.risco.itens.map((r) => r.mentorado.id),
    "sem-implementacao": listas.semImplementacao.itens.map((x) => x.mentorado.id),
    "sem-subida": listas.semSubida.itens.map((x) => `${x.mentorado.id}:${x.dias}`),
    "nps-pend": listas.npsPend.itens.map((x) => x.mentorado.id),
  };
};

export const par03: Metrica = (dados, papel, hoje) => ({ ...painel(dados, papel, hoje, "").numeros });

export const par04: Metrica = (dados, papel, hoje) => ({
  proximas: painel(dados, papel, hoje, "").proximas.map((p) => (p.encontro ? `grupo|${p.encontro.chave}` : `1:1|${p.mentoradoId}|${p.data}|${p.hora ?? ""}`)),
});

export const par05: Metrica = (dados, papel, hoje) =>
  Object.fromEntries(painel(dados, papel, hoje, "").progressao.map(({ mentorado, nivel }) => [mentorado.id, { nivel: nivel.atual.nome, total: centavos(nivel.total) }]));

export const par06: Metrica = (dados, _papel, hoje) => {
  const { meses } = matrizMentores(dados.sessoes, null, hoje);
  const valores: Valores = {};
  for (const mes of ["", ...meses]) {
    const m = matrizMentores(dados.sessoes, mes, hoje);
    const porEtapa = (contagem: number[]) => Object.fromEntries(m.etapas.map((etapa, i) => [etapa, contagem[i]]));
    const rotulo = mes || "todos";
    valores[`${rotulo}|__meses__`] = meses.length;
    for (const l of m.linhas) valores[`${rotulo}|${chaveMentor(l.mentor)}`] = { porEtapa: porEtapa(l.porEtapa), total1a1: l.total1a1, grupo: l.grupo, presencas: l.presencas };
    if (m.semMentor) valores[`${rotulo}|__sem__`] = { porEtapa: porEtapa(m.semMentor.porEtapa), total1a1: m.semMentor.total1a1, grupo: m.semMentor.grupo };
  }
  return valores;
};

export const par07: Metrica = (dados, _papel, hoje) => {
  const { focos } = matrizMentores(dados.sessoes, null, hoje);
  return { dobradas: ordenados(focos.dobradas), semData: ordenados(focos.semData), semMentor: ordenados(focos.semMentor), etapaDeduzida: ordenados(focos.etapaDeduzida) };
};

export const par08: Metrica = (dados, papel) => {
  const filtros = ["", "ativos", "pausados", "incompletos", ...(pode(papel, "verFinanceiro") ? ["contrato"] : [])];
  return Object.fromEntries(filtros.map((f) => [f || "todos", ordenados(filtrarMentorados(dados.mentorados, f, "").lista.map((m) => m.id))]));
};

export const par09: Metrica = (dados) => {
  const valores: Valores = Object.fromEntries(blocos1a1(dados.sessoes.filter(eh1a1), false).map((b) => [b.chave, ordenados(b.itens.map((s) => s.id))]));
  for (const categoria of ETAPAS_GRUPO) {
    valores[`grupo|${categoria}`] = ordenados(agruparGrupo(dados.sessoes.filter((s) => ehGrupo(s) && s.etapa === categoria)).map((e) => e.chave));
  }
  return valores;
};

export const par10: Metrica = (dados, papel) =>
  Object.fromEntries(
    dados.mentorados.map((m) => {
      const parcelas = pode(papel, "verFinanceiro") ? dados.parcelas.filter((p) => p.mentorado_id === m.id) : [];
      const trilha = sessoes1a1De(dados.sessoes, m.id);
      const implementacao = implementacaoDe(dados.sessoes, m.id);
      return [
        m.id,
        {
          pagas: parcelas.length ? parcelas.filter((p) => p.status === "paga").length : null,
          parcelas: parcelas.length || null,
          concluidas: trilha.length ? concluidas1a1De(dados.sessoes, m.id) : null,
          trilha: trilha.length || null,
          implementacao: implementacao ? fmtD(implementacao.data) : null,
          plantoes: plantoesDe(dados.sessoes, m),
        },
      ];
    }),
  );

export const par11: Metrica = (dados, _papel, hoje) => {
  const f = painelFinanceiro(dados, "", hoje);
  return {
    "cards.vencidas": f.cards.vencidas,
    "cards.restanteAberto": f.cards.restanteAberto,
    "cards.restanteParcial": f.cards.restanteParcial,
    "cards.assinados": f.cards.assinados,
    "cards.ativos": f.cards.ativos,
    vencidas: ordenados(f.vencidas.flatMap((l) => l.vencidas.map((p) => p.id))),
    proximos: f.proximos.map((p) => p.id),
    ...Object.fromEntries(f.orfas.map((c) => [`orfa|${c.lia_bill_id}`, motivoOrfa(c, dados.mentorados)])),
    descartadas: ordenados(f.descartadas.map((c) => c.lia_bill_id)),
  };
};

export const par12: Metrica = (dados, _papel, hoje) => {
  const mesCorrente = ultimosMeses(hoje).at(-1) ?? "";
  const valores: Valores = {};
  for (const rota of dados.rotas) {
    const marcos = marcosDaRota(dados.marcos, rota);
    const canais = canaisDaRota(dados.canais, rota);
    for (const mentorado of dados.mentorados.filter(ehAtivo)) {
      const regua = reguaFaturamento(rota, canais, dados.faturamento, mentorado.id, mesCorrente);
      for (const marco of marcos) {
        const registro = dados.mentoradoMarcos.find((x) => x.mentorado_id === mentorado.id && x.marco_id === marco.id);
        const { feitos, total } = progressoMarco(marco, registro);
        const meta = metaDoMarco(marco, regua);
        valores[`${rota.id}|${mentorado.id}|${marco.id}`] = {
          fase: estadoDoMarco(rota, registro).fase,
          feitos,
          total,
          regua: meta ? centavos(regua) : null,
          falta: meta ? centavos(meta.falta) : null,
        };
      }
    }
  }
  return valores;
};

export const par13: Metrica = (dados) => {
  const linhas = linhasAnalise(dados);
  const valores: Valores = {};
  for (const [recorte, status] of [
    ["ativos", "ATIVO"],
    ["todos", ""],
  ]) {
    const base = recorteAnalise(linhas, status);
    const a = agregadosAnalise(base);
    const fatias = concentracaoAnalise(base).map((f) => centavos(f.valor));
    Object.assign(valores, {
      [`${recorte}|bruto`]: centavos(a.bruto),
      [`${recorte}|receita`]: centavos(a.receita),
      [`${recorte}|pedidos`]: a.pedidos,
      [`${recorte}|cancelados`]: a.cancelados,
      [`${recorte}|vendendo`]: `${a.vendendo}/${base.length}`,
      [`${recorte}|plano`]: `${a.comPlano}/${base.length}`,
      [`${recorte}|semConta`]: a.semConta,
      [`${recorte}|concentracao`]: fatias.slice(0, 5),
      [`${recorte}|outros`]: fatias.length === 6 ? fatias[5] : null,
    });
    for (const [s, n] of contagemStatusReal(base)) valores[`${recorte}|status|${s}`] = n;
    for (const [chip] of ANALISE_FILTROS) valores[`${recorte}|chip|${chip}`] = listaAnalise(base, chip, "", null).lista.length;
    valores[`${recorte}|anuncios`] = topAnuncios(base).map(({ p }) => `${p.marketplace}|${p.anuncio_id}`);
  }
  return valores;
};

export const par14: Metrica = (dados) => {
  if (!dados.nps.length) return {};
  const mentores = mentoresDoNps(dados.nps);
  const numeros = (respostas: Dataset["nps"]) => ({ media: fmtMedia(mediaNps(respostas)), nps: fmtNps(scoreNps(respostas)), respostas: respostas.length });
  const valores: Valores = { geral: numeros(dados.nps) };
  for (const m of mentores) valores[`mentor|${chaveMentor(m)}`] = numeros(dados.nps.filter((r) => r.mentor === m));
  for (const periodo of ["semana", "mes"] as PeriodoNps[]) {
    for (const chave of periodosDoNps(dados.nps, periodo)) {
      const linha = linhaDoPeriodo(dados.nps, periodo, chave, mentores);
      const rotulo = rotuloPeriodoNps(chave, periodo);
      valores[`${periodo}|${rotulo}|todos`] = { respostas: linha.respostas, media: fmtMedia(linha.media), nps: fmtNps(linha.nps) };
      for (const [m, { media, n }] of linha.porMentor) valores[`${periodo}|${rotulo}|${chaveMentor(m)}`] = n ? `${fmtMedia(media)} (${n})` : "—";
    }
  }
  return valores;
};

export const par15: Metrica = (dados) => {
  if (!dados.experiencia.length) return {};
  const r = resumoExperiencia(dados.experiencia);
  return {
    nps: fmtNps(r.nps),
    respostas: r.respostas,
    media: fmtMedia(r.media),
    indice: r.indice === null ? "—" : String(r.indice),
    clareza: `${r.clareza.pctSim}%`,
    ...Object.fromEntries(r.itens.map((i) => [`item|${i.item}`, { indice: Math.round(i.indice), respostas: i.respostas }])),
  };
};

export const par16: Metrica = (dados, papel) => {
  const analise = dados.analise;
  if (!analise) return {};
  const leituras = leiturasPorMentorado(analise);
  const risco = contagemRisco(leituras);
  const valores: Valores = {
    ordem: leituras.map((l) => {
      const chave = chaveMentorado(l);
      return chave.startsWith("nome:") ? chaveDeNome(chave.slice(5)) : chave;
    }),
    "risco|total": leituras.length,
    "risco|alto": risco.alto,
    "risco|medio": risco.medio,
    "risco|baixo": risco.baixo,
  };
  if (pode(papel, "verFinanceiro")) {
    for (const l of leiturasPorMentor(analise)) {
      const n = numerosDoMentor(dados.nps, l.mentor);
      valores[`mentor|${chaveMentor(l.mentor)}`] = { media: fmtMedia(n.media), nps: fmtNps(n.nps) };
    }
  }
  return valores;
};

export const par17: Metrica = (dados, _papel, hoje) =>
  Object.fromEntries(
    resumosDosMentores(dados, hoje).map((r) => [
      chaveMentor(r.nome),
      {
        carteira: r.carteira.map((c) => c.m.id),
        r1_30: r.r1_30.length,
        r1: r.r1.length,
        grupos30: r.grupos30.length,
        grupos: r.grupos.length,
        agenda: r.agenda.length,
        media30: fmtMedia(mediaNps(r.nps30)),
        nps30: fmtNps(scoreNps(r.nps30)),
        calls: r.calls,
        ultima: r.ultima,
      },
    ]),
  );

// Os mesmos ids da T77, na mesma ordem.
export const METRICAS: readonly (readonly [string, Metrica])[] = [
  ["PAR-01", par01],
  ["PAR-02", par02],
  ["PAR-03", par03],
  ["PAR-04", par04],
  ["PAR-05", par05],
  ["PAR-06", par06],
  ["PAR-07", par07],
  ["PAR-08", par08],
  ["PAR-09", par09],
  ["PAR-10", par10],
  ["PAR-11", par11],
  ["PAR-12", par12],
  ["PAR-13", par13],
  ["PAR-14", par14],
  ["PAR-15", par15],
  ["PAR-16", par16],
  ["PAR-17", par17],
];
