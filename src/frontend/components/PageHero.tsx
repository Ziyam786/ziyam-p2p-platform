import React from 'react';

export default function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Optional CTA buttons/content rendered below the subtitle. */
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-gray-950 text-white pt-32 pb-16 text-center px-4">
      <div className="max-w-3xl mx-auto">
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4 block">{eyebrow}</span>
        )}
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4">{title}</h1>
        {subtitle && <p className="text-gray-400 text-lg max-w-xl mx-auto mb-6">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
