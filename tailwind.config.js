/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@shadcn/ui/dist/**/*.{js,ts,jsx,tsx}"
  ],
  future: {
    disableColorOpacityUtilitiesByDefault: true,
  },
  theme: {
    extend: {
      colors: {
        deepBlue: "#0a2540",
        lightBlue: "#1e3a8a",
        skyBlue: "#3b82f6",
        luxuryGold: "#d4af37",
        deepGold: "#b8860b",
        offWhite: "#f9fafb",
        darkText: "#1f2937",
        darkGray: "#4b5563",
        luxuryGreen: "#10b981",
        luxuryRed: "#f87171",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate")
  ],
};
