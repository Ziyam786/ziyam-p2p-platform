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
        // Ziyam brand retheme (superseding the earlier Marc8 navy retheme
        // below this comment used to describe): dark surfaces (nav, footer,
        // hero, and the 800-950 end generally) now anchor on the same
        // espresso tones already used for the About page and the logo
        // badge's plate (#2A2320/#1C1614/#332A26) — kept under the Tailwind
        // key "gray" rather than renaming every gray-* class across the
        // app, same reasoning the prior Marc8 retheme used. 50-300 stay a
        // warmed-neutral (cream-tinted, not cold blue-gray) for ordinary
        // light-background text/borders; 400/700 line up exactly with the
        // "muted"/"rule" tokens from globals.css and companyInfo-adjacent
        // brand work.
        gray: {
          50: '#faf8f5',
          100: '#f3eee8',
          200: '#e5ddd2',
          300: '#c9beb0',
          400: '#96887a',
          500: '#7a6d60',
          600: '#5c5148',
          700: '#463c36',
          800: '#332a26',
          900: '#2a2320',
          950: '#1c1614',
        },
        // Ziyam brand retheme, corrected: green (originally used for the
        // primary CTA/accent) was dropped in favor of Eightlines' own
        // brand gold — Zoomcar's brand color is also green, and reusing it
        // risked exactly that kind of market confusion. This ramp is built
        // around the actual gold gradient stops from the extracted
        // Eightlines mark (public/emblems/eightlines-plate.svg's "gold"/
        // "goldRing" gradients): #C4922C anchors 500, #A8761F anchors 600 —
        // both lifted verbatim from that artwork rather than picked fresh,
        // so the site accent stays traceable to the real logo. Still under
        // the "amber" key so every existing amber-* call site repaints
        // automatically.
        amber: {
          50: '#fbf3e0',
          100: '#f6e6c1',
          200: '#edcb83',
          300: '#e0ad53',
          400: '#d2963a',
          500: '#c4922c',
          600: '#a8761f',
          700: '#8a5f19',
          800: '#6b4a14',
          900: '#4d350f',
          950: '#2e1f09',
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
