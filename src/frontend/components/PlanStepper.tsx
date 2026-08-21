'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function PlanStepper({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="flex items-start w-full mb-8">
      {steps.map((label, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <li key={label} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div
                className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                  i <= activeIndex ? 'bg-amber-500' : 'bg-gray-200'
                }`}
              />
            )}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                done
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : current
                    ? 'bg-white border-amber-500 text-amber-500'
                    : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`mt-2 text-[11px] font-semibold text-center ${current ? 'text-amber-600' : done ? 'text-gray-700' : 'text-gray-400'}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
