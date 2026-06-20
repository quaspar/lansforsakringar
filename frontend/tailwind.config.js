/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0b5cab",
          strong: "#083f78",
        },
        anthropic: "#d97757",
        panel: "#f6f7f9",
        canvas: "#eef0f3",
        ink: {
          DEFAULT: "#16202b",
          soft: "#3a444f",
          muted: "#8a93a0",
          faint: "#9aa2ae",
        },
        line: {
          DEFAULT: "#e7e9ee",
          strong: "#e2e5ea",
          input: "#dfe3e9",
        },
      },
      fontFamily: {
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      keyframes: {
        lfblink: {
          "0%,49%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        lfdot: {
          "0%,80%,100%": { opacity: ".3", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-2px)" },
        },
      },
      animation: {
        lfblink: "lfblink 1s step-end infinite",
        lfdot: "lfdot 1.2s infinite",
      },
    },
  },
  plugins: [],
};
