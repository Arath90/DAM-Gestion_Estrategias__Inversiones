import React from 'react';

export default function TinySparkline({ data = [], height = 40 }) {
  const series = (Array.isArray(data) ? data : []).map(Number).filter(Number.isFinite);
  if (series.length < 2) return <div className="h-10 opacity-40">—</div>;

  const w = 140, h = height;
  const min = Math.min(...series), max = Math.max(...series);
  const ny = (v) => h - ((v - min) / (max - min || 1)) * h;
  const pts = series.map((v, i) => `${(i/(series.length-1))*w},${ny(v)}`).join(' ');

  return (
    <svg width={w} height={h}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} />
    </svg>
  );
}
