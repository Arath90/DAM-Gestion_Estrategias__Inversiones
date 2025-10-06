import React, { useEffect, useRef } from 'react';

export default function OHLCChartCanvas({ candles = [], height = 240, padding = 16 }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const rows = Array.isArray(candles) ? candles : [];
    const valid = rows.filter(r => ['open','high','low','close'].every(k => Number.isFinite(Number(r[k]))));

    const dpr = window.devicePixelRatio || 1;
    const wCss = c.clientWidth || 600;
    const hCss = height;
    c.width = Math.floor(wCss * dpr);
    c.height = Math.floor(hCss * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wCss, hCss);

    if (valid.length === 0) return;

    const w = wCss - padding * 2;
    const h = hCss - padding * 2;
    const highs = valid.map(x => +x.high), lows = valid.map(x => +x.low);
    const min = Math.min(...lows), max = Math.max(...highs);
    const step = w / (valid.length - 1 || 1);
    const ny = (v) => padding + h - ((v - min) / (max - min || 1)) * h;
    const bar = Math.max(2, Math.floor(step * 0.6));

    valid.forEach((cndl, i) => {
      const x = padding + i * step;
      const o = +cndl.open, cl = +cndl.close;
      const hi = +cndl.high, lo = +cndl.low;
      const up = cl >= o;
      ctx.strokeStyle = up ? '#22c55e' : '#ef4444';
      ctx.fillStyle = up ? '#22c55e' : '#ef4444';

      // Mecha
      ctx.beginPath(); ctx.moveTo(x, ny(lo)); ctx.lineTo(x, ny(hi)); ctx.stroke();

      // Cuerpo
      const y1 = ny(o), y2 = ny(cl);
      const y = Math.min(y1, y2), hBar = Math.max(1, Math.abs(y1 - y2));
      if (hBar < 1.2) { ctx.beginPath(); ctx.moveTo(x - bar/2, y); ctx.lineTo(x + bar/2, y); ctx.stroke(); }
      else { ctx.fillRect(x - bar/2, y, bar, hBar); }
    });

    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.strokeRect(padding-1, padding-1, w+2, h+2);
  }, [candles, height, padding]);

  return <canvas ref={ref} style={{ width: '100%', height }} />;
}
