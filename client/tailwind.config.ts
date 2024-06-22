import daisyui from "daisyui";
import { THEMES, COLORS } from "./src/constants";

const cssVarByColor = Object.fromEntries(
  Object.entries(COLORS).map(([name, value]) => [name, `var(--${name})`])
);

export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: cssVarByColor,
      fontFamily: {
        title: ["var(--titleFont)", "sans-serif"],
        body: ["var(--bodyFont)", "sans-serif"],
        mono: ["var(--monoFont)", "monospace"],
      },
      container: {
        center: true,
        screens: {
          DEFAULT: "100%", // set the default screen width to 100% of the container
          sm: "640px",
          md: "768px",
          lg: "1024px",
          xl: "1150px",
        },
      },
    },
    variants: {},
    plugins: [daisyui],
    daisyui: {
      base: true,
      themeRoot: ":root",
      themes: ["light", "dark"].map(theme => ({
        [theme]: cssVarByColor,
      })),
    },
  },
};
