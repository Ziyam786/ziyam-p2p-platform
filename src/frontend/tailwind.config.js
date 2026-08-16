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
        // Deep Obsidian/Charcoal per the brand spec (#0F172A) — Tailwind's
        // default "gray" is neutral, not blue-tinted, so dark surfaces
        // (nav, footer, hero) didn't match. Remapped to the slate scale,
        // which is anchored on that exact hex at gray-900.
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Brand retheme: matches ziyam.in's live blue/gray identity. Kept the
        // Tailwind key named "amber" rather than renaming every amber-* class
        // across the app — this is the one place the whole site's accent
        // color is defined.
        amber: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
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
