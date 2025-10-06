import React, { useEffect, useState } from 'react';
import Card from '../common/Card';
import LineChartCanvas from '../charts/LineChartCanvas';
import { DailyPnlsAPI, RiskLimitsAPI, OrdersAPI } from '../../services/odata';
import './DashboardView.css';

export default function DashboardLean() {
  const [kpi, setKpi] = useState({ cap:null, pl:null, risk:null, open:0, hist:[] });
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Pedimos sin confiar en orderby; lo hacemos en front por fecha
        const [pnlRaw, risk, ord] = await Promise.all([
          DailyPnlsAPI.list({ top: 120 }),
          RiskLimitsAPI.list({ top: 1 }),
          OrdersAPI.list({ top: 50, filter: "status ne 'FILLED'" }),
        ]);
        if (!alive) return;

        const pnl = Array.isArray(pnlRaw) ? [...pnlRaw] : [];
        pnl.sort((a,b) => new Date(a.date) - new Date(b.date)); // ascendente por fecha

        const hist = pnl.map(p => Number(p.realized||0) + Number(p.unrealized||0)).filter(Number.isFinite);
        const last = pnl[pnl.length - 1];

        const plFromLastRow = last ? (Number(last.realized||0) + Number(last.unrealized||0)) : null;
        const plFromHist = hist.length ? hist[hist.length - 1] : null;

        setKpi({
          cap: plFromHist,                // si no tienes capital separado, usa el acumulado
          pl: plFromLastRow ?? 0,         // P/L del último día
          risk: risk?.[0]?.max_daily_loss ?? null,
          open: Array.isArray(ord) ? ord.length : 0,
          hist
        });
      } finally { if (alive) setBusy(false); }
    })();
    return () => { alive = false; };
  }, []);

  const cards = [
    { title: 'Capital Total', value: kpi.cap != null ? kpi.cap.toLocaleString('en-US',{style:'currency',currency:'USD'}) : '—', sub: busy ? 'Cargando…' : '' },
    { title: 'P/L Diario', value: kpi.pl != null ? kpi.pl.toLocaleString('en-US',{style:'currency',currency:'USD'}) : '—', sub: 'Desde la apertura', subColor: (kpi.pl||0) >= 0 ? 'green' : 'red' },
    { title: 'Órdenes Abiertas', value: `${kpi.open}`, sub: '' },
    { title: 'Límite de Pérdida (VaR 95%)', value: kpi.risk != null ? `-${Number(kpi.risk).toLocaleString('en-US',{style:'currency',currency:'USD'})}` : '—', sub: 'Diario', subColor: 'red' },
  ];

  return (
    <>
      <section className="dashboard-cards">
        {cards.map(c => <Card key={c.title} {...c} />)}
      </section>
      <section className="dashboard-portfolio">
        <h2>Rendimiento del Portafolio</h2>
        <div className="portfolio-chart-placeholder">
          <LineChartCanvas data={kpi.hist}/>
        </div>
      </section>
    </>
  );
}
