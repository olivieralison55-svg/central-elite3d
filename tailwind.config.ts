import type { Config } from "tailwindcss";
import {
  tailwindColors,
  radiusScale,
  elevation,
  motion,
  fontWeight,
} from "./src/design-system/tokens";

// A marca verde da Elite 3D (AD-009): `primary` vira variável com canal alpha, porque o Tailwind 3.4
// descarta em silêncio `bg-primary/20` quando a cor é um `var()` puro. O DS usa `bg-primary/20`, `ring-primary/40`...
const primaria = "rgb(var(--primary-rgb) / <alpha-value>)";
const primariaEscura = "rgb(var(--primary-dark-rgb) / <alpha-value>)";
// Texto, borda, anel e contorno em `primary` ficam sobre o fundo da página: no claro, lima não lê (1,2:1).
const primariaSobreFundo = "rgb(var(--primary-ink-rgb) / <alpha-value>)";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: { ...tailwindColors, primary: primaria, "primary-dark": primariaEscura },
      textColor: { primary: primariaSobreFundo },
      borderColor: { primary: primariaSobreFundo },
      ringColor: { primary: primariaSobreFundo },
      outlineColor: { primary: primariaSobreFundo },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontWeight,
      borderRadius: radiusScale,
      boxShadow: elevation,
      transitionTimingFunction: motion.easing,
      transitionDuration: motion.duration,
    },
  },
  plugins: [],
};

export default config;
