// src/components/views/DashboardLean.jsx
import React, { useEffect, useState } from 'react';
import Card from '../common/Card';
import LineChartCanvas from '../charts/LineChartCanvas';
import { DailyPnlsAPI, RiskLimitsAPI, OrdersAPI } from '../../services/odata';
import './DashboardView.css';

export default function DashboardLean() {
  const [kpi, setKpi] = useState({ cap: null, pl: null, risk: null, open: 0, hist: [] });
  const [busy, setBusy] = useState(true);
  const [flipped, setFlipped] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Bring raw data and sort locally by date
        const [pnlRaw, risk, ord] = await Promise.all([
          DailyPnlsAPI.list({ top: 120 }),
          RiskLimitsAPI.list({ top: 1 }),
          OrdersAPI.list({ top: 50, filter: "status ne 'FILLED'" }),
        ]);
        if (!alive) return;

        const pnl = Array.isArray(pnlRaw) ? [...pnlRaw] : [];
        pnl.sort((a, b) => new Date(a.date) - new Date(b.date));

        const hist = pnl
          .map((p) => Number(p.realized || 0) + Number(p.unrealized || 0))
          .filter(Number.isFinite);
        const last = pnl[pnl.length - 1];

        const plFromLastRow = last ? (Number(last.realized || 0) + Number(last.unrealized || 0)) : null;
        const plFromHist = hist.length ? hist[hist.length - 1] : null;

        setKpi({
          cap: plFromHist,
          pl: plFromLastRow ?? 0, // P/L del ultimo dia
          risk: risk?.[0]?.max_daily_loss ?? null,
          open: Array.isArray(ord) ? ord.length : 0,
          hist,
        });
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const cards = [
    {
      id: 'capital',
      title: 'Capital Total',
      tooltip: 'DailyPnls (realized + unrealized)',
      value: kpi.cap != null ? kpi.cap.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-',
      sub: busy ? 'Cargando...' : '',
      formula: 'Sumatoria DailyPnls.realized + DailyPnls.unrealized\n(serie histórica completa).',
    },
    {
      id: 'pl',
      title: 'P/L Diario',
      tooltip: 'DailyPnls (última fila)',
      value: kpi.pl != null ? kpi.pl.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-',
      sub: 'Desde la apertura',
      subColor: (kpi.pl || 0) >= 0 ? 'green' : 'red',
      formula: 'Último DailyPnl.realized + DailyPnl.unrealized\n(ordenado por fecha ascendente).',
    },
    {
      id: 'orders',
      title: 'Ordenes Abiertas',
      tooltip: "Orders (status ne 'FILLED')",
      value: `${kpi.open}`,
      sub: '',
      formula: "Cuenta de Orders con status != 'FILLED'\n(filtrado en API).",
    },
    {
      id: 'risk',
      title: 'Limite de Perdida (VaR 95%)',
      tooltip: 'RiskLimits.max_daily_loss',
      value: kpi.risk != null ? `-${Number(kpi.risk).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : '-',
      sub: 'Diario',
      subColor: 'red',
      formula: 'RiskLimits.max_daily_loss (primer registro)',
    },
  ];

  const hasSeries = Array.isArray(kpi.hist) && kpi.hist.length > 0;

  return (
    <>
      <section className="dashboard-cards">
        {cards.map((c) => (
          <Card
            key={c.id}
            {...c}
            isFlipped={flipped === c.id}
            onToggle={() => setFlipped((prev) => (prev === c.id ? null : c.id))}
          />
        ))}
      </section>
      <section className="dashboard-portfolio">
        <h2>Rendimiento del Portafolio</h2>
        <div className="portfolio-chart-placeholder">
          {hasSeries
            ? <LineChartCanvas data={kpi.hist} />
            : <div className="chart-empty">Sin suficientes datos en DailyPnls para trazar la serie.</div>}
        </div>
      </section>
    </>
  );
}
