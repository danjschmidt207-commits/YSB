import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crust: "#3b2a1a",
        sesame: "#e8c98a",
        poppy: "#2b2b2b",
        board: "#faf6ef",
      },
    },
  },
  plugins: [],
};
export default config;
