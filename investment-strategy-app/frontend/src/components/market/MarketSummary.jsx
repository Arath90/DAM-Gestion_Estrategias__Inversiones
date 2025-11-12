import React from 'react';
import { getIntervalLabel } from '../../utils/marketUtils';
import '../../assets/css/marketComponents/SharedMarketComponents.css';

/**
 * Resumen de información del mercado, estadísticas y niveles de soporte/resistencia
 */
const MarketSummary = ({ 
  symbol, 
  interval, 
  candles, 
  supportLevels, 
  resistanceLevels 
}) => {
  const intervalLabel = getIntervalLabel(interval);

  const volumeLabel = React.useMemo(() => {
    if (!candles.length) return '-';
    const latest = candles[candles.length - 1];
    return `${(latest.volume || 0).toLocaleString('en-US')} u.`;
  }, [candles]);

  const dateRangeInfo = React.useMemo(() => {
    if (candles.length === 0) return null;
    
    const firstTime = new Date(candles[0].time * 1000);
    const lastTime = new Date(candles[candles.length - 1].time * 1000);
    const daysCovered = Math.round((lastTime - firstTime) / (1000 * 60 * 60 * 24));
    
    const formatDate = (date) => {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    
    return {
      daysCovered,
      firstDate: formatDate(firstTime),
      lastDate: formatDate(lastTime)
    };
  }, [candles]);

  return (
    <section className="market-summary">
      <div>
        <strong>Ticker:</strong> {symbol}
      </div>
      <div>
        <strong>Intervalo:</strong> {intervalLabel}
      </div>
      <div>
        <strong>Velas cargadas:</strong> {candles.length}
        {dateRangeInfo && (
          <span style={{ marginLeft: '8px', color: '#888', fontSize: '0.9em' }}>
            ({dateRangeInfo.daysCovered} días: {dateRangeInfo.firstDate} - {dateRangeInfo.lastDate})
          </span>
        )}
      </div>
      <div>
        <strong>Volumen último:</strong> {volumeLabel}
      </div>
      {supportLevels.length > 0 && (
        <div className="support-info">
          <strong>Soportes detectados:</strong>{' '}
          {supportLevels.map((lvl) => lvl.toFixed(2)).join(', ')}
        </div>
      )}
      {resistanceLevels.length > 0 && (
        <div className="resistance-info">
          <strong>Resistencias detectadas:</strong>{' '}
          {resistanceLevels.map((lvl) => lvl.toFixed(2)).join(', ')}
        </div>
      )}
    </section>
  );
};

export default MarketSummary;