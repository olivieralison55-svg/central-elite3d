// Tema sem flash (UI-04): liga `.dark` no <html> antes da primeira pintura.
// A escolha que o ThemeToggle grava em localStorage "theme" vence; sem ela, vale o
// tema do sistema. É a lógica do script inline do layout da plataforma, em arquivo,
// para o layout não precisar de HTML inline (TEST-03).
(function () {
  var salvo = null;
  try {
    salvo = localStorage.getItem("theme");
  } catch (erro) {
    // Storage bloqueado (cookies desligados): sem escolha legível, segue o sistema.
    console.warn("[central-elite3d] theme-init: localStorage indisponível", erro);
  }
  if (salvo === "dark" || (!salvo && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
})();
