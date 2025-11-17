// frontend/src/components/market/MacdCalculationTable.jsx
import React, { useMemo } from 'react';
import { priceFormatter } from '../../constants/marketConstants';

/**
 * Calcula los datos para la tabla de MACD
 * MACD = EMA12 - EMA26
 * Signal = EMA9 del MACD
 * Histograma = MACD - Signal
 */
const calculateMacdData = (candles = [], macdLine = [], macdSignal = [], macdHistogram = [], signalConfig = {}) => {
  if (!candles || candles.length < 2) return [];
  
  const threshold = signalConfig.macdHistogramThreshold || 0.15;
  const data = [];
  
  for (let i = 0; i < candles.length; i++) {
    const macd = macdLine[i]?.value ?? null;
    const signal = macdSignal[i]?.value ?? null;
    const hist = macdHistogram[i]?.value ?? null;
    
    // Determinar decisión basada en cruces y histograma
    let decision = 'ESPERAR';
    
    if (macd !== null && signal !== null && hist !== null) {
      // Cruce alcista: MACD cruza por encima de Signal (histograma positivo y creciente)
      if (hist > 0 && hist > threshold) {
        decision = 'COMPRAR';
      }
      // Cruce bajista: MACD cruza por debajo de Signal (histograma negativo y decreciente)
      else if (hist < 0 && Math.abs(hist) > threshold) {
        decision = 'VENDER';
      }
    }
    
    data.push({
      n: i + 1,
      timestamp: candles[i].time,
      close: candles[i].close,
      macd: macd,
      signal: signal,
      histogram: hist,
      decision: decision,
    });
  }
  
  return data;
};

const MacdCalculationTable = ({ candles = [], macdLine = [], macdSignal = [], macdHistogram = [], signalConfig = {} }) => {
  const macdData = useMemo(() => {
    const recentCandles = candles.slice(-100);
    const recentMacd = macdLine.slice(-100);
    const recentSignal = macdSignal.slice(-100);
    const recentHist = macdHistogram.slice(-100);
    return calculateMacdData(recentCandles, recentMacd, recentSignal, recentHist, signalConfig);
  }, [candles, macdLine, macdSignal, macdHistogram, signalConfig]);

  if (!macdData.length) {
    return (
      <div className="events-table-wrapper">
        <p style={{ padding: '20px', textAlign: 'center', color: 'var(--project-color2)' }}>
          No hay suficientes datos para calcular MACD
        </p>
      </div>
    );
  }

  return (
    <div className="events-table-wrapper">
      <table className="events-table macd-table">
        <thead>
          <tr>
            <th className="col-n">N°</th>
            <th className="col-price">Precio Cierre</th>
            <th className="col-val">MACD Line</th>
            <th className="col-val">Signal Line</th>
            <th className="col-val">Histograma</th>
            <th className="col-decision">Decisión</th>
          </tr>
        </thead>
        <tbody>
          {macdData.map((row) => (
            <tr key={row.n}>
              <td className="col-n">{row.n}</td>
              <td className="col-price">{priceFormatter.format(row.close)}</td>
              <td className="col-val">{row.macd !== null ? row.macd.toFixed(4) : '-'}</td>
              <td className="col-val">{row.signal !== null ? row.signal.toFixed(4) : '-'}</td>
              <td className="col-val" style={{ color: row.histogram > 0 ? '#10b981' : row.histogram < 0 ? '#ef4444' : 'inherit' }}>
                {row.histogram !== null ? row.histogram.toFixed(4) : '-'}
              </td>
              <td className="col-decision">
                <span className={`decision-badge decision-${row.decision.toLowerCase()}`}>
                  {row.decision}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MacdCalculationTable;
