// src/components/views/InstrumentsFast.jsx
import React, { useEffect, useState } from 'react';
import { InstrumentsAPI, CandlesAPI, OrdersAPI } from '../../services/odata';
import Drawer from '../common/Drawer';
import OHLCChartCanvas from '../charts/OHLCChartCanvas';
import '../css/InstrumentList.css';

export default function InstrumentsFast({ preselect }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [candles, setCandles] = useState([]);

  // Fetch instrument list
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
    const t = setTimeout(run, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  // Preselection from other components
  useEffect(() => { if (preselect?.payload) setDrawer(preselect.payload); }, [preselect]);

  // Fetch candles when drawer changes
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!drawer) {
        setCandles([]);
        return;
      }
      try {
        const data = await CandlesAPI.list({
          top: 60,
          filter: `instrument_ID eq '${drawer.ID}'`,
          orderby: 'ts desc',
        });
        if (alive) setCandles([...(data || [])].reverse());
      } catch {
        if (alive) setCandles([]);
      }
    })();
    return () => { alive = false; };
  }, [drawer]);

  const createOrder = async (side) => {
    if (!drawer) return;
    const payload = {
      account: 'PAPER',
      side,
      order_type: 'MKT',
      qty: 1,
      instrument_id: drawer.ID,
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

  return (
    <div className="instrument-list-container">
      <div className="flex gap-3 items-center mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca por simbolo (AAPL, TSLA)"
          className="search-input"
        />
        <button
          className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600"
          onClick={() => setQ('')}
          title="Mostrar todos"
        >
          Todos
        </button>
        {busy && <span className="opacity-60 text-sm">Cargando...</span>}
        {error && <span className="opacity-80 text-sm text-red-400">{error}</span>}
      </div>

      <ul className="list-simple">
        {(items || []).map((x) => (
          <li key={x.ID} onClick={() => setDrawer(x)} className="row-simple">
            <div className="sym">{x.symbol}</div>
            <div className="ex">{x.exchange}</div>
            <div className="cur">{x.currency}</div>
            <div className="hint">Ver &gt;</div>
          </li>
        ))}
        {!busy && (items || []).length === 0 && <li className="opacity-60 p-3">Sin resultados.</li>}
      </ul>

      <Drawer open={!!drawer} title={drawer ? `${drawer.symbol} / ${drawer.exchange}` : ''} onClose={() => setDrawer(null)}>
        {drawer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field k="Tipo" v={drawer.sec_type} />
              <Field k="Moneda" v={drawer.currency} />
              <Field k="CONID" v={drawer.ib_conid} />
              <Field k="Clase" v={drawer.trading_class} />
              <Field k="Ult. trade" v={drawer.last_trade_date?.slice(0, 10)} />
              <Field k="Mult." v={drawer.multiplier} />
            </div>

            <div>
              <div className="text-xs opacity-70 mb-1">Precio (OHLC)</div>
              <OHLCChartCanvas candles={candles} height={240} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700" onClick={() => createOrder('BUY')}>Comprar</button>
              <button className="px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700" onClick={() => createOrder('SELL')}>Vender</button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Field({ k, v }) {
  return (
    <div className="flex justify-between bg-white/5 rounded-md px-3 py-2">
      <span className="opacity-60">{k}</span>
      <span>{v ?? '-'}</span>
    </div>
  );
}
