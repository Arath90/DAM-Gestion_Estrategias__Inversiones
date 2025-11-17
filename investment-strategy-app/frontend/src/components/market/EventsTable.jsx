// frontend/src/components/market/EventsTable.jsx
import React, { useMemo, useState } from 'react';
import { exportCSV } from '../../utils/events';
import { priceFormatter } from '../../constants/marketConstants';
import RsiCalculationTable from './RsiCalculationTable';
import MacdCalculationTable from './MacdCalculationTable';
import EmaCalculationTable from './EmaCalculationTable';
import CombinedCalculationTable from './CombinedCalculationTable';

const humanizeType = (t) => {
  const map = {
    CROSS_UP: 'Cruz ↑',
    CROSS_DOWN: 'Cruz ↓',
    RSI_UP: 'RSI ↑',
    RSI_DOWN: 'RSI ↓',
    MAX: 'Máx.',
    MIN: 'Mín.',
    DIVERGENCE_BULL: 'Divergencia (alcista)',
    DIVERGENCE_BEAR: 'Divergencia (bajista)',
    MACD_CROSS_UP: 'MACD ↑',
    MACD_CROSS_DOWN: 'MACD ↓',
    BB_BOUNCE: 'BB Bounce',
  };
  return map[t] || t;
};

const EventsTable = ({ 
  events = [], 
  symbol = 'SYM', 
  candles = [], 
  signalConfig = {}, 
  settings = {},
  ema20 = [],
  ema50 = [],
  macdLine = [],
  macdSignal = [],
  macdHistogram = []
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('events'); // 'events', 'calculation'

  const summary = useMemo(() => {
    if (!events.length) return { total: 0, last: null };
    return { total: events.length, last: events[events.length - 1] || null };
  }, [events]);

  // Determinar qué tabla de cálculo mostrar según indicadores activos
  const calculationType = useMemo(() => {
    const useRSI = settings.rsi && signalConfig.useRSI !== false;
    const useMACD = settings.macd && signalConfig.useMACD !== false;
    const useEMA = settings.ema20 && settings.ema50 && signalConfig.useEMA !== false;
    
    const activeCount = [useRSI, useMACD, useEMA].filter(Boolean).length;
    
    // Si hay múltiples indicadores activos, mostrar tabla combinada
    if (activeCount > 1) return 'combined';
    
    // Si solo hay uno activo, mostrar tabla individual
    if (useRSI) return 'rsi';
    if (useMACD) return 'macd';
    if (useEMA) return 'ema';
    return 'combined'; // Por defecto combinada
  }, [settings, signalConfig]);

  const calculationLabel = useMemo(() => {
    switch(calculationType) {
      case 'combined': return 'Cálculo Combinado (Estrategia)';
      case 'rsi': return 'Cálculo RSI';
      case 'macd': return 'Cálculo MACD';
      case 'ema': return 'Cálculo EMA (Cruces)';
      default: return 'Cálculo';
    }
  }, [calculationType]);

  const handleExport = () => {
    const rows = events.map(e => ({
      timestamp: new Date((e.time ?? 0) * 1000).toISOString(),
      type: e.type,
      indicator: e.indicator ?? '',
      price: e.price ?? '',
      indicator_value: e.indicator_value ?? '',
      reason: e.reason ?? ''
    }));
    exportCSV(rows, `${symbol}-events.csv`);
  };

  return (
    <section className="strategy-events-card" aria-expanded={open}>
      <div className="strategy-events-header" onClick={() => setOpen(p => !p)} role="button" tabIndex={0}>
        <div>
          <h4>{activeTab === 'events' ? 'Eventos detectados' : calculationLabel}</h4>
          <div className="events-meta">
            {activeTab === 'events' 
              ? `${summary.total} eventos • ${summary.last ? new Date(summary.last.time*1000).toLocaleString() : '—'}`
              : `${candles.length} velas disponibles`
            }
          </div>
        </div>
        <div className="events-actions">
          {activeTab === 'events' && (
            <button type="button" className="export-btn" onClick={(e)=>{ e.stopPropagation(); handleExport(); }}>
              Exportar CSV
            </button>
          )}
          <button type="button" className="toggle-btn" onClick={(e)=>{ e.stopPropagation(); setOpen(p=>!p); }}>
            {open ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Tabs para cambiar entre vistas */}
          <div className="events-tabs">
            <button 
              type="button"
              className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              Eventos Detectados
            </button>
            <button 
              type="button"
              className={`tab-btn ${activeTab === 'calculation' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculation')}
            >
              {calculationLabel}
            </button>
          </div>

          {/* Contenido según tab activo */}
          {activeTab === 'events' && (
            <div className="events-table-wrapper">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Tipo</th>
                    <th>Indicador</th>
                    <th>Precio</th>
                    <th>Valor Indicador</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => (
                    <tr key={`${ev.time}_${idx}`}>
                      <td>{new Date(ev.time*1000).toLocaleString()}</td>
                      <td>{humanizeType(ev.type)}</td>
                      <td>{ev.indicator ?? '-'}</td>
                      <td style={{ textAlign: 'right' }}>{ev.price != null ? priceFormatter.format(ev.price) : '-'}</td>
                      <td style={{ textAlign: 'right' }}>{ev.indicator_value != null ? Number(ev.indicator_value).toFixed(4).replace(/\.?0+$/,'') : '-'}</td>
                      <td>{ev.reason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'calculation' && (
            <>
              {calculationType === 'combined' && (
                <CombinedCalculationTable 
                  candles={candles}
                  settings={settings}
                  signalConfig={signalConfig}
                  ema20={ema20}
                  ema50={ema50}
                  rsi14={candles}
                  macdLine={macdLine}
                  macdSignal={macdSignal}
                  macdHistogram={macdHistogram}
                />
              )}
              {calculationType === 'rsi' && (
                <RsiCalculationTable candles={candles} signalConfig={signalConfig} settings={settings} />
              )}
              {calculationType === 'macd' && (
                <MacdCalculationTable 
                  candles={candles} 
                  macdLine={macdLine}
                  macdSignal={macdSignal}
                  macdHistogram={macdHistogram}
                  signalConfig={signalConfig} 
                />
              )}
              {calculationType === 'ema' && (
                <EmaCalculationTable candles={candles} ema20={ema20} ema50={ema50} />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};

export default EventsTable;