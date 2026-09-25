const base = require("@preorderflow/ui/tailwind.config.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,jsx}",
  ],
};
