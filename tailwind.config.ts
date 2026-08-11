import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0A1628", 800: "#0F1C30" },
        amber: { DEFAULT: "#D4A017" },
        surface: {
          DEFAULT: "#F8F5F0",
          muted: "#F0EBE3",
          elevated: "#FFFFFF",
        },
        border: { DEFAULT: "#E5DFD5", strong: "#D4CBBC" },
      },
      borderRadius: {
        card: "0.75rem",
        control: "0.5rem",
      },
      transitionDuration: {
        flagship: "180ms",
      },
    },
  },
  plugins: [],
};
export default config;
