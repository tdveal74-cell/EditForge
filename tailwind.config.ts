import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A1628",
          900: "#060D1A",
          800: "#0F1C30",
          700: "#16263E",
          600: "#1F3252",
          500: "#2B4066",
        },
        amber: {
          DEFAULT: "#D4A017",
          50: "#FBF3DC",
          600: "#B8890F",
          700: "#96700C",
        },
        surface: {
          DEFAULT: "#F8F5F0",
          muted: "#F0EBE3",
          sunken: "#EDE7DD",
          elevated: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E5DFD5",
          faint: "#EFEAE1",
          strong: "#D4CBBC",
        },
      },
      borderRadius: {
        card: "0.75rem",
        control: "0.5rem",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(10, 22, 40, 0.04), 0 4px 16px rgba(10, 22, 40, 0.05)",
        lifted: "0 2px 4px rgba(10, 22, 40, 0.06), 0 12px 32px rgba(10, 22, 40, 0.10)",
      },
      transitionDuration: {
        swift: "120ms",
        flagship: "180ms",
        stately: "240ms",
      },
      transitionTimingFunction: {
        flagship: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
