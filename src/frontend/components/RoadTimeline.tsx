'use client';

import React, { useMemo } from 'react';

export interface RoadTimelineItem {
  year: string;
  title: string;
  desc: string;
}

const ITEM_HEIGHT = 180;
const ROAD_WIDTH = 90;
const MARKER_SIZE = 22;

function buildRoadPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midY = (p0.y + p1.y) / 2;
    d += ` C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function RoadTimeline({ items }: { items: RoadTimelineItem[] }) {
  const points = useMemo(
    () => items.map((_, i) => ({ x: 20 + (Math.sin(i * 1.15) * 0.5 + 0.5) * (ROAD_WIDTH - 40), y: i * ITEM_HEIGHT + 30 })),
    [items]
  );
  const totalHeight = (items.length - 1) * ITEM_HEIGHT + 60;
  const roadPath = buildRoadPath(points);
  const lastIndex = items.length - 1;

  return (
    <div className="relative flex" style={{ minHeight: totalHeight }}>
      {/* Road */}
      <div className="relative shrink-0" style={{ width: ROAD_WIDTH, height: totalHeight }}>
        <svg width={ROAD_WIDTH} height={totalHeight} className="absolute inset-0">
          <path d={roadPath} stroke="#1e1b1b" strokeWidth="16" fill="none" strokeLinecap="round" />
          <path d={roadPath} stroke="#78350f" strokeWidth="16" fill="none" strokeLinecap="round" opacity="0.35" />
          <path d={roadPath} stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 10" fill="none" strokeLinecap="round" opacity="0.6" />
        </svg>

        {points.map((p, i) => (
          <div
            key={i}
            className={`absolute rounded-full border-4 flex items-center justify-center text-[9px] font-bold ${
              i === lastIndex ? 'bg-amber-500 border-amber-200 text-white' : 'bg-gray-900 border-amber-500 text-amber-400'
            }`}
            style={{ width: MARKER_SIZE, height: MARKER_SIZE, left: p.x - MARKER_SIZE / 2, top: p.y - MARKER_SIZE / 2 }}
          >
            {i === lastIndex ? '🚗' : ''}
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="flex-1 pl-6">
        {items.map((item, i) => (
          <div key={item.year} className="flex items-center" style={{ height: ITEM_HEIGHT }}>
            <div className={`bg-white rounded-2xl border p-5 w-full shadow-sm transition ${i === lastIndex ? 'border-amber-300 shadow-md' : 'border-gray-100'}`}>
              <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full mb-2">
                {item.year}
              </span>
              <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
