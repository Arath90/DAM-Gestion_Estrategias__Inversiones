// frontend/src/components/market/EventsTable.jsx
import React, { useMemo, useState } from 'react';
import { exportCSV } from '../../utils/events';
import { priceFormatter } from '../../constants/marketConstants';

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

const EventsTable = ({ events = [], symbol = 'SYM' }) => {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    if (!events.length) return { total: 0, last: null };
    return { total: events.length, last: events[events.length - 1] || null };
  }, [events]);

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
          <h4>Eventos detectados</h4>
          <div className="events-meta">{summary.total} eventos • {summary.last ? new Date(summary.last.time*1000).toLocaleString() : '—'}</div>
        </div>
        <div className="events-actions">
          <button type="button" className="export-btn" onClick={(e)=>{ e.stopPropagation(); handleExport(); }}>
            Exportar CSV
          </button>
          <button type="button" className="toggle-btn" onClick={(e)=>{ e.stopPropagation(); setOpen(p=>!p); }}>
            {open ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {open && (
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
    </section>
  );
};

export default EventsTable;