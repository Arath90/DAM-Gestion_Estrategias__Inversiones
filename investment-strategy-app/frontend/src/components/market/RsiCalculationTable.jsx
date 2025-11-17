// frontend/src/components/market/RsiCalculationTable.jsx
import React, { useMemo } from 'react';
import { priceFormatter } from '../../constants/marketConstants';

/**
 * Calcula los datos necesarios para la tabla de cálculo RSI "clásica"
 * Basado en el método de Wilder: RS = Media de ganancias / Media de pérdidas
 * RSI = 100 - (100 / (1 + RS))
 */
const calculateRsiData = (candles = [], period = 14, signalConfig = {}, settings = {}) => {
  if (!candles || candles.length < 2) return [];
  
  const data = [];
  let gainSum = 0;
  let lossSum = 0;
  let gainCount = 0;
  let lossCount = 0;
  
  // Extraer umbrales de la configuración de señales del usuario
  const rsiOversold = signalConfig.rsiOversold || 30;
  const rsiOverbought = signalConfig.rsiOverbought || 70;
  const useRSI = settings.rsi !== false && signalConfig.useRSI !== false;
  const useEMA = settings.ema20 && settings.ema50 && signalConfig.useEMA !== false;
  const useMACD = settings.macd !== false && signalConfig.useMACD !== false;
  
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const currClose = candles[i].close;
    const variation = currClose - prevClose;
    
    const gain = variation > 0 ? variation : 0;
    const loss = variation < 0 ? Math.abs(variation) : 0;
    
    // Actualizar series acumuladas
    gainSum += gain;
    lossSum += loss;
    if (gain > 0) gainCount++;
    if (loss > 0) lossCount++;
    
    // Calcular medias (inicialmente sobre todo el historial acumulado)
    const avgGain = gainCount > 0 ? gainSum / (i) : 0;
    const avgLoss = lossCount > 0 ? lossSum / (i) : 0;
    
    // Calcular RS y RSI
    const rs = avgLoss !== 0 ? avgGain / avgLoss : 0;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    
    // Decisión basada en la estrategia del usuario
    let decision = 'ESPERAR';
    
    if (useRSI) {
      // Si el usuario usa RSI, aplicar sus umbrales configurados
      if (rsi <= rsiOversold) {
        decision = 'COMPRAR'; // RSI bajo = sobreventa = oportunidad de compra
      } else if (rsi >= rsiOverbought) {
        decision = 'VENDER'; // RSI alto = sobrecompra = oportunidad de venta
      }
    }
    
    // Nota: Si en el futuro quieres combinar con EMA/MACD, puedes agregar lógica aquí
    // Por ahora, la decisión se basa principalmente en RSI según configuración del usuario
    
    data.push({
      n: i,
      timestamp: candles[i].time,
      close: currClose,
      variation: variation,
      gainSeries: gain,
      lossSeries: loss,
      avgGain: avgGain,
      avgLoss: avgLoss,
      rs: rs,
      rsi: rsi,
      decision: decision,
    });
  }
  
  return data;
};

const RsiCalculationTable = ({ candles = [], signalConfig = {}, settings = {} }) => {
  const rsiData = useMemo(() => {
    // Solo calcular para las últimas 100 velas para no sobrecargar la tabla
    const recentCandles = candles.slice(-100);
    return calculateRsiData(recentCandles, 14, signalConfig, settings);
  }, [candles, signalConfig, settings]);

  if (!rsiData.length) {
    return (
      <div className="events-table-wrapper">
        <p style={{ padding: '20px', textAlign: 'center', color: 'var(--project-color2)' }}>
          No hay suficientes datos de velas para calcular RSI
        </p>
      </div>
    );
  }

  return (
    <div className="events-table-wrapper">
      <table className="events-table rsi-table">
        <thead>
          <tr>
            <th className="col-n">N°</th>
            <th className="col-price">Precio Cierre</th>
            <th className="col-val">Variación</th>
            <th className="col-val">Serie Ganancias</th>
            <th className="col-val">Serie Pérdidas</th>
            <th className="col-val">Media Ganancias</th>
            <th className="col-val">Media Pérdidas</th>
            <th className="col-val">RS</th>
            <th className="col-val">RSI</th>
            <th className="col-decision">Decisión "Clásica"</th>
          </tr>
        </thead>
        <tbody>
          {rsiData.map((row) => (
            <tr key={row.n}>
              <td className="col-n">{row.n}</td>
              <td className="col-price">{priceFormatter.format(row.close)}</td>
              <td className="col-val" style={{ color: row.variation >= 0 ? '#10b981' : '#ef4444' }}>
                {row.variation >= 0 ? '+' : ''}{row.variation.toFixed(4)}
              </td>
              <td className="col-val">{row.gainSeries.toFixed(4)}</td>
              <td className="col-val">{row.lossSeries.toFixed(4)}</td>
              <td className="col-val">{row.avgGain.toFixed(4)}</td>
              <td className="col-val">{row.avgLoss.toFixed(4)}</td>
              <td className="col-val">{row.rs.toFixed(4)}</td>
              <td className="col-val" style={{ fontWeight: 'bold' }}>{row.rsi.toFixed(2)}</td>
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

export default RsiCalculationTable;
