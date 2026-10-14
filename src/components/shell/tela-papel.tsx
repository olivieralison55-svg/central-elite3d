export type MotivoSemAcesso = "semPerfil" | "papelInvalido";

// Lugar das telas "Perfil não encontrado" e "Papel não reconhecido": a T17 as desenha.
export default function TelaPapel(_props: { motivo: MotivoSemAcesso; sair(): Promise<void> }) {
  return null;
}
