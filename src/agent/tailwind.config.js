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
        // Marc8's exact Essence Blue (#183eeb), matching the renter/host
        // app's brand color — anchored at brand-600 since this app's dark
        // (slate-950) surfaces read best with a slightly richer accent than
        // the light-background renter app uses at amber-500.
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
