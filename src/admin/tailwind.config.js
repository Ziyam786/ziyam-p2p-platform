/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Marc8's Essence Blue (#183eeb, 25% brand usage) — matches the exact
        // ramp used by src/frontend's "amber" key and src/agent's "brand" key
        // so all three apps read as the same product family. This replaces a
        // stale generic Tailwind blue left over from before the Marc8 rebrand.
        brand: {
          50: '#eef1fd',
          100: '#dbe2fb',
          200: '#b8c5f8',
          300: '#8fa3f2',
          400: '#5872ea',
          500: '#183eeb',
          600: '#1230c4',
          700: '#0e259d',
          800: '#0c1e7d',
          900: '#0a1863',
          950: '#060f42',
        },
      },
    },
  },
  plugins: [],
};
