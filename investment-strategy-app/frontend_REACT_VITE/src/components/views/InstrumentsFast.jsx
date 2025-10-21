// src/components/views/InstrumentsFast.jsx
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { InstrumentsAPI, CandlesAPI, OrdersAPI } from '../../services/odata';
import OHLCChartCanvas from '../charts/OHLCChartCanvas';
import '../css/InstrumentList.css';

export default function InstrumentsFast({ preselect }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [candlesCache, setCandlesCache] = useState({});
  const [loadingCandlesFor, setLoadingCandlesFor] = useState(null);
  const [candlesError, setCandlesError] = useState({});

  // Fetch instrument list with lightweight debounce
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBusy(true);
      setError(null);
      try {
        const filter = q ? `contains(tolower(symbol),'${q.toLowerCase()}')` : undefined;
        const data = await InstrumentsAPI.list({ top: 25, filter });
        if (alive) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('Instruments list error:', e?.response?.data || e.message);
        if (alive) {
          setError('No se pudieron cargar los instrumentos');
          setItems([]);
        }
      } finally {
        if (alive) setBusy(false);
      }
    };
    const timer = setTimeout(run, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [q]);

  // Pre-selection from other components
  useEffect(() => {
    if (preselect?.payload) setExpanded(preselect.payload);
  }, [preselect]);

  // Fetch candles when expanded instrument changes (with caching per instrument)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!expanded?.ID) {
        setLoadingCandlesFor(null);
        return;
      }
      const instrumentId = expanded.ID;
      if (candlesCache[instrumentId]) {
        // already cached, ensure error cleared for this instrument
        setCandlesError((prev) => {
          if (!prev[instrumentId]) return prev;
          const next = { ...prev }; delete next[instrumentId];
          return next;
        });
        setLoadingCandlesFor(null);
        return;
      }
      try {
        setLoadingCandlesFor(instrumentId);
        setCandlesError((prev) => {
          if (!prev[instrumentId]) return prev;
          const next = { ...prev }; delete next[instrumentId];
          return next;
        });
        const data = await CandlesAPI.list({
          top: 60,
          filter: `instrument_ID eq '${instrumentId}'`,
          orderby: 'ts desc',
        });
        if (!alive) return;
        setCandlesCache((prev) => ({
          ...prev,
          [instrumentId]: Array.isArray(data) ? [...data].reverse() : [],
        }));
      } catch (e) {
        if (!alive) return;
        console.warn('Candles fetch error:', e?.response?.data || e.message);
        setCandlesError((prev) => ({
          ...prev,
          [instrumentId]: 'No se pudieron cargar los precios.',
        }));
      } finally {
        if (alive) setLoadingCandlesFor((prev) => (prev === instrumentId ? null : prev));
      }
    })();
    return () => { alive = false; };
  }, [expanded, candlesCache]);

  const createOrder = async (side) => {
    if (!expanded?.ID) return;
    const payload = {
      account: 'PAPER',
      side,
      order_type: 'MKT',
      qty: 1,
      instrument_id: expanded.ID,
      status: 'PENDING',
      placed_at: new Date().toISOString(),
    };
    try {
      await OrdersAPI.create(payload);
      alert('Orden creada');
    } catch (e) {
      alert('No se pudo crear la orden: ' + (e?.message || ''));
    }
  };

  const expandedCandles = useMemo(() => (
    expanded?.ID ? candlesCache[expanded.ID] || [] : []
  ), [expanded, candlesCache]);

  const latestCandle = expandedCandles.length ? expandedCandles[expandedCandles.length - 1] : null;
  const latestHint = latestCandle
    ? `Ultimo cierre: ${Number(latestCandle.close).toFixed(2)} USD | Alto ${latestCandle.high} | Bajo ${latestCandle.low}`
    : 'Se mostraran los ultimos 60 registros OHLC disponibles.';

  const toggleRow = (item) => {
    setExpanded((prev) => (prev?.ID === item.ID ? null : item));
  };

  return (
    <div className="instrument-list-container">
      <div className="instrument-header-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca por simbolo (AAPL, TSLA)"
          className="search-input"
        />
        <button
          className="btn-secondary"
          onClick={() => setQ('')}
          title="Mostrar todos"
        >
          Todos
        </button>
        {busy && <span className="muted-text">Cargando...</span>}
        {error && <span className="error-text">{error}</span>}
      </div>

      <ul className="list-simple">
        {(items || []).map((item) => {
          const isExpanded = expanded?.ID === item.ID;
          const rowCandles = candlesCache[item.ID] || [];
          const isLoadingCandles = loadingCandlesFor === item.ID;
          const errorMsg = candlesError[item.ID];
          return (
            <Fragment key={item.ID}>
              <li
                onClick={() => toggleRow(item)}
                className={`row-simple${isExpanded ? ' row-simple--active' : ''}`}
              >
                <div className="sym">
                  <span>{item.symbol}</span>
                  {item.trading_class && <span className="sym-sub">{item.trading_class}</span>}
                </div>
                <div className="ex">{item.exchange}</div>
                <div className="cur">{item.currency}</div>
                <div className={`hint${isExpanded ? ' hint-open' : ''}`}>
                  {isExpanded ? 'Ocultar' : 'Ver'}
                </div>
              </li>
              {isExpanded && (
                <li className="detail-card">
                  <div className="detail-header">
                    <div>
                      <h3>{item.symbol} <span className="detail-exchange">/ {item.exchange}</span></h3>
                      <p className="detail-sub">{item.description || item.name || item.sec_type || 'Instrumento'}</p>
                    </div>
                    <button className="btn-close" onClick={() => setExpanded(null)}>Cerrar</button>
                  </div>

                <div className="detail-grid">
                  <Field k="Tipo" v={item.sec_type} tip="Tipo de instrumento que provee IBKR (STK=Accion, OPT=Opcion, FUT=Futuro)." />
                  <Field k="Moneda" v={item.currency} tip="Moneda principal en la que cotiza este instrumento." />
                  <Field k="CONID" v={item.ib_conid} tip="Identificador unico asignado por Interactive Brokers (CONID)." />
                  <Field k="Clase" v={item.trading_class} tip="Clase bursatil utilizada por la bolsa para agrupar contratos." />
                  <Field k="Ult. trade" v={item.last_trade_date?.slice(0, 10)} tip="Fecha del ultimo trade reportado por el proveedor." />
                  <Field k="Mult." v={item.multiplier} tip="Multiplicador del contrato. Determina el nominal por unidad de precio." />
                </div>

                  <div className="detail-chart" title={latestHint}>
                    <div className="detail-chart-title">
                      Precio (OHLC)
                      <span className="info-dot" data-tip="Velas de 1 minuto generadas por el seed. Pasa el cursor para ver el valor del ultimo cierre." aria-label="Tooltip: Detalle OHLC" tabIndex={0} role="button">?</span>
                    </div>
                    {isLoadingCandles ? (
                      <div className="detail-chart-placeholder">Cargando precios...</div>
                    ) : errorMsg ? (
                      <div className="detail-chart-placeholder error">{errorMsg}</div>
                    ) : rowCandles.length ? (
                      <OHLCChartCanvas candles={expandedCandles} height={240} />
                    ) : (
                      <div className="detail-chart-placeholder">Sin datos recientes.</div>
                    )}
                  </div>

                  <div className="detail-actions">
                    <button className="btn-buy" onClick={() => createOrder('BUY')} title="Genera una orden de compra de mercado para 1 unidad.">Comprar</button>
                    <button className="btn-sell" onClick={() => createOrder('SELL')} title="Genera una orden de venta de mercado para 1 unidad.">Vender</button>
                  </div>
                </li>
              )}
            </Fragment>
          );
        })}
        {!busy && (items || []).length === 0 && (
          <li className="detail-chart-placeholder">Sin resultados.</li>
        )}
      </ul>
    </div>
  );
}

function Field({ k, v, tip }) {
  return (
    <div className="detail-field" title={tip || `${k}: ${v ?? '-'}`}>
      <span className="detail-field-label">
        {k}
        {tip && (
          <span
            className="info-dot"
            data-tip={tip}
            aria-label={`Tooltip: ${tip}`}
            tabIndex={0}
            role="button"
          >
            i
          </span>
        )}
      </span>
      <span className="detail-field-value">{v ?? '-'}</span>
    </div>
  );
}










