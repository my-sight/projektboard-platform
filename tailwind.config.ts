import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", ":root"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/providers/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#38bdf8",
          foreground: "#0f172a",
        },
        danger: {
          DEFAULT: "#f97316",
          foreground: "#1f2937",
        },
      },
      boxShadow: {
        elevated: "0 20px 45px -20px rgba(56, 189, 248, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
