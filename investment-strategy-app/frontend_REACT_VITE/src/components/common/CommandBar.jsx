// src/components/common/CommandBar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { navigationItems } from '../../config/navigationConfig';
import { InstrumentsAPI, OrdersAPI, SignalsAPI } from '../../services/odata';

export default function CommandBar({ open, onClose, onGoto }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Close on escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Search across key entities with OData filters
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!q) { setResults([]); return; }
      setLoading(true);
      try {
        const [inst, ord, sig] = await Promise.all([
          InstrumentsAPI.list({ top: 5, filter: `contains(tolower(symbol),'${q.toLowerCase()}')` }),
          OrdersAPI.list({ top: 5, filter: `contains(tolower(account),'${q.toLowerCase()}')` }),
          SignalsAPI.list({ top: 5, filter: `contains(tolower(strategy_code),'${q.toLowerCase()}')` }),
        ]);
        if (!alive) return;
        setResults([
          ...inst.map((x) => ({ type: 'Instrumento', id: x.ID, label: `${x.symbol} - ${x.exchange}`, payload: x })),
          ...ord.map((x) => ({ type: 'Orden', id: x.ID, label: `${x.account} - ${x.side} ${x.qty}`, payload: x })),
          ...sig.map((x) => ({ type: 'Senal', id: x.ID, label: `${x.strategy_code} - ${x.action}`, payload: x })),
        ]);
      } catch {
        // ignore fetch errors for this quick search
      } finally {
        if (alive) setLoading(false);
      }
    };
    const t = setTimeout(run, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const quick = useMemo(() => navigationItems.map((n) => ({ type: 'Ir', id: n.id, label: n.title })), []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="mx-auto mt-24 max-w-2xl bg-[#0f172a] text-white rounded-xl shadow-2xl p-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar... (instrumento, orden, senal). Usa las flechas y Enter para abrir"
          className="w-full bg-transparent outline-none text-lg p-3 border-b border-white/10"
        />
        <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
          {!q && quick.map((x) => (
            <Row key={x.id} item={x} onSelect={() => { onGoto?.(x.id); onClose?.(); }} />
          ))}
          {q && (loading ? (
            <div className="p-4 opacity-80">Buscando...</div>
          ) : (
            results.length
              ? results.map((r) => (
                <Row
                  key={`${r.type}-${r.id}`}
                  item={r}
                  onSelect={() => { onGoto?.('instruments', r); onClose?.(); }}
                />
              ))
              : <div className="p-4 opacity-80">Sin resultados</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ item, onSelect }) {
  return (
    <button onClick={onSelect} className="w-full text-left p-3 hover:bg-white/5 transition">
      <div className="text-sm opacity-70">{item.type}</div>
      <div className="text-base">{item.label}</div>
    </button>
  );
}
