import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "react-hot-toast";

// A Inter auto-hospedada da plataforma (UI-03), copiada com o design system: o
// arquivo no repo gera o mesmo hash de classe em todo build, o que a fonte baixada
// do Google a cada compilação não garante.
const inter = localFont({
  src: "../public/fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Central de Controle · Elite 3D",
};

// O favicon é o src/app/icon.png, pela convenção de arquivo do Next (CUT-03).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Tema sem flash (UI-04): script síncrono, roda antes da primeira pintura. */}
        <script src="/theme-init.js" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "14px",
              background: "var(--background)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
            },
          }}
        />
      </body>
    </html>
  );
}
