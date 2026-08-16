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
        // Dark surfaces (nav, footer, hero) anchored on Marc8's "Base" navy
        // (#000250, 40% brand usage) at gray-900/950 — Tailwind's default
        // "gray" is neutral, not navy-tinted, so this is remapped rather
        // than adding a parallel color nothing would actually use.
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#151541',
          900: '#000250',
          950: '#000138',
        },
        // Marc8 brand retheme: Essence Blue (#183eeb, 25% brand usage) is
        // the site's primary CTA/accent color, anchored at amber-500 (the
        // shade used most throughout the app). Kept the Tailwind key named
        // "amber" rather than renaming every amber-* class across the app —
        // this is the one place the whole site's accent color is defined.
        amber: {
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
        // Marc8's sparing (5% usage) accent — for small highlights (promo
        // badges, urgent states), never as a dominant button/link color.
        marc8accent: '#ff7200',
        // Marc8's warm neutral background (20% usage) — an alternative to
        // plain white for hero/section backgrounds that want some warmth.
        marc8cream: '#f5f2eb',
        // The logo's own dark-espresso-on-cream palette, for splash/loading
        // treatments and other places that intentionally use the mark's
        // literal brand colors rather than the site accent.
        brandcream: '#F3E9D8',
        brandespresso: '#2B1E17',
      },
    },
  },
  plugins: [],
};
