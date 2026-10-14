import type { Config } from "tailwindcss";
import {
  tailwindColors,
  radiusScale,
  elevation,
  motion,
  fontWeight,
} from "./src/design-system/tokens";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: tailwindColors,
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
