import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        card: "var(--card)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-contrast": "var(--accent-contrast)",
        success: "#3E6B51",
        warning: "#A4662C",
        danger: "#A63B33"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"]
      },
      boxShadow: {
        divider: "0 0 0 1px var(--line)"
      },
      borderRadius: {
        editorial: "1.75rem"
      }
    },
  },
  plugins: [],
};

export default config;
