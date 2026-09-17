// Webhook da Lia — reflete pagamentos dentro da Central.
//
// Nada aqui escreve NA Lia. O fluxo e de mao unica: a Lia avisa, a gente
// espelha em lia_cobrancas e deriva dali o financeiro do mentorado.
//
// ATENCAO: esta e a unica funcao do projeto publicada com verify_jwt FALSE.
// Tem que ser: a Lia nao faz login no Supabase e nao manda JWT. Quem garante a
// procedencia e o header X-Lia-Signature -- HMAC-SHA1 do corpo CRU assinado com
// a LIA_API_KEY. Sem assinatura valida, 401 e nada e gravado alem do log.
//
// Deploy:
//   supabase functions deploy lia-webhook --no-verify-jwt --project-ref <ref>

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIA_API_KEY = Deno.env.get("LIA_API_KEY") ?? "";

/* Cliente no escopo do modulo. Passar o client por parametro exigiria os tipos
   gerados do banco para o generico de supabase-js resolver; sem eles o tipo
   colapsa em never e nenhum .from() compila. */
const db = createClient(SUPABASE_URL, SERVICE_KEY);

/* ---------------- tipos do payload da Lia ----------------
   Tudo opcional de proposito: o payload vem de fora e nao ha garantia de que a
   Lia mantenha os campos. A normalizacao trata as ausencias. */
type LiaPagamento = {
  status?: string;
  url?: string | null;
  amount_cents?: number;
  paid_amount_cents?: number;
  payment_method?: string | null;
};
type LiaBill = {
  id?: string | number;
  status?: string;
  bill_type?: string;
  paid_at?: string | null;
  due_date?: string | null;
  effective_due_date?: string | null;
  amount_cents?: number;
  current_amount_cents?: number;
  checkout_url?: string | null;
  updated_at?: string | null;
  payments?: LiaPagamento[];
  bill_details?: { installment?: number }[];
  contact?: { email?: string | null };
};
type LiaBilling = {
  id?: string | number;
  order_id?: string | number;
  bills?: LiaBill[];
  contact?: { email?: string | null };
};
type LiaOrder = {
  id?: string | number;
  email?: { address?: string | null } | null;
  billings?: LiaBilling[];
};
type Envelope = {
  id?: string;
  entity?: string;
  event?: string;
  data?: LiaBill & LiaBilling & LiaOrder;
};

/* Uma linha de lia_cobrancas, do jeito que este arquivo a le de volta. Nao e o
   schema inteiro -- so o que o reflexo no financeiro consulta. */
type Cobranca = {
  lia_bill_id: string;
  bill_type: string | null;
  status: string;
  numero_parcela: number | null;
  amount_cents: number;
  payment_method: string | null;
  due_date: string | null;
};

/* De-para do metodo da Lia para o texto que a ficha ja usa. */
const FORMA_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  credit_card: "Cartão de crédito",
};

/* Status que uma PESSOA decidiu e a Lia nao tem como saber. Nunca sobrescreve:
   patrocinado nao gera cobranca, e cancelado e decisao de contrato. */
const STATUS_INTOCAVEIS = new Set(["Patrocinado", "Cancelou"]);

const texto = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : String(v);

/* ---------------- assinatura ---------------- */
/* HMAC-SHA1 do corpo CRU. Reserializar o JSON muda espacos e invalida a
   assinatura -- por isso o handler le request.text() antes de qualquer parse. */
async function assinaturaValida(corpoCru: string, recebida: string | null) {
  if (!recebida || !LIA_API_KEY) return false;
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw", enc.encode(LIA_API_KEY), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const assinado = await crypto.subtle.sign("HMAC", chave, enc.encode(corpoCru));
  const esperada = Array.from(new Uint8Array(assinado))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = enc.encode(esperada);
  const b = enc.encode(recebida.trim().toLowerCase());
  if (a.length !== b.length) return false;
  // Comparacao de tempo constante: sair no primeiro byte diferente vaza a
  // assinatura esperada por medida de tempo.
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------------- extracao das faturas ----------------
   A mesma fatura chega solta (entity "bill"), dentro de bills[] (entity
   "billing") ou dois niveis abaixo (entity "order"). Um so caminho de leitura
   para os tres, senao cada entidade viraria um ramo com regra propria. */
type Ctx = { orderId: string | null; billingId: string | null; email: string | null };

function coletarBills(d: Envelope["data"]): { bill: LiaBill; ctx: Ctx }[] {
  if (!d) return [];
  const out: { bill: LiaBill; ctx: Ctx }[] = [];
  const emailDoTopo = texto(d.email?.address) ?? texto(d.contact?.email);

  const daBilling = (b: LiaBilling, orderId: string | null, email: string | null) => {
    const ctx: Ctx = {
      orderId: orderId ?? texto(b.order_id),
      billingId: texto(b.id),
      email: texto(b.contact?.email) ?? email,
    };
    for (const bill of b.bills ?? []) {
      out.push({ bill, ctx: { ...ctx, email: texto(bill.contact?.email) ?? ctx.email } });
    }
  };

  if (d.billings?.length) {
    for (const b of d.billings) daBilling(b, texto(d.id), emailDoTopo);
  } else if (d.bills?.length) {
    daBilling(d as LiaBilling, texto(d.order_id), emailDoTopo);
  } else if (d.id !== undefined) {
    // Fatura solta.
    out.push({
      bill: d as LiaBill,
      ctx: {
        orderId: texto(d.order_id),
        billingId: texto(d.id) === texto((d as LiaBill).id) ? null : texto(d.id),
        email: texto((d as LiaBill).contact?.email) ?? emailDoTopo,
      },
    });
  }
  return out;
}

function normalizar(bill: LiaBill, ctx: Ctx) {
  const billId = texto(bill.id);
  if (!billId) return null;

  const pagamentos = bill.payments ?? [];
  const pagos = pagamentos.filter((p) => p.status === "paid");
  const valor = bill.current_amount_cents ?? bill.amount_cents ?? 0;
  const pagoCents =
    pagos.reduce((s, p) => s + (p.paid_amount_cents || p.amount_cents || 0), 0) ||
    (bill.status === "paid" ? valor : 0);
  // Metodo efetivamente usado; se ainda nao pagou, o do ultimo meio gerado.
  const ref = pagos[pagos.length - 1] ?? pagamentos[pagamentos.length - 1];
  const venc = bill.due_date ?? bill.effective_due_date ?? null;

  return {
    lia_bill_id: billId,
    lia_order_id: ctx.orderId,
    lia_billing_id: ctx.billingId,
    bill_type: bill.bill_type ?? null,
    status: bill.status ?? "pending",
    numero_parcela: bill.bill_details?.find((d) => d.installment)?.installment ?? null,
    amount_cents: valor,
    paid_amount_cents: pagoCents,
    payment_method: ref?.payment_method ?? null,
    due_date: venc ? venc.slice(0, 10) : null,
    paid_at: bill.paid_at ?? null,
    checkout_url: bill.checkout_url ?? ref?.url ?? null,
    contact_email: ctx.email ? ctx.email.toLowerCase() : null,
    lia_updated_at: bill.updated_at ?? null,
    payload: bill as unknown,
  };
}

/* ---------------- de quem e a cobranca ---------------- */
async function resolverMentorado(ctx: Ctx): Promise<string | null> {
  if (ctx.orderId) {
    const { data } = await db.from("mentorados").select("id")
      .eq("lia_order_id", ctx.orderId).maybeSingle();
    if (data?.id) return data.id;
  }
  if (ctx.email) {
    // Igualdade, nao ilike: "_" e "%" no endereco viram curinga e casariam com
    // o mentorado errado. Os dois lados ficam em minusculas (trigger no banco).
    const { data } = await db.from("mentorados").select("id, lia_order_id")
      .eq("email", ctx.email.toLowerCase()).limit(2);
    // Dois com o mesmo e-mail e ambiguo -- melhor orfao do que na pessoa errada.
    if (data && data.length === 1) {
      if (ctx.orderId && !data[0].lia_order_id) {
        await db.from("mentorados").update({ lia_order_id: ctx.orderId }).eq("id", data[0].id);
      }
      return data[0].id;
    }
  }
  return null;
}

/* ---------------- gravacao do espelho ---------------- */
async function salvarCobranca(dados: Record<string, unknown>, mentoradoId: string | null) {
  const { data: atual } = await db.from("lia_cobrancas")
    .select("id, lia_updated_at, mentorado_id").eq("lia_bill_id", String(dados.lia_bill_id)).maybeSingle();

  if (!atual) {
    await db.from("lia_cobrancas").insert({ ...dados, mentorado_id: mentoradoId });
    return;
  }
  // Webhook chega fora de ordem: evento antigo nao sobrescreve o novo.
  if (atual.lia_updated_at && dados.lia_updated_at &&
      new Date(String(dados.lia_updated_at)) < new Date(atual.lia_updated_at)) return;

  await db.from("lia_cobrancas")
    .update({ ...dados, mentorado_id: mentoradoId ?? atual.mentorado_id })
    .eq("id", atual.id);
}

/* ---------------- reflexo no financeiro ----------------
   A Lia vira a fonte das parcelas de quem tem cobranca la. As linhas manuais
   desse mentorado saem; quem nao tem cobranca na Lia nao e tocado, porque nao
   ha de onde tirar dado para substituir. */
async function refletirFinanceiro(mentoradoId: string) {
  const [{ data: m }, { data: cobrancas }] = await Promise.all([
    db.from("mentorados").select("*").eq("id", mentoradoId).maybeSingle(),
    db.from("lia_cobrancas").select("*").eq("mentorado_id", mentoradoId)
      .order("due_date", { ascending: true }),
  ]);
  if (!m) return;

  const validas = ((cobrancas ?? []) as Cobranca[]).filter((c) => c.status !== "canceled");
  if (!validas.length) return;

  const pago = (c: Cobranca) => c.status === "paid";
  const entrada = validas.filter((c) => c.bill_type === "down_payment");
  const parcelasLia = validas.filter((c) => c.bill_type !== "down_payment");

  /* ----- entrada e restante no cabecalho da ficha ----- */
  const patch: Record<string, unknown> = {};
  const statusDe = (lista: Cobranca[]) => {
    const n = lista.filter(pago).length;
    return n === 0 ? "Ainda não" : n === lista.length ? "Pago" : "Pago parcial";
  };

  if (entrada.length && !STATUS_INTOCAVEIS.has(m.entrada_status)) {
    patch.entrada_status = statusDe(entrada);
  }
  if (!STATUS_INTOCAVEIS.has(m.restante_status)) {
    patch.restante_status = parcelasLia.length
      ? statusDe(parcelasLia)
      // A vista: a propria entrada quita tudo.
      : (validas.every(pago) ? "Pago" : "Ainda não");
  }

  // Forma de pagamento so preenche o que esta vazio: escolha de pessoa nao e
  // sobrescrita por inferencia.
  const metodoDe = (lista: Cobranca[]) =>
    lista.find((c) => pago(c) && c.payment_method)?.payment_method ??
    lista.find((c) => c.payment_method)?.payment_method ?? null;

  if (!m.entrada_forma_pgto) {
    const met = metodoDe(entrada.length ? entrada : validas);
    if (met) patch.entrada_forma_pgto = FORMA_PAGAMENTO[met] ?? "Outro";
  }
  if (!m.restante_forma_pgto && parcelasLia.length) {
    const met = metodoDe(parcelasLia);
    patch.restante_forma_pgto = parcelasLia.length > 1
      ? "Parcelado"
      : (met ? FORMA_PAGAMENTO[met] ?? "Outro" : "Outro");
  }

  if (Object.keys(patch).length) {
    await db.from("mentorados").update(patch).eq("id", mentoradoId);
  }

  /* ----- parcelas ----- */
  if (!parcelasLia.length) return;

  /* Ordem importa: apagar primeiro. O unico e (mentorado_id, numero), entao uma
     linha manual no numero 3 bloquearia a parcela 3 vinda da Lia. */
  await db.from("parcelas").delete().eq("mentorado_id", mentoradoId).is("lia_bill_id", null);

  // Cobranca cancelada some da ficha: a parcela dela deixa de existir.
  const canceladas = ((cobrancas ?? []) as Cobranca[]).filter((c) => c.status === "canceled");
  for (const c of canceladas) {
    await db.from("parcelas").delete().eq("lia_bill_id", c.lia_bill_id);
  }

  /* numero_parcela nem sempre vem no payload. O fallback e a posicao por
     vencimento, que e a ordem em que a pessoa vai pagar -- e a mesma ordem que
     a ficha desenha. */
  const ordenadas = [...parcelasLia].sort((a, b) =>
    String(a.due_date ?? "9999").localeCompare(String(b.due_date ?? "9999")));

  for (let i = 0; i < ordenadas.length; i++) {
    const c = ordenadas[i];
    const numero = c.numero_parcela ?? (i + 1);
    if (numero < 1 || numero > 60) continue; // fora do CHECK: ignora em vez de estourar
    await db.from("parcelas").upsert({
      mentorado_id: mentoradoId,
      numero,
      status: pago(c) ? "paga" : "aberta",
      vencimento: c.due_date,
      valor: (c.amount_cents ?? 0) / 100,
      lia_bill_id: c.lia_bill_id,
    }, { onConflict: "mentorado_id,numero" });
  }
}

/* ---------------- handler ---------------- */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "use POST" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const corpoCru = await req.text();
  const assinatura = req.headers.get("X-Lia-Signature") ?? req.headers.get("x-lia-signature");
  const valida = await assinaturaValida(corpoCru, assinatura);

  let env: Envelope = {};
  try { env = JSON.parse(corpoCru || "{}"); } catch { /* segue: vira log de erro */ }

  /* A linha do log nasce na reserva de idempotencia e depois e ATUALIZADA com o
     desfecho. Inserir de novo no fim bateria no unico de lia_delivery_id e
     falharia calada -- o log ficaria eternamente em "recebido", que e
     exatamente o estado que nao interessa a ninguem. */
  let reservado = false;
  const registrar = async (status: string, detalhe: string, mentoradoId: string | null = null) => {
    if (reservado && env.id) {
      await db.from("lia_eventos")
        .update({ status, detalhe, mentorado_id: mentoradoId })
        .eq("lia_delivery_id", env.id);
      return;
    }
    await db.from("lia_eventos").insert({
      lia_delivery_id: reservado ? null : env.id ?? null,
      entity: env.entity ?? null,
      event: env.event ?? null,
      assinatura_valida: valida,
      status, detalhe, mentorado_id: mentoradoId,
      payload: env as unknown,
    });
  };

  /* Assinatura invalida fica registrada -- e o que mostra tentativa de forjar.
     Sem reservar o delivery_id: envio forjado nao pode bloquear o log do envio
     legitimo com o mesmo id, nem o de uma segunda tentativa. */
  if (!valida) {
    await db.from("lia_eventos").insert({
      lia_delivery_id: null, entity: env.entity ?? null, event: env.event ?? null,
      assinatura_valida: false, status: "erro",
      detalhe: `assinatura invalida ou ausente (envelope ${env.id ?? "sem id"})`,
      payload: env as unknown,
    });
    return new Response(JSON.stringify({ ok: false, error: "assinatura invalida" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  /* Idempotencia pelo id do envelope: a Lia reenvia quando nao recebe 200, e
     reprocessar duplicaria pagamento na conta. O unico em lia_delivery_id e que
     decide -- checar antes e inserir depois abriria janela de corrida. */
  if (env.id) {
    const { error } = await db.from("lia_eventos").insert({
      lia_delivery_id: env.id, entity: env.entity ?? null, event: env.event ?? null,
      assinatura_valida: true, status: "recebido", payload: env as unknown,
    });
    if (error) {
      return new Response(JSON.stringify({ ok: true, status: "duplicado" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    reservado = true;
  }

  try {
    const bills = coletarBills(env.data);
    if (!bills.length) {
      await registrar("ignorado", `sem fatura no payload (entity ${env.entity ?? "?"})`);
      return new Response(JSON.stringify({ ok: true, status: "ignorado" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const afetados = new Set<string>();
    let orfas = 0;

    for (const { bill, ctx } of bills) {
      const dados = normalizar(bill, ctx);
      if (!dados) continue;
      const mentoradoId = await resolverMentorado(ctx);
      await salvarCobranca(dados, mentoradoId);
      if (mentoradoId) afetados.add(mentoradoId); else orfas++;
    }

    for (const id of afetados) await refletirFinanceiro(id);

    const status = afetados.size ? "processado" : "sem_vinculo";
    await registrar(status,
      `${bills.length} fatura(s), ${afetados.size} mentorado(s), ${orfas} sem vinculo`,
      [...afetados][0] ?? null);

    return new Response(JSON.stringify({
      ok: true, status, faturas: bills.length, mentorados: afetados.size, orfas,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await registrar("erro", String(e));
    // 500 faz a Lia reenviar, e o reenvio cai na idempotencia acima.
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
