import type { ReactNode } from "react";

import Casca from "@/components/shell/casca";

// Toda tela do app passa pela casca: sessão, menu e guardas de tela.
export default function LayoutDoApp({ children }: Readonly<{ children: ReactNode }>) {
  return <Casca>{children}</Casca>;
}
