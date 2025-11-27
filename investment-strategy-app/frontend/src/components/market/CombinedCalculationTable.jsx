// frontend/src/components/market/CombinedCalculationTable.jsx
import React, { useMemo } from 'react';
import { priceFormatter } from '../../constants/marketConstants';

/**
 * Tabla combinada que muestra todos los indicadores activos
 * y genera decisiones considerando múltiples señales
 */
const calculateCombinedData = (
  candles = [],
  settings = {},
  signalConfig = {},
  ema20 = [],
  ema50 = [],
  rsi14 = [],
  macdLine = [],
  macdSignal = [],
  macdHistogram = [],
  bbMiddle = [],
  bbUpper = [],
  bbLower = []
) => {
  if (!candles || candles.length < 2) return [];

  const useRSI = settings.rsi && signalConfig.useRSI !== false;
  const useMACD = settings.macd && signalConfig.useMACD !== false;
  const useEMA = settings.ema20 && settings.ema50 && signalConfig.useEMA !== false;
  const useBB = (settings.bollinger || settings.bb) && signalConfig.useBB !== false;

  const rsiOversold = signalConfig.rsiOversold || 30;
  const rsiOverbought = signalConfig.rsiOverbought || 70;
  const macdThreshold = signalConfig.macdHistogramThreshold || 0.15;
  const minReasons = signalConfig.minReasons || 1;

  const data = [];

  // Calcular RSI manualmente si está activo
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 0; i < candles.length; i++) {
    const row = {
      n: i + 1,
      timestamp: candles[i].time,
      close: candles[i].close,
    };

    // Calcular variación para RSI
    if (i > 0 && useRSI) {
      const variation = candles[i].close - candles[i - 1].close;
      const gain = variation > 0 ? variation : 0;
      const loss = variation < 0 ? Math.abs(variation) : 0;

      gainSum += gain;
      lossSum += loss;

      const avgGain = gainSum / i;
      const avgLoss = lossSum / i;
      const rs = avgLoss !== 0 ? avgGain / avgLoss : 0;
      const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

      row.rsi = rsi;
    }

    // Agregar EMA si está activo
    if (useEMA) {
      row.ema20 = ema20[i]?.value ?? null;
      row.ema50 = ema50[i]?.value ?? null;
    }

    // Agregar MACD si está activo
    if (useMACD) {
      row.macdLine = macdLine[i]?.value ?? null;
      row.macdSignal = macdSignal[i]?.value ?? null;
      row.macdHist = macdHistogram[i]?.value ?? null;
    }

    // Evaluar señales de cada indicador
    const signals = [];

    if (useRSI && row.rsi != null) {
      if (row.rsi <= rsiOversold) signals.push('RSI_BUY');
      else if (row.rsi >= rsiOverbought) signals.push('RSI_SELL');
    }

    if (useMACD && row.macdHist != null) {
      if (row.macdHist > macdThreshold) signals.push('MACD_BUY');
      else if (row.macdHist < -macdThreshold) signals.push('MACD_SELL');
    }

    if (useEMA && row.ema20 != null && row.ema50 != null && i > 0) {
      const prevEma20 = ema20[i - 1]?.value ?? null;
      const prevEma50 = ema50[i - 1]?.value ?? null;
      if (prevEma20 != null && prevEma50 != null) {
        if (prevEma20 <= prevEma50 && row.ema20 > row.ema50) signals.push('EMA_BUY');
        else if (prevEma20 >= prevEma50 && row.ema20 < row.ema50) signals.push('EMA_SELL');
      }
    }

    // Agregar Bandas de Bollinger si están activas
    if (useBB) {
      const bbMid = bbMiddle[i]?.value ?? null;
      const bbUp = bbUpper[i]?.value ?? null;
      const bbLow = bbLower[i]?.value ?? null;
      row.bbMid = bbMid;
      row.bbUp = bbUp;
      row.bbLow = bbLow;

      if (bbMid != null && bbUp != null && bbLow != null) {
        // Reglas simples: toques en bandas
        if (row.close <= bbLow) {
          signals.push('BB_BUY');
        } else if (row.close >= bbUp) {
          signals.push('BB_SELL');
        }
      }
    }

    // Determinar decisión final basada en consenso
    const buySignals = signals.filter(s => s.includes('_BUY')).length;
    const sellSignals = signals.filter(s => s.includes('_SELL')).length;

    let decision = 'ESPERAR';
    let reasons = [];

    if (buySignals >= minReasons && buySignals > sellSignals) {
      decision = 'COMPRAR';
      reasons = signals.filter(s => s.includes('_BUY')).map(s => s.replace('_BUY', ''));
    } else if (sellSignals >= minReasons && sellSignals > buySignals) {
      decision = 'VENDER';
      reasons = signals.filter(s => s.includes('_SELL')).map(s => s.replace('_SELL', ''));
    }

    row.decision = decision;
    row.reasons = reasons.join(', ') || '-';

    data.push(row);
  }

  return data;
};


//Componente
const CombinedCalculationTable = ({
  candles = [],
  settings = {},
  signalConfig = {},
  ema20 = [],
  ema50 = [],
  rsi14 = [],
  macdLine = [],
  macdSignal = [],
  macdHistogram = [],
  bbMiddle = [],
  bbUpper = [],
  bbLower = [],
}) => {
  const combinedData = useMemo(() => {
    const recentCandles = candles.slice(-100);
    const recentEma20 = ema20.slice(-100);
    const recentEma50 = ema50.slice(-100);
    const recentRsi = rsi14.slice(-100);
    const recentMacdLine = macdLine.slice(-100);
    const recentMacdSignal = macdSignal.slice(-100);
    const recentMacdHist = macdHistogram.slice(-100);
    //Bandas de BOLLINGER
    const recentBbMiddle = bbMiddle.slice(-100);
    const recentBbUpper = bbUpper.slice(-100);
    const recentBbLower = bbLower.slice(-100);

    return calculateCombinedData(
      recentCandles,
      settings,
      signalConfig,
      recentEma20,
      recentEma50,
      recentRsi,
      recentMacdLine,
      recentMacdSignal,
      recentMacdHist,
      recentBbMiddle,
      recentBbUpper,
      recentBbLower
    );
  }, [candles, settings, signalConfig, ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram]);

  const useRSI = settings.rsi && signalConfig.useRSI !== false;
  const useMACD = settings.macd && signalConfig.useMACD !== false;
  const useEMA = settings.ema20 && settings.ema50 && signalConfig.useEMA !== false;
  const useBB = (settings.bollinger || settings.bb) && signalConfig.useBB !== false;

  if (!combinedData.length) {
    return (
      <div className="events-table-wrapper">
        <p style={{ padding: '20px', textAlign: 'center', color: 'var(--project-color2)' }}>
          No hay suficientes datos para calcular indicadores
        </p>
      </div>
    );
  }

  return (
    <div className="events-table-wrapper">
      <table className="events-table combined-table">
        <thead>
          <tr>
            <th className="col-n">N°</th>
            <th className="col-price">Precio Cierre</th>
            {useRSI && <th className="col-val">RSI</th>}
            {useEMA && <th className="col-val">EMA 20</th>}
            {useEMA && <th className="col-val">EMA 50</th>}
            {useMACD && <th className="col-val">MACD</th>}
            {useMACD && <th className="col-val">Signal</th>}
            {useMACD && <th className="col-val">Hist</th>}
            {useBB && <th className="col-val">BB Low</th>}
            {useBB && <th className="col-val">BB Mid</th>}
            {useBB && <th className="col-val">BB Up</th>}
            <th className="col-reason">Razones</th>
            <th className="col-decision">Decisión</th>
          </tr>
        </thead>
        <tbody>
          {combinedData.map((row) => (
            <tr key={row.n}>
              <td className="col-n">{row.n}</td>
              <td className="col-price">{priceFormatter.format(row.close)}</td>
              {useRSI && (
                <td className="col-val" style={{ fontWeight: 'bold' }}>
                  {row.rsi != null ? row.rsi.toFixed(2) : '-'}
                </td>
              )}
              {useEMA && (
                <>
                  <td className="col-val">{row.ema20 != null ? row.ema20.toFixed(4) : '-'}</td>
                  <td className="col-val">{row.ema50 != null ? row.ema50.toFixed(4) : '-'}</td>
                </>
              )}
              {useMACD && (
                <>
                  <td className="col-val">{row.macdLine != null ? row.macdLine.toFixed(4) : '-'}</td>
                  <td className="col-val">{row.macdSignal != null ? row.macdSignal.toFixed(4) : '-'}</td>
                  <td className="col-val" style={{ color: row.macdHist > 0 ? '#10b981' : row.macdHist < 0 ? '#ef4444' : 'inherit' }}>
                    {row.macdHist != null ? row.macdHist.toFixed(4) : '-'}
                  </td>
                </>
              )}
              {useBB && (
                <>
                  <td className="col-val">{row.bbLow != null ? row.bbLow.toFixed(4) : '-'}</td>
                  <td className="col-val">{row.bbMid != null ? row.bbMid.toFixed(4) : '-'}</td>
                  <td className="col-val">{row.bbUp != null ? row.bbUp.toFixed(4) : '-'}</td>
                </>
              )}

              <td className="col-reason">{row.reasons}</td>
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

export default CombinedCalculationTable;
