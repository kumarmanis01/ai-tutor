/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        userBubble: "#DCF8C6",  // light green
        aiBubble: "#F1F0F0"     // light gray
      }
    }
  },
  plugins: []
};
