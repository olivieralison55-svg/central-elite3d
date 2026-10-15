"use client";

import { type FormEvent, useState } from "react";

import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FormField from "@/components/ui/form-field";
import Input from "@/components/ui/input";
import { entrar } from "@/lib/data/auth";

// O login de hoje (index.html:471–480, 710–717): e-mail, senha e Entrar, sem cadastro nem
// recuperação de senha (AUTH-10). Os campos não são controlados: a senha mora só no <input>
// e some com ele quando a tela desmonta, na entrada ou na saída (AUTH-08).

// Devolve a mensagem que a tela mostra, ou null quando entrou: quem segue é o
// onAuthStateChange. Campo vazio não vai ao Supabase, como hoje (index.html:711–713).
export async function enviarLogin(email: string, senha: string, entrarNoAuth = entrar): Promise<string | null> {
  if (!email.trim() || !senha) return "Preencha e-mail e senha.";
  return entrarNoAuth(email.trim(), senha);
}

// Entrar é o submit do <form>: Enter no campo de senha envia (AUTH-03).
export function FormularioLogin({ erro, enviando, enviar }: { erro: string | null; enviando: boolean; enviar(evento: FormEvent<HTMLFormElement>): void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <Card className="w-full max-w-[420px] p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Mentoria Elite 3D · STLFLIX</p>
        <h1 className="mb-6 mt-2 text-2xl font-bold text-ink">Entrar</h1>
        <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
          <FormField label="E-mail" htmlFor="login-email">
            <Input id="login-email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" />
          </FormField>
          <FormField label="Senha" htmlFor="login-senha">
            <Input id="login-senha" name="senha" type="password" autoComplete="current-password" placeholder="••••••••" />
          </FormField>
          <Button type="submit" loading={enviando} className="w-full">
            Entrar
          </Button>
          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
        </form>
        <p className="mt-5 text-center text-sm text-muted">Acesso restrito à equipe. Solicite seu login ao administrador.</p>
      </Card>
    </main>
  );
}

export default function TelaLogin() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const campos = new FormData(evento.currentTarget);
    setErro(null);
    setEnviando(true);
    try {
      setErro(await enviarLogin(String(campos.get("email") ?? ""), String(campos.get("senha") ?? "")));
    } finally {
      setEnviando(false);
    }
  }

  return <FormularioLogin erro={erro} enviando={enviando} enviar={(evento) => void enviar(evento)} />;
}
