// src/components/charts/LineChartCanvas.jsx
import React, { useEffect, useRef, useState } from 'react';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function LineChartCanvas({ data = [], height = 200, padding = 16 }) {
  const ref = useRef(null);
  const pointsRef = useRef([]);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    setHover(null);

    const series = (Array.isArray(data) ? data : []).map(Number).filter(Number.isFinite);
    const dpr = window.devicePixelRatio || 1;
    const wCss = c.clientWidth || 600;
    const hCss = c.clientHeight || height;

    c.width = Math.floor(wCss * dpr);
    c.height = Math.floor(hCss * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wCss, hCss);
    pointsRef.current = [];

    if (series.length === 0) return;

    const w = wCss - padding * 2;
    const h = hCss - padding * 2;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const nx = (i) => padding + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
    const ny = (v) => padding + h - ((v - min) / (max - min || 1)) * h;

    if (series.length === 1) {
      const x = nx(0);
      const y = ny(series[0]);
      pointsRef.current.push({ x, y, value: series[0] });
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(nx(0), ny(series[0]));
      series.forEach((v, i) => {
        const x = nx(i);
        const y = ny(v);
        ctx.lineTo(x, y);
        pointsRef.current.push({ x, y, value: v, index: i });
      });
      ctx.lineTo(nx(series.length - 1), hCss - padding);
      ctx.lineTo(nx(0), hCss - padding);
      ctx.closePath();
      ctx.fillStyle = '#22c55e22';
      ctx.fill();

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#22c55e';
      ctx.moveTo(nx(0), ny(series[0]));
      series.forEach((v, i) => {
        const x = nx(i);
        const y = ny(v);
        ctx.lineTo(x, y);
        if (!pointsRef.current[i]) pointsRef.current[i] = { x, y, value: v, index: i };
      });
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath();
    ctx.moveTo(padding, hCss - padding);
    ctx.lineTo(wCss - padding, hCss - padding);
    ctx.stroke();
  }, [data, height, padding]);

  const handleMouseMove = (event) => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const points = pointsRef.current;
    if (!points.length) {
      setHover(null);
      return;
    }
    const closest = points.reduce((best, point) => {
      const dist = Math.abs(point.x - x);
      if (!best || dist < best.dist) return { point, dist };
      return best;
    }, null);

    if (closest && closest.dist < 35) {
      setHover({ x: closest.point.x, y: closest.point.y, value: closest.point.value });
    } else {
      setHover(null);
    }
  };

  const handleMouseLeave = () => setHover(null);

  return (
    <div
      className="chart-wrapper"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={ref} />
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y }}>
          {currency.format(hover.value)}
        </div>
      )}
    </div>
  );
}
