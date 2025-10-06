import React, { useEffect, useRef } from 'react';

export default function LineChartCanvas({ data = [], height = 200, padding = 16 }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const series = (Array.isArray(data) ? data : []).map(Number).filter(Number.isFinite);
    const dpr = window.devicePixelRatio || 1;
    const wCss = c.clientWidth || 600;
    const hCss = height;

    c.width = Math.floor(wCss * dpr);
    c.height = Math.floor(hCss * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wCss, hCss);

    if (series.length < 2) return;

    const w = wCss - padding * 2;
    const h = hCss - padding * 2;
    const min = Math.min(...series), max = Math.max(...series);
    const nx = (i) => padding + (i / (series.length - 1)) * w;
    const ny = (v) => padding + h - ((v - min) / (max - min || 1)) * h;

    // Área
    ctx.beginPath();
    ctx.moveTo(nx(0), ny(series[0]));
    series.forEach((v, i) => ctx.lineTo(nx(i), ny(v)));
    ctx.lineTo(nx(series.length - 1), hCss - padding);
    ctx.lineTo(nx(0), hCss - padding);
    ctx.closePath();
    ctx.fillStyle = '#22c55e22';
    ctx.fill();

    // Línea
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22c55e';
    ctx.moveTo(nx(0), ny(series[0]));
    series.forEach((v, i) => ctx.lineTo(nx(i), ny(v)));
    ctx.stroke();

    // Base
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.moveTo(padding, hCss - padding); ctx.lineTo(wCss - padding, hCss - padding); ctx.stroke();
  }, [data, height, padding]);

  return <canvas ref={ref} style={{ width: '100%', height }} />;
}
