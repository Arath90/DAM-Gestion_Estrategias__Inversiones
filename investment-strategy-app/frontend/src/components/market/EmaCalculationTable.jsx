// frontend/src/components/market/EmaCalculationTable.jsx
import React, { useMemo } from 'react';
import { priceFormatter } from '../../constants/marketConstants';

/**
 * Calcula los datos para la tabla de EMA (cruces entre EMA20 y EMA50)
 */
const calculateEmaData = (candles = [], ema20 = [], ema50 = []) => {
  if (!candles || candles.length < 2) return [];
  
  const data = [];
  
  for (let i = 0; i < candles.length; i++) {
    const ema20Val = ema20[i]?.value ?? null;
    const ema50Val = ema50[i]?.value ?? null;
    const prevEma20 = i > 0 ? (ema20[i - 1]?.value ?? null) : null;
    const prevEma50 = i > 0 ? (ema50[i - 1]?.value ?? null) : null;
    
    let cross = '-';
    let decision = 'ESPERAR';
    
    if (ema20Val !== null && ema50Val !== null && prevEma20 !== null && prevEma50 !== null) {
      // Detectar cruce alcista: EMA20 cruza por encima de EMA50
      if (prevEma20 <= prevEma50 && ema20Val > ema50Val) {
        cross = 'Cruce Alcista ↑';
        decision = 'COMPRAR';
      }
      // Detectar cruce bajista: EMA20 cruza por debajo de EMA50
      else if (prevEma20 >= prevEma50 && ema20Val < ema50Val) {
        cross = 'Cruce Bajista ↓';
        decision = 'VENDER';
      }
      // Indicar posición relativa si no hay cruce
      else if (ema20Val > ema50Val) {
        cross = 'EMA20 > EMA50';
      } else if (ema20Val < ema50Val) {
        cross = 'EMA20 < EMA50';
      }
    }
    
    data.push({
      n: i + 1,
      timestamp: candles[i].time,
      close: candles[i].close,
      ema20: ema20Val,
      ema50: ema50Val,
      cross: cross,
      decision: decision,
    });
  }
  
  return data;
};

const EmaCalculationTable = ({ candles = [], ema20 = [], ema50 = [] }) => {
  const emaData = useMemo(() => {
    const recentCandles = candles.slice(-100);
    const recentEma20 = ema20.slice(-100);
    const recentEma50 = ema50.slice(-100);
    return calculateEmaData(recentCandles, recentEma20, recentEma50);
  }, [candles, ema20, ema50]);

  if (!emaData.length) {
    return (
      <div className="events-table-wrapper">
        <p style={{ padding: '20px', textAlign: 'center', color: 'var(--project-color2)' }}>
          No hay suficientes datos para calcular EMA
        </p>
      </div>
    );
  }

  return (
    <div className="events-table-wrapper">
      <table className="events-table ema-table">
        <thead>
          <tr>
            <th className="col-n">N°</th>
            <th className="col-price">Precio Cierre</th>
            <th className="col-val">EMA 20</th>
            <th className="col-val">EMA 50</th>
            <th className="col-reason">Cruce</th>
            <th className="col-decision">Decisión</th>
          </tr>
        </thead>
        <tbody>
          {emaData.map((row) => (
            <tr key={row.n}>
              <td className="col-n">{row.n}</td>
              <td className="col-price">{priceFormatter.format(row.close)}</td>
              <td className="col-val">{row.ema20 !== null ? row.ema20.toFixed(4) : '-'}</td>
              <td className="col-val">{row.ema50 !== null ? row.ema50.toFixed(4) : '-'}</td>
              <td className="col-reason">{row.cross}</td>
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

export default EmaCalculationTable;
