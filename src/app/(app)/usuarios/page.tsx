import Usuarios from "@/components/modules/usuarios/usuarios";

// /usuarios: contas de acesso, só do admin (AD-011). Quem não pode é mandado para /dash pela casca (NAV-04).
export default function PaginaUsuarios() {
  return <Usuarios />;
}
