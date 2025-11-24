import React, { useMemo } from 'react';
import { priceFormatter } from '../../constants/marketConstants';
import { exportCSV } from '../../utils/events';

/**
 * BollingerCalculationTable
 *
 * Props:
 * - candles: array de velas [{ time, open, high, low, close, volume }]
 * - bbMiddle, bbUpper, bbLower: arrays [{ time, value }] alineadas por time (pueden venir vacías)
 * - signalConfig: { BB_period, BB_stddev, ... } (opcional, para mostrar parámetros)
 */
const formatNumber = (v, digits = 4) => {
  if (v == null || Number.isNaN(Number(v))) return '-';
  const n = Number(v);
  // Mostrar sin ceros de relleno
  return n.toFixed(digits).replace(/\.?0+$/, '');
};

const findByTimeMap = (arr = []) => {
  const m = new Map();
  (arr || []).forEach((p) => {
    if (p && p.time != null) m.set(p.time, p.value ?? null);
  });
  return m;
};

const BollingerCalculationTable = ({ candles = [], bbMiddle = [], bbUpper = [], bbLower = [], signalConfig = {} }) => {
  const upperMap = useMemo(() => findByTimeMap(bbUpper), [bbUpper]);
  const middleMap = useMemo(() => findByTimeMap(bbMiddle), [bbMiddle]);
  const lowerMap = useMemo(() => findByTimeMap(bbLower), [bbLower]);

  const rows = useMemo(() => {
    return (candles || []).map((c) => {
      const t = c.time;
      const close = c.close;
      const upper = upperMap.get(t);
      const middle = middleMap.get(t);
      const lower = lowerMap.get(t);

      let percentB = null;
      let bandwidth = null;
      if (
        typeof upper === 'number' &&
        typeof lower === 'number' &&
        upper !== lower
      ) {
        percentB = (close - lower) / (upper - lower);
      }
      if (typeof upper === 'number' && typeof lower === 'number' && typeof middle === 'number' && middle !== 0) {
        bandwidth = (upper - lower) / middle;
      }

      return {
        time: t,
        iso: new Date((t || 0) * 1000).toISOString(),
        close,
        upper,
        middle,
        lower,
        percentB,
        bandwidth,
      };
    });
  }, [candles, upperMap, middleMap, lowerMap]);

  const handleExport = () => {
    const exportRows = rows.map(r => ({
      time: r.iso,
      close: r.close,
      bbupper: r.upper,
      bbmiddle: r.middle,
      bblower: r.lower,
      percent_b: r.percentB != null ? Number(r.percentB.toFixed(6)) : '',
      bandwidth: r.bandwidth != null ? Number(r.bandwidth.toFixed(6)) : ''
    }));
    exportCSV(exportRows, `bollinger-${signalConfig.BB_period || 'p'}-${signalConfig.BB_stddev || 's'}.csv`);
  };

  return (
    <div className="calc-table bollinger-calc">
      <div className="calc-table-header">
        <div>
          <strong>Bandas de Bollinger</strong>
          <div className="hint">
            Período: {signalConfig.BB_period ?? signalConfig.bbPeriod ?? 20} — Desv. std: {signalConfig.BB_stddev ?? signalConfig.bbStd ?? 2}
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={handleExport} className="export-btn">Exportar CSV</button>
        </div>
      </div>

      <div className="calc-table-body">
        <table className="calc-table-inner">
        <thead>
        <tr>
            <th className="col-date">Fecha / Hora</th>
            <th className="col-price" style={{ textAlign: 'right' }}>Cierre</th>
            <th className="col-val" style={{ textAlign: 'right' }}>BB Upper</th>
            <th className="col-val" style={{ textAlign: 'right' }}>BB Middle</th>
            <th className="col-val" style={{ textAlign: 'right' }}>BB Lower</th>
            <th className="col-val" style={{ textAlign: 'right' }}>%B</th>
            <th className="col-val" style={{ textAlign: 'right' }}>Bandwidth</th>
        </tr>
        </thead>

        <tbody>
        {rows.map((r, idx) => (
            <tr key={`${r.time}_${idx}`}>
            <td className="col-date">{new Date(r.time * 1000).toLocaleString()}</td>
            <td className="col-price" style={{ textAlign: 'right' }}>
                {r.close != null ? priceFormatter.format(r.close) : '-'}
            </td>
            <td className="col-val" style={{ textAlign: 'right' }}>{r.upper != null ? formatNumber(r.upper, 6) : '-'}</td>
            <td className="col-val" style={{ textAlign: 'right' }}>{r.middle != null ? formatNumber(r.middle, 6) : '-'}</td>
            <td className="col-val" style={{ textAlign: 'right' }}>{r.lower != null ? formatNumber(r.lower, 6) : '-'}</td>
            <td className="col-val" style={{ textAlign: 'right' }}>
                {r.percentB != null ? (r.percentB * 100).toFixed(2) + '%' : '-'}
            </td>
            <td className="col-val" style={{ textAlign: 'right' }}>
                {r.bandwidth != null ? formatNumber(r.bandwidth, 6) : '-'}
            </td>
            </tr>
        ))}
        </tbody>

        </table>
      </div>
    </div>
  );
};

export default BollingerCalculationTable;
