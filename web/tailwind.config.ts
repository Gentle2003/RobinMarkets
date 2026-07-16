import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Robinhood-inspired: near-black canvas, lime brand, green/red outcomes.
        canvas: "#0a0b0d",
        surface: "#141619",
        "surface-2": "#1c1f24",
        border: "#282c33",
        lime: {
          DEFAULT: "#c3f53c",
          bright: "#d4ff4d",
          dim: "#9bc22f",
        },
        yes: "#00d179",
        no: "#ff5a5f",
        muted: "#8b929c",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
    },
  },
  plugins: [],
};

export default config;
