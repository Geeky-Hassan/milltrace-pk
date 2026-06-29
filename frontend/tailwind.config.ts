import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f8f8",
          100: "#ecefed",
          200: "#d7ded9",
          500: "#65736b",
          700: "#344139",
          900: "#18231d",
        },
        compliance: {
          green: "#0f8f64",
          amber: "#b7791f",
          red: "#c0392b",
          blue: "#2f6f9f",
        },
      },
      boxShadow: {
        soft: "0 12px 30px rgba(24, 35, 29, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

