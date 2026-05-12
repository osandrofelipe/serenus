/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        cream: { DEFAULT: '#FBF8F3', 2: '#F4EFE6', 3: '#EAE3D6' },
        brown: { DEFAULT: '#3D2B1F', 2: '#6B4C3B', 3: '#A0785A' },
        sage: { DEFAULT: '#4A6741', 2: '#6B8F5E', 3: '#C5D9C0', 4: '#EAF0E8' },
        gold: { DEFAULT: '#C4962A', 2: '#E8B84B' },
      },
    },
  },
  plugins: [],
};
