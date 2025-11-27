import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

// Helper para logging seguro
const safeLog = (level, message, error = null) => {
  const errorMsg = error?.message || error?.toString() || 'Error desconocido';
  console[level](message, error ? errorMsg : '');
};

/**
 * Bridge hook entre analytics (useMarketData) y la UI (Mercado.jsx).
 *
 * Objetivo pedagogico:
 *  - Mostrar como desacoplar la logica de charts del componente de pagina.
 *  - Detallar la interaccion con Lightweight Charts (creacion, actualizacion y limpieza).
 *
 * Que aporta:
 *  - Instancia los objetos Lightweight Charts y mantiene la data sincronizada con React.
 *  - Renderiza overlays (EMA, SMA), paneles secundarios (RSI/MACD) y marcadores de senales.
 *  - Garantiza cleanup/resize para prevenir fugas cuando se cambia de seccion.
 *
 *  
 *  para facilitar comparaciones temporales cuando el usuario hace zoom o pan.
 */

const BASE_CHART_OPTIONS = {
  layout: {
    background: { color: '#0f172a' },
    textColor: '#e2e8f0',
    fontFamily: 'var(--project-font)',
  },
  rightPriceScale: { borderVisible: true },
  timeScale: { borderVisible: true, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  grid: {
    horzLines: { color: '#1e293b' },
    vertLines: { color: '#1e293b' },
  },
};

const RSI_CHART_OPTIONS = {
  layout: {
    background: { color: '#101b33' },
    textColor: '#e2e8f0',
    fontFamily: 'var(--project-font)',
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  grid: {
    horzLines: { color: '#1e293b' },
    vertLines: { color: '#1e293b' },
  },
};

const MACD_CHART_OPTIONS = {
  layout: {
    background: { color: '#111d34' },
    textColor: '#e2e8f0',
    fontFamily: 'var(--project-font)',
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.15, bottom: 0.15 },
  },
  timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  grid: {
    horzLines: { color: '#1e293b' },
    vertLines: { color: '#1e293b' },
  },
};

const mapVolumeHistogram = (seriesRef, candles) => {
  if (!seriesRef.current || !Array.isArray(candles)) return;
  try {
    const volumeData = candles
      .filter(candle => candle && typeof candle.time === 'number' && typeof candle.volume === 'number')
      .map((candle) => ({
        time: candle.time,
        value: candle.volume ?? 0,
        color: candle.close >= candle.open ? '#47d16c88' : '#ff6b6b88',
      }));
    seriesRef.current.setData(volumeData);
  } catch (e) {
    console.debug('[Volume] Error estableciendo histograma de volumen:', e.message);
  }
};

const mapMacdHistogram = (seriesRef, histogram) => {
  if (!seriesRef.current || !Array.isArray(histogram)) return;
  try {
    const histogramData = histogram
      .filter(point => point && typeof point.time === 'number' && typeof point.value === 'number')
      .map((point) => ({
        time: point.time,
        value: point.value,
        color: point.value >= 0 ? '#22d3ee55' : '#ef444455',
      }));
    seriesRef.current.setData(histogramData);
  } catch (e) {
    console.debug('[MACD] Error estableciendo histograma MACD:', e.message);
  }
};

const resetSeries = (...seriesRefs) => {
  seriesRefs.forEach((ref) => {
    try {
      if (ref.current && typeof ref.current.setData === 'function') {
        ref.current.setData([]);
      }
    } catch (e) {
      console.debug('[Reset] Error reseteando serie:', e.message);
    }
  });
};

// De una lista de divergencias, conserva solo la más fuerte por ancla (p1Index)
// y opcionalmente filtra por score mínimo.
const collapseDivergencesByAnchor = (
  divs = [],
  { minScore = 0, maxPerType = 100 } = {},
) => {
  if (!Array.isArray(divs) || !divs.length) return [];

  const byAnchor = new Map();

  for (const d of divs) {
    if (!d) continue;
    const score = Number(d.score ?? 0);
    if (!Number.isFinite(score) || score < minScore) continue;

    const key = `${d.type}-${d.p1Index}`;
    const prev = byAnchor.get(key);

    // Nos quedamos con la de mayor score para cada (tipo, p1Index)
    if (!prev || score > Number(prev.score ?? 0)) {
      byAnchor.set(key, d);
    }
  }

  const collapsed = Array.from(byAnchor.values());

  // Ordenamos por índice de inicio para que el render sea estable
  collapsed.sort((a, b) => (a.p1Index ?? 0) - (b.p1Index ?? 0));

  // Protección por si en algún momento se llena demasiado
  if (collapsed.length > maxPerType) {
    return collapsed.slice(-maxPerType);
  }

  return collapsed;
};

export const useMarketCharts = ({
  candles,
  ema20,
  ema50,
  rsi14,
  sma200,
  macdLine,
  macdSignal,
  macdHistogram,
  signals,
  divergences,
  settings,
  bbMiddle = [],
  bbUpper = [],
  bbLower = [],
}) => {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);

  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);
  const macdChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const sma200SeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const macdSeriesRef = useRef(null);
  const macdSignalSeriesRef = useRef(null);
  const macdHistogramSeriesRef = useRef(null);

  const divergenceLineSeriesRefs = useRef([]);
  const rsiDivergenceMarkersRef = useRef([]);
  const rsiTrendLineRefs = useRef([]);
  const divergenceRsiLineRefs = useRef([]);
  //Codigo agregado por Andrick y chat
  const syncingRef = useRef(false);
  const maxLineSeriesRef = useRef(null);
  const minLineSeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);

  //Nuevo codigo de Andrick y chat
    // Convierte tus signals (desde useMarketData) en markers compatibles con lightweight-charts
  const buildSignalMarkers = (signals) => {
    // signals: [{ time, action: 'BUY'|'SELL', reasons, price, timeIndex }]
    if (!Array.isArray(signals)) return [];
    try {
      return signals
        .filter(s => s && typeof s.time === 'number' && (s.action === 'BUY' || s.action === 'SELL'))
        .map(s => ({
          time: s.time,
          position: s.action === 'BUY' ? 'belowBar' : 'aboveBar',
          color: s.action === 'BUY' ? '#16a34a' : '#ef4444',
          shape: s.action === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: s.action === 'BUY' ? 'Compra' : 'Venta'
        }));
    } catch (e) {
      safeLog('debug', '[Signals] Error construyendo marcadores:', e);
      return [];
    }
  };

  // Renderiza lineas punteadas (divergencias) en el chart principal y marcadores en el RSI.
  const renderDivergences = (divergences = [], candles = [], rsiSeriesData = []) => {
    // 1) Limpieza de series y markers previos
    try {
      if (divergenceLineSeriesRefs.current?.length) {
        divergenceLineSeriesRefs.current.forEach((s) => {
          try { s.remove(); } catch (e) {}
        });
        divergenceLineSeriesRefs.current = [];
      }
      if (divergenceRsiLineRefs.current?.length) {
        divergenceRsiLineRefs.current.forEach((s) => {
          try { s.remove(); } catch (e) {}
        });
        divergenceRsiLineRefs.current = [];
      }
      if (rsiSeriesRef.current) {
        try { rsiSeriesRef.current.setMarkers([]); } catch (e) {}
        rsiDivergenceMarkersRef.current = [];
      }
    } catch (e) {
      console.debug('[DIV] Error limpiando series de divergencias:', e?.message || e);
    }

    if (!Array.isArray(divergences) || !divergences.length) return;
    if (!Array.isArray(candles) || !candles.length) return;

    const total = candles.length;
    const rsiByTime = new Map((rsiSeriesData || []).map((p) => [p.time, p.value]));

    // 2) Quedarnos solo con la divergencia más fuerte por ancla (p1Index) y filtrar ruido
    const effectiveDivs = collapseDivergencesByAnchor(divergences, {
      minScore: 0.03,
      maxPerType: 100,
    });

    const seenPairs = new Set();
    const allMarkers = [];

    effectiveDivs.forEach((d) => {
      if (!d) return;

      // 3) Esperar confirmación: no usar divergencias cuya segunda pata sea la última vela
      if (typeof d.p2Index !== 'number' || d.p2Index >= total - 1) {
        return;
      }

      const p1 = candles[d.p1Index];
      const p2 = candles[d.p2Index];
      if (!p1 || !p2) return;

      const pairKey = `${d.type}-${d.p1Index}-${d.p2Index}-${d.r1Index ?? 'x'}-${d.r2Index ?? 'x'}`;
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);

      // --- LÍNEA EN PRECIO (blanca sólida) ---
      if (chartRef.current) {
        try {
          const ls = chartRef.current.addLineSeries({
            color: '#ffffff',
            lineWidth: 2,
            lineStyle: 0,
            priceLineVisible: false,
          });
          ls.setData(
            [
              { time: p1.time, value: p1.high ?? p1.close },
              { time: p2.time, value: p2.high ?? p2.close },
            ].sort((a, b) => a.time - b.time),
          );
          divergenceLineSeriesRefs.current.push(ls);
        } catch (e) {
          console.debug('[DIV] Error dibujando línea de precio:', e?.message || e);
        }
      }

      // --- MARCADORES EN RSI ---
      if (rsiSeriesRef.current && (d.r1Index != null || d.r2Index != null)) {
        const label = d.type === 'bullish' ? 'Bull' : 'Bear';
        if (d.r1Index != null && candles[d.r1Index]) {
          allMarkers.push({
            time: candles[d.r1Index].time,
            position: 'aboveBar',
            color: '#f59e0b',
            shape: 'circle',
            text: label,
          });
        }
        if (d.r2Index != null && candles[d.r2Index]) {
          allMarkers.push({
            time: candles[d.r2Index].time,
            position: 'aboveBar',
            color: '#f59e0b',
            shape: 'circle',
            text: label,
          });
        }
      }

      // --- LÍNEA EN RSI ---
      if (
        d.r1Index != null && d.r2Index != null &&
        rsiChartRef.current &&
        candles[d.r1Index] &&
        candles[d.r2Index]
      ) {
        const t1 = candles[d.r1Index].time;
        const t2 = candles[d.r2Index].time;
        const v1 = rsiByTime.get(t1);
        const v2 = rsiByTime.get(t2);

        if (typeof v1 === 'number' && typeof v2 === 'number') {
          try {
            const lsRsi = rsiChartRef.current.addLineSeries({
              color: '#ffffff',
              lineWidth: 2,
              lineStyle: 0,
              priceLineVisible: false,
            });
            lsRsi.setData(
              [
                { time: t1, value: v1 },
                { time: t2, value: v2 },
              ].sort((a, b) => a.time - b.time),
            );
            divergenceRsiLineRefs.current.push(lsRsi);
          } catch (e) {
            console.debug('[DIV] Error dibujando línea RSI:', e?.message || e);
          }
        }
      }
    });

    // 4) Aplicar markers ordenados por tiempo
    if (rsiSeriesRef.current && allMarkers.length) {
      try {
        allMarkers.sort((a, b) => a.time - b.time);
        rsiSeriesRef.current.setMarkers(allMarkers);
        rsiDivergenceMarkersRef.current = allMarkers;
      } catch (e) {
        console.debug('[DIV] setMarkers failed:', e?.message || e);
      }
    }
  };

// ----------------- Helpers para detectar picos reales (crestas) -----------------
// Detecta picos locales en el array de highs y devuelve [{ index, value }]
function findLocalHighPeaks(highs = [], windowSize = 3, minDistance = 4) {
  const n = highs.length;
  if (!n) return [];
  const peaks = [];
  for (let i = windowSize; i < n - windowSize; i++) {
    const val = highs[i];
    if (!Number.isFinite(val)) continue;
    let isPeak = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      const other = highs[j];
      if (!Number.isFinite(other) || other >= val) { isPeak = false; break; }
    }
    if (isPeak) peaks.push({ index: i, value: val });
  }
  // filtrar picos demasiado cercanos (conservar el mayor)
  const filtered = [];
  for (const p of peaks) {
    if (!filtered.length) { filtered.push(p); continue; }
    const last = filtered[filtered.length - 1];
    if (p.index - last.index < minDistance) {
      if (p.value > last.value) filtered[filtered.length - 1] = p;
    } else filtered.push(p);
  }
  return filtered;
}

// Construye líneas de resistencia a partir de picos (dos crestas reales)
function buildResistancesFromHighPeaks(candles = [], opts = {}) {
  const highs = candles.map(c => c.high);
  const peakWindow = opts.peakWindow || 3;
  const minDistance = opts.minDistance || 6;
  const maxPairs = opts.maxPairs || 6;

  const peaks = findLocalHighPeaks(highs, peakWindow, minDistance);
  const lines = [];
  for (let a = 0; a < peaks.length - 1 && lines.length < maxPairs; a++) {
    for (let b = a + 1; b < peaks.length && lines.length < maxPairs; b++) {
      const p1 = peaks[a];
      const p2 = peaks[b];
      if (!p1 || !p2) continue;
      // crear linea usando las crestas reales (highs de las velas)
      const t1 = candles[p1.index].time;
      const t2 = candles[p2.index].time;
      const v1 = p1.value; // crest real
      const v2 = p2.value;
      // función lineal simple para evaluaciones posteriores (breakouts)
      const func = (t) => {
        if (t2 === t1) return v1;
        const m = (v2 - v1) / (t2 - t1);
        return v1 + m * (t - t1);
      };

      lines.push({ type: 'resistance', p1Index: p1.index, p2Index: p2.index, startTime: t1, endTime: t2, startValue: v1, endValue: v2, func });
    }
  }
  return lines;
}

// ----------------- useEffect: dibujar resistencias usando crestas reales (highs) -----------------
useEffect(() => {
  // habilitar via settings: settings.trendlines === true
  if (!chartRef.current || !Array.isArray(candles) || candles.length === 0) return;
  if (!settings || !settings.trendlines) {
    // limpiar cualquier series anteriores si existieran
    if (divergenceLineSeriesRefs.current && divergenceLineSeriesRefs.current.length) {
      divergenceLineSeriesRefs.current.forEach(s => { try { s.remove(); } catch (e) {} });
      divergenceLineSeriesRefs.current = [];
    }
    return;
  }

  // parámetros (ajustables desde settings si quieres)
  const peakWindow = (settings.peakWindow && Number(settings.peakWindow)) || 3;
  const minDistance = (settings.minPeakDistance && Number(settings.minPeakDistance)) || 6;
  const maxPairs = (settings.maxTrendlinePairs && Number(settings.maxTrendlinePairs)) || 6;

  // construir resistencias a partir de highs reales
  const resistances = buildResistancesFromHighPeaks(candles, { peakWindow, minDistance, maxPairs });

  // limpiar series previas (reusar divergenceLineSeriesRefs para tendencia simple)
  if (divergenceLineSeriesRefs.current && divergenceLineSeriesRefs.current.length) {
    divergenceLineSeriesRefs.current.forEach(s => { try { s.remove(); } catch (e) {} });
    divergenceLineSeriesRefs.current = [];
  }

  // dibujar cada linea usando los HIGH reales de las velas (no valores intermedios)
  resistances.forEach((ln) => {
    try {
      const p1 = candles[ln.p1Index];
      const p2 = candles[ln.p2Index];
      if (!p1 || !p2) return;
      const ls = chartRef.current.addLineSeries({ color: 'rgba(220,38,38,0.9)', lineWidth: 2, lineStyle: 2, priceLineVisible: false });
      ls.setData([
        { time: p1.time, value: p1.high },
        { time: p2.time, value: p2.high },
      ]);
      // almacenar para cleanup
      divergenceLineSeriesRefs.current.push(ls);
    } catch (e) {
      console.debug('[TrendRes] error dibujando resistencia:', e?.message || e);
    }
  });

  // cleanup al desmontar o cuando cambien candles/settings
  return () => {
    if (divergenceLineSeriesRefs.current && divergenceLineSeriesRefs.current.length) {
      divergenceLineSeriesRefs.current.forEach(s => { try { s.remove(); } catch (e) {} });
      divergenceLineSeriesRefs.current = [];
    }
  };

}, [candles, settings && settings.trendlines, settings && settings.peakWindow, settings && settings.minPeakDistance, settings && settings.maxTrendlinePairs]);

// ----------------- Helpers RSI: detectar valles locales (mínimos) -----------------
function findLocalLowPeaks(values = [], windowSize = 3, minDistance = 4) {
  const n = values.length;
  if (!n) return [];
  const troughs = [];
  for (let i = windowSize; i < n - windowSize; i++) {
    const val = values[i];
    if (!Number.isFinite(val)) continue;
    let isTrough = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      const other = values[j];
      if (!Number.isFinite(other) || other <= val) { isTrough = false; break; }
    }
    if (isTrough) troughs.push({ index: i, value: val });
  }
  // Filtrar valles demasiado cercanos (conservar el más bajo)
  const filtered = [];
  for (const p of troughs) {
    if (!filtered.length) { filtered.push(p); continue; }
    const last = filtered[filtered.length - 1];
    if (p.index - last.index < minDistance) {
      if (p.value < last.value) filtered[filtered.length - 1] = p;
    } else filtered.push(p);
  }
  return filtered;
}

// ----------------- useEffect: dibujar diagonales blancas en el panel RSI (opcion C - truncado y etiqueta) -----------------
useEffect(() => {
  // Requisitos: rsiChartRef y rsiSeriesRef deben existir y rsi14 tener datos
  if (!rsiChartRef.current || !rsiSeriesRef.current || !Array.isArray(rsi14) || rsi14.length === 0) return;
  if (!Array.isArray(candles) || candles.length === 0) return;

  // parámetros ajustables desde settings
  const peakWindow = (settings && Number(settings.rsiPeakWindow)) || 3;
  const minDistance = (settings && Number(settings.rsiMinPeakDistance)) || 6;
  const maxLines = (settings && Number(settings.rsiMaxTrendLines)) || 2;
  const highFilter = (settings && Number(settings.rsiHighFilter)) || 70; // para máximos relevantes
  const lowFilter = (settings && Number(settings.rsiLowFilter)) || 30;   // para mínimos relevantes
  const forwardWindow = (settings && Number(settings.rsiForwardWindow)) || 100; // barras a buscar ruptura
  const breakoutTolerance = (settings && Number(settings.rsiBreakoutTolerance)) || 0.002; // tolerancia relativa
  const requireConfirmationCandles = (settings && Number(settings.rsiConfirmationCandles)) || 1; // cuantas velas confirman ruptura
  const allowWickBreak = (settings && typeof settings.allowWickBreak === 'boolean') ? settings.allowWickBreak : true;

  // preparar array simple de valores RSI alineado con candles
  const values = rsi14.map(p => (p && typeof p === 'object' ? p.value : p));

  // detectar máximos y mínimos locales en el RSI
  const rsiHighs = findLocalHighPeaks(values, peakWindow, minDistance); // devuelve {index, value}
  const rsiLows = findLocalLowPeaks(values, peakWindow, minDistance);

  // convertir índices a puntos { time, value }
  const rsiPoints = rsi14.map(p => ({ time: p.time, value: p.value }));
  const candidateHighs = rsiHighs.map(p => ({ index: p.index, time: rsiPoints[p.index]?.time, value: p.value })).filter(p => p.time != null && p.value != null && p.value >= highFilter);
  const candidateLows = rsiLows.map(p => ({ index: p.index, time: rsiPoints[p.index]?.time, value: p.value })).filter(p => p.time != null && p.value != null && p.value <= lowFilter);

  // limpiar series previas
  if (rsiTrendLineRefs.current && rsiTrendLineRefs.current.length) {
    rsiTrendLineRefs.current.forEach(s => { try { s.remove(); } catch (e) {} });
    rsiTrendLineRefs.current = [];
  }

  // limpiar marcadores RSI previos (mantener marcadores de divergencias si existen)
  try {
    if (rsiSeriesRef.current) {
      // No borrar markers de divergencias que establece renderDivergences; solo agregaremos nuevos markers al final
      const existing = rsiSeriesRef.current.getMarkers ? rsiSeriesRef.current.getMarkers() : (rsiDivergenceMarkersRef.current || []);
      rsiDivergenceMarkersRef.current = existing || [];
    }
  } catch (e) {
    // ignore
  }

  // Helper: crear linea entre dos puntos en RSI y (opcional) truncarla hasta breakIndex
  const drawTruncatedRSILine = (p1, p2, breakIndex, label) => {
    try {
      let p2Point = p2;
      if (typeof breakIndex === 'number' && rsiPoints[breakIndex]) {
        p2Point = { index: breakIndex, time: rsiPoints[breakIndex].time, value: rsiPoints[breakIndex].value };
      }

      const ls = rsiChartRef.current.addLineSeries({ color: '#ffffff', lineWidth: 3, priceLineVisible: false });
      ls.setData([
        { time: p1.time, value: p1.value },
        { time: p2Point.time, value: p2Point.value },
      ]);
      rsiTrendLineRefs.current.push(ls);

      // agregar marker/etiqueta en punto de ruptura si existe
      if (typeof breakIndex === 'number' && rsiPoints[breakIndex]) {
        try {
          const marker = { time: rsiPoints[breakIndex].time, position: 'aboveBar', color: '#ffffff', shape: 'square', text: label };
          const prev = rsiSeriesRef.current.getMarkers ? rsiSeriesRef.current.getMarkers() : [];
          const merged = (prev || []).concat([marker]);
          rsiSeriesRef.current.setMarkers(merged);
          // mantener en memoria para limpieza si es necesario
          rsiDivergenceMarkersRef.current = merged;
        } catch (e) { console.debug('[RSItrend] set marker error', e?.message || e); }
      }

    } catch (e) {
      console.debug('[RSItrend] error dibujando linea truncada', e?.message || e);
    }
  };

  // función para evaluar precio en la línea definida por dos picos de price (usando highs/low reales de candles)
  const lineFuncFromPricePeaks = (pIdx1, pIdx2) => {
    const c1 = candles[pIdx1];
    const c2 = candles[pIdx2];
    if (!c1 || !c2) return null;
    const t1 = c1.time;
    const t2 = c2.time;
    const v1 = c1.high; // usar high para resistencias
    const v2 = c2.high;
    if (t2 === t1) return (t) => v1;
    const m = (v2 - v1) / (t2 - t1);
    return (t) => v1 + m * (t - t1);
  };

  // Buscar ruptura en precio: para resistencia (candidateHighs) buscamos vela roja que cierre por debajo de la linea de precio
  const findBreakoutIndexForResistance = (pIdx1, pIdx2) => {
    const func = lineFuncFromPricePeaks(pIdx1, pIdx2);
    if (!func) return null;
    const start = Math.max(pIdx2 + 1, pIdx1 + 1);
    const limit = Math.min(candles.length, start + forwardWindow);
    for (let k = start; k < limit; k++) {
      const c = candles[k];
      if (!c) continue;
      const priceOnLine = func(c.time);
      if (typeof priceOnLine !== 'number' || !isFinite(priceOnLine)) continue;
      const tol = Math.abs(priceOnLine) * breakoutTolerance;
      const closeBreak = (c.close < priceOnLine - tol && c.close < c.open); // vela roja que cierre por debajo
      const wickBreak = (allowWickBreak && c.low < priceOnLine + tol);
      if (closeBreak || wickBreak) {
        // confirmar si se piden varias velas de confirmacion
        if (requireConfirmationCandles <= 1) return k;
        let ok = true;
        for (let s = 0; s < requireConfirmationCandles; s++) {
          const idx = k + s;
          if (idx >= candles.length) { ok = false; break; }
          const cc = candles[idx];
          const pOn = func(cc.time);
          if (!(cc && typeof pOn === 'number' && cc.close < pOn - tol)) { ok = false; break; }
        }
        if (ok) return k;
      }
    }
    return null;
  };

  // Para soportes (candidateLows) buscamos vela verde que cierre por encima de la linea de precio
  const findBreakoutIndexForSupport = (pIdx1, pIdx2) => {
    const func = lineFuncFromPricePeaks(pIdx1, pIdx2); // reuse but will use lows if needed; we will use lows p1/p2
    if (!func) return null;
    const start = Math.max(pIdx2 + 1, pIdx1 + 1);
    const limit = Math.min(candles.length, start + forwardWindow);
    for (let k = start; k < limit; k++) {
      const c = candles[k];
      if (!c) continue;
      const priceOnLine = func(c.time);
      if (typeof priceOnLine !== 'number' || !isFinite(priceOnLine)) continue;
      const tol = Math.abs(priceOnLine) * breakoutTolerance;
      const closeBreak = (c.close > priceOnLine + tol && c.close > c.open); // vela verde que cierre por encima
      const wickBreak = (allowWickBreak && c.high > priceOnLine - tol);
      if (closeBreak || wickBreak) {
        if (requireConfirmationCandles <= 1) return k;
        let ok = true;
        for (let s = 0; s < requireConfirmationCandles; s++) {
          const idx = k + s;
          if (idx >= candles.length) { ok = false; break; }
          const cc = candles[idx];
          const pOn = func(cc.time);
          if (!(cc && typeof pOn === 'number' && cc.close > pOn + tol)) { ok = false; break; }
        }
        if (ok) return k;
      }
    }
    return null;
  };

  // Dibujar diagonales truncadas en RSI solo si existe ruptura en el precio posterior
  try {
    // Resistencias (divergencia bajista): usar candidateHighs; p1 = earlier, p2 = later
    if (candidateHighs.length >= 2) {
      // iterar pares de los 2 últimos (más reciente)
      const lastTwo = candidateHighs.slice(-2);
      const p1 = lastTwo[0];
      const p2 = lastTwo[1];
      // encontrar indices de candles asociados
      const p1Idx = p1.index;
      const p2Idx = p2.index;
      // buscar ruptura en precio usando las crestas reales (highs)
      const breakoutIdx = findBreakoutIndexForResistance(p1Idx, p2Idx);
      if (breakoutIdx != null) {
        // dibujar RSI desde p1 hasta el RSI en breakoutIdx
        drawTruncatedRSILine(p1, p2, breakoutIdx, 'Venta');
        // opcional: dibujar pequeña linea blanca en precio (truncada) para ayudar a ver ruptura
        try {
          const func = lineFuncFromPricePeaks(p1Idx, p2Idx);
          if (func && chartRef.current) {
            const startTime = candles[p1Idx].time;
            const breakTime = candles[breakoutIdx].time;
            const startVal = candles[p1Idx].high;
            const breakVal = func(breakTime);
            const ls = chartRef.current.addLineSeries({ color: '#ffffff', lineWidth: 3, priceLineVisible: false });
            ls.setData([{ time: startTime, value: startVal }, { time: breakTime, value: breakVal }]);
            divergenceLineSeriesRefs.current.push(ls);
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Soportes (divergencia alcista): usar candidateLows
    if (candidateLows.length >= 2) {
      const lastTwo = candidateLows.slice(-2);
      const p1 = lastTwo[0];
      const p2 = lastTwo[1];
      const p1Idx = p1.index;
      const p2Idx = p2.index;
      const breakoutIdx = findBreakoutIndexForSupport(p1Idx, p2Idx);
      if (breakoutIdx != null) {
        drawTruncatedRSILine(p1, p2, breakoutIdx, 'Compra');
        try {
          const func = lineFuncFromPricePeaks(p1Idx, p2Idx);
          if (func && chartRef.current) {
            const startTime = candles[p1Idx].time;
            const breakTime = candles[breakoutIdx].time;
            const startVal = candles[p1Idx].low; // para soporte usar low
            const breakVal = func(breakTime);
            const ls = chartRef.current.addLineSeries({ color: '#ffffff', lineWidth: 3, priceLineVisible: false });
            ls.setData([{ time: startTime, value: startVal }, { time: breakTime, value: breakVal }]);
            divergenceLineSeriesRefs.current.push(ls);
          }
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    console.debug('[RSItrend] error main drawing', e?.message || e);
  }

  // cleanup
  return () => {
    if (rsiTrendLineRefs.current && rsiTrendLineRefs.current.length) {
      rsiTrendLineRefs.current.forEach(s => { try { s.remove(); } catch (e) {} });
      rsiTrendLineRefs.current = [];
    }
    // no remover marcadores de divergencias originales; solo limpiar los que agregamos
    try {
      if (rsiSeriesRef.current && rsiDivergenceMarkersRef.current) {
        rsiSeriesRef.current.setMarkers(rsiDivergenceMarkersRef.current || []);
      }
    } catch (e) {}
  };

}, [rsi14, candles, settings && settings.rsi, settings && settings.rsiPeakWindow, settings && settings.rsiMinPeakDistance, settings && settings.rsiHighFilter, settings && settings.rsiLowFilter, settings && settings.rsiForwardWindow]);

  const syncRsiRange = (series = []) => {
    try {
      if (!rsiSeriesRef.current) return;
      const vals = (series || []).map((p) => p?.value).filter((v) => Number.isFinite(v));
      if (!vals.length) return;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      if (!Number.isFinite(min) || !Number.isFinite(max)) return;
      const lower = Math.min(0, min - 5);
      const upper = Math.max(100, max + 5);
      const scale = rsiSeriesRef.current.priceScale();
      if (scale) {
        scale.applyOptions({ autoScale: false, scaleMargins: { top: 0.1, bottom: 0.1 } });
        scale.setPriceRange({ min: lower, max: upper });
      }
    } catch (e) {
      console.log('[RSI] Error sincronizando rango:', e?.message || e);
    }
  };

  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);

    if (!maxLineSeriesRef.current) {
      maxLineSeriesRef.current = chartRef.current.addLineSeries({
        color: '#ffea00',
        lineWidth: 1,
        lineStyle: 0,
        priceLineVisible: false,
      });
    }
    maxLineSeriesRef.current.setData([
      { time: candles[0].time, value: maxPrice },
      { time: candles[candles.length - 1].time, value: maxPrice },
    ]);

    if (!minLineSeriesRef.current) {
      minLineSeriesRef.current = chartRef.current.addLineSeries({
        color: '#ffea00',
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
      });
    }
    minLineSeriesRef.current.setData([
      { time: candles[0].time, value: minPrice },
      { time: candles[candles.length - 1].time, value: minPrice },
    ]);

  }, [candles]);

  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const chart = createChart(chartContainerRef.current, BASE_CHART_OPTIONS);
    chartRef.current = chart;

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#47d16c',
      downColor: '#ff6b6b',
      borderUpColor: '#47d16c',
      borderDownColor: '#ff6b6b',
      wickUpColor: '#47d16c',
      wickDownColor: '#ff6b6b',
    });

    volumeSeriesRef.current = chart.addHistogramSeries({
      priceScaleId: '',
      priceFormat: { type: 'volume' },
      baseValue: { type: 'price', price: 0 },
      scaleMargins: { top: 0.8, bottom: 0 },
      color: '#4f46e5aa',
    });

    ema20SeriesRef.current = chart.addLineSeries({ color: '#22d3ee', lineWidth: 2, title: 'EMA 20' });
    ema50SeriesRef.current = chart.addLineSeries({ color: '#facc15', lineWidth: 2, title: 'EMA 50' });
    sma200SeriesRef.current = chart.addLineSeries({ color: '#c084fc', lineWidth: 2, title: 'SMA 200' });

    bbUpperSeriesRef.current = chart.addLineSeries({
      color: '#f59e0b', // amarillo tenue
      lineWidth: 1,
      lineStyle: 2, // dashed
      title: 'BB Upper',
    });
    bbMiddleSeriesRef.current = chart.addLineSeries({
      color: '#ffffff', // media (puedes ajustar opacity vía CSS si quieres)
      lineWidth: 1,
      lineStyle: 0,
      title: 'BB Middle',
    });
    bbLowerSeriesRef.current = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: 2,
      title: 'BB Lower',
    });

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      const { width } = chartContainerRef.current.getBoundingClientRect();
      chart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Observer para detectar cambios en el tamaño del contenedor (ej: sidebar collapse)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      sma200SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!settings.rsi) return;
    if (!rsiContainerRef.current || rsiChartRef.current) return;

    // Panel RSI: se crea dinamicamente segun la preferencia del usuario para ahorrar recursos.
    const rsiChart = createChart(rsiContainerRef.current, RSI_CHART_OPTIONS);
    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiChart.addLineSeries({ color: '#94a3b8', lineWidth: 2 });
    rsiSeriesRef.current.createPriceLine({
      price: 70,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 0,
      axisLabelVisible: false,
    });
    rsiSeriesRef.current.createPriceLine({
      price: 30,
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 0,
      axisLabelVisible: false,
    });

    const handleResize = () => {
      if (!rsiContainerRef.current) return;
      const { width } = rsiContainerRef.current.getBoundingClientRect();
      rsiChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Observer para detectar cambios en el tamaño del contenedor
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(rsiContainerRef.current);

    // Sincronizar la escala de tiempo con el gráfico principal
    if (chartRef.current) {
      const syncRange = () => {
        if (chartRef.current && rsiChart && rsiSeriesRef.current) {
          try {
            const range = chartRef.current.timeScale().getVisibleRange();
            if (range && range.from != null && range.to != null) {
              rsiChart.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            // Ignorar errores si el gráfico no está listo
            console.debug('[RSI] Error sincronizando rango:', e.message);
          }
        }
      };

      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(syncRange);
      
      return () => {
        if (chartRef.current) {
          try {
            chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(syncRange);
          } catch (e) {
            // Gráfico ya destruido
          }
        }
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        rsiChart.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      rsiChart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [settings.rsi]);

  useEffect(() => {
    if (!settings.macd) return;
    if (!macdContainerRef.current || macdChartRef.current) return;

    // Panel dedicado al MACD: combina histograma (fuerza) con lineas de MACD y senal.
    const macdChart = createChart(macdContainerRef.current, MACD_CHART_OPTIONS);
    macdChartRef.current = macdChart;
    macdHistogramSeriesRef.current = macdChart.addHistogramSeries({
      priceScaleId: 'macd',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    macdSeriesRef.current = macdChart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      priceScaleId: 'macd',
    });
    macdSignalSeriesRef.current = macdChart.addLineSeries({
      color: '#22d3ee',
      lineWidth: 2,
      priceScaleId: 'macd',
    });

    const handleResize = () => {
      if (!macdContainerRef.current) return;
      const { width } = macdContainerRef.current.getBoundingClientRect();
      macdChart.applyOptions({ width: Math.max(width, 320) });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Observer para detectar cambios en el tamaño del contenedor
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(macdContainerRef.current);

    // Sincronizar la escala de tiempo con el gráfico principal
    if (chartRef.current) {
      const syncRange = () => {
        if (chartRef.current && macdChart && macdSeriesRef.current) {
          try {
            const range = chartRef.current.timeScale().getVisibleRange();
            if (range && range.from != null && range.to != null) {
              macdChart.timeScale().setVisibleRange(range);
            }
          } catch (e) {
            // Ignorar errores si el gráfico no está listo
            console.debug('[MACD] Error sincronizando rango:', e.message);
          }
        }
      };

      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(syncRange);
      
      return () => {
        if (chartRef.current) {
          try {
            chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(syncRange);
          } catch (e) {
            // Gráfico ya destruido
          }
        }
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        macdChart.remove();
        macdChartRef.current = null;
        macdSeriesRef.current = null;
        macdSignalSeriesRef.current = null;
        macdHistogramSeriesRef.current = null;
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      macdChart.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistogramSeriesRef.current = null;
    };
  }, [settings.macd]);

  useEffect(() => {
    if (!settings.rsi && rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    }
  }, [settings.rsi]);

  useEffect(() => {
    if (!settings.macd && macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistogramSeriesRef.current = null;
    }
  }, [settings.macd]);

  // Sincronización bidireccional entre todos los gráficos
    // Sincronización centralizada entre gráficos (evita loops y aplica rango solo si cambia)
  useEffect(() => {
    if (!chartRef.current) return;

    const charts = [
      chartRef.current,
      rsiChartRef.current,
      macdChartRef.current,
    ].filter(Boolean);

    if (charts.length <= 1) return;

    const handlers = [];

    // Handler que propaga el rango desde sourceChart al resto evitando recursión
    const createHandler = (sourceChart) => {
      return () => {
        try {
          // Si ya estamos sincronizando por otra fuente, salir rápido
          if (syncingRef.current) return;

          const range = sourceChart.timeScale().getVisibleRange();
          if (!range || range.from == null || range.to == null) return;

          // Marcar que estamos sincronizando para bloquear reentradas
          syncingRef.current = true;

          charts.forEach((targetChart) => {
            if (targetChart === sourceChart) return;
            try {
              const targetRange = targetChart.timeScale().getVisibleRange();
              // Aplicar solo si realmente difiere (evita sets redundantes)
              const sameFrom = targetRange && targetRange.from === range.from;
              const sameTo = targetRange && targetRange.to === range.to;
              if (!sameFrom || !sameTo) {
                targetChart.timeScale().setVisibleRange(range);
              }
            } catch (e) {
              // ignorar errores individuales por charts no listos
            }
          });
        } catch (e) {
          console.debug('[Sync] Error propagando rango:', e?.message || e);
        } finally {
          // Liberar el bloqueo con un pequeño retardo para permitir que los charts procesen
          setTimeout(() => { syncingRef.current = false; }, 50);
        }
      };
    };

    charts.forEach((sourceChart) => {
      const handler = createHandler(sourceChart);
      try {
        sourceChart.timeScale().subscribeVisibleTimeRangeChange(handler);
        handlers.push({ chart: sourceChart, handler });
      } catch (e) {
        console.debug('[Sync] No fue posible subscribir a timeScale:', e?.message || e);
      }
    });

    // Cleanup
    return () => {
      handlers.forEach(({ chart, handler }) => {
        try { chart.timeScale().unsubscribeVisibleTimeRangeChange(handler); } catch (e) {}
      });
    };
  }, [chartRef.current, rsiChartRef.current, macdChartRef.current]);

  useEffect(() => {
    if (
      !chartRef.current ||
      !bbUpperSeriesRef.current ||
      !bbMiddleSeriesRef.current ||
      !bbLowerSeriesRef.current
    ) {
      return;
    }

    // Aceptar tanto settings.bollinger como settings.bb; por defecto, desactivado
    const rawFlag = settings?.bollinger ?? settings?.bb;
    const useBB = rawFlag === true;

    // Log de diagnóstico para verificar qué está llegando
    console.debug('[BB] useBB:', useBB, {
      settings,
      lenUpper: Array.isArray(bbUpper) ? bbUpper.length : 'n/a',
      lenMiddle: Array.isArray(bbMiddle) ? bbMiddle.length : 'n/a',
      lenLower: Array.isArray(bbLower) ? bbLower.length : 'n/a',
    });

    if (
      useBB &&
      Array.isArray(bbUpper) && bbUpper.length &&
      Array.isArray(bbMiddle) && bbMiddle.length &&
      Array.isArray(bbLower) && bbLower.length
    ) {
      bbUpperSeriesRef.current.setData(bbUpper);
      bbMiddleSeriesRef.current.setData(bbMiddle);
      bbLowerSeriesRef.current.setData(bbLower);
    } else {
      bbUpperSeriesRef.current.setData([]);
      bbMiddleSeriesRef.current.setData([]);
      bbLowerSeriesRef.current.setData([]);
    }
  }, [bbUpper, bbMiddle, bbLower, settings]);

  useEffect(() => {
    if (!candleSeriesRef.current || !Array.isArray(candles)) return;
    
    // Verificación adicional para asegurar que el gráfico esté completamente inicializado
    if (!chartRef.current) {
      console.debug('[Charts] Gráfico principal no inicializado, esperando...');
      return;
    }

    if (candles.length === 0) {
      resetSeries(
        candleSeriesRef,
        volumeSeriesRef,
        ema20SeriesRef,
        ema50SeriesRef,
        sma200SeriesRef,
        rsiSeriesRef,
        macdSeriesRef,
        macdSignalSeriesRef,
        macdHistogramSeriesRef,
        bbUpperSeriesRef,   
        bbMiddleSeriesRef,  
        bbLowerSeriesRef,
      );
      try {
        candleSeriesRef.current.setMarkers([]);
      } catch (e) {
        console.debug('[Charts] Error limpiando marcadores:', e.message);
      }
      return;
    }

    try {
      // Verificar que los datos de velas sean válidos
      const validCandles = candles.filter(candle => 
        candle && 
        typeof candle.time === 'number' && 
        typeof candle.open === 'number' && 
        typeof candle.high === 'number' && 
        typeof candle.low === 'number' && 
        typeof candle.close === 'number'
      );

      if (validCandles.length === 0) {
        console.debug('[Charts] No hay velas válidas para mostrar');
        return;
      }

      candleSeriesRef.current.setData(validCandles);
      console.debug(`[Charts] Datos establecidos: ${validCandles.length} velas`);

      // Ajustar la escala visible de todos los gráficos para mostrar el rango completo
      if (validCandles.length > 0) {
        const first = validCandles[0].time;
        const last = validCandles[validCandles.length - 1].time;
        
        if (first != null && last != null && first < last) {
          const range = { from: first, to: last };
          
          // Usar setTimeout para dar tiempo a que los datos se procesen
          setTimeout(() => {
            try {
              // Aplicar el rango al gráfico principal
              if (chartRef.current) {
                chartRef.current.timeScale().setVisibleRange(range);
              }
            } catch (e) {
              console.debug('[Main] Error estableciendo rango:', e.message);
            }
            
            try {
              // Aplicar el rango al RSI si está activo y tiene datos
              if (rsiChartRef.current && settings.rsi && rsiSeriesRef.current) {
                rsiChartRef.current.timeScale().setVisibleRange(range);
              }
            } catch (e) {
              console.debug('[RSI] Error estableciendo rango:', e.message);
            }
            
            try {
              // Aplicar el rango al MACD si está activo y tiene datos
              if (macdChartRef.current && settings.macd && macdSeriesRef.current) {
                macdChartRef.current.timeScale().setVisibleRange(range);
              }
            } catch (e) {
              console.debug('[MACD] Error estableciendo rango:', e.message);
            }
          }, 100);
        }
      }

      // Volumen
      try {
        if (settings.volume && volumeSeriesRef.current) {
          mapVolumeHistogram(volumeSeriesRef, validCandles);
        } else if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData([]);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo volumen:', e.message);
      }

      // Indicadores de línea
      try {
        if (ema20SeriesRef.current) {
          ema20SeriesRef.current.setData(settings.ema20 ? ema20 : []);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo EMA20:', e.message);
      }

      try {
        if (ema50SeriesRef.current) {
          ema50SeriesRef.current.setData(settings.ema50 ? ema50 : []);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo EMA50:', e.message);
      }

      try {
        if (sma200SeriesRef.current) {
          sma200SeriesRef.current.setData(settings.sma200 ? sma200 : []);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo SMA200:', e.message);
      }
  
      // Señales
      try {
        const markers = buildSignalMarkers(signals);
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setMarkers(settings.signals ? markers : []);
        }
      } catch (e) {
        console.debug('[Signals] Error seteando markers:', e.message);
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setMarkers([]);
        }
      }

      // Divergencias
      try {
        // Siempre renderizar divergencias; ya vienen filtradas desde useMarketData
        renderDivergences(divergences || [], validCandles, rsi14);
      } catch (e) {
        console.debug('[Divergencias] Error al renderizar:', e.message);
      }

      // RSI
      try {
        if (settings.rsi && rsiSeriesRef.current) {
          rsiSeriesRef.current.setData(rsi14);
          syncRsiRange(rsi14);
        } else if (rsiSeriesRef.current) {
          rsiSeriesRef.current.setData([]);
          rsiSeriesRef.current.setMarkers([]);
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo RSI:', e.message);
      }

      // MACD
      try {
        if (settings.macd) {
          if (macdSeriesRef.current) {
            macdSeriesRef.current.setData(macdLine);
          }
          if (macdSignalSeriesRef.current) {
            macdSignalSeriesRef.current.setData(macdSignal);
          }
          if (macdHistogramSeriesRef.current) {
            mapMacdHistogram(macdHistogramSeriesRef, macdHistogram);
          }
        } else {
          if (macdSeriesRef.current) {
            macdSeriesRef.current.setData([]);
          }
          if (macdSignalSeriesRef.current) {
            macdSignalSeriesRef.current.setData([]);
          }
          if (macdHistogramSeriesRef.current) {
            macdHistogramSeriesRef.current.setData([]);
          }
        }
      } catch (e) {
        console.debug('[Charts] Error estableciendo MACD:', e?.message || 'Error desconocido');
      }

    } catch (e) {
      safeLog('error', '[Charts] Error general estableciendo datos del gráfico:', e);
    }
  }, [
    candles,
    ema20,
    ema50,
    rsi14,
    settings,
    signals,
    divergences,
    sma200,
    macdLine,
    macdSignal,
    macdHistogram,
    bbMiddle,
    bbUpper,
    bbLower,
  ]);


  return {
    chartContainerRef,
    rsiContainerRef,
    macdContainerRef,
    // Exponer las referencias de los charts para funcionalidades adicionales
    chartRef: chartRef.current,
    rsiChartRef: rsiChartRef.current,
    macdChartRef: macdChartRef.current,
    candleSeriesRef: candleSeriesRef.current,
    bbUpperSeriesRef: bbUpperSeriesRef.current,
    bbMiddleSeriesRef: bbMiddleSeriesRef.current,
    bbLowerSeriesRef: bbLowerSeriesRef.current,
  };
};
export default useMarketCharts;
