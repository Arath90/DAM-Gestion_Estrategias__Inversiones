import React, { useEffect, useMemo, useState } from 'react';
import '../assets/globalAssets.css';
import { Card, CardHeader, FlexBox, Select, Option, Input, Button, Title, Toolbar, ToolbarSpacer, Text } from '@ui5/webcomponents-react';
import KpiStat from '../components/rendimiento/KpiStat';
import PerfChart from '../components/rendimiento/PerfChart';
import TradeTable from '../components/rendimiento/TradeTable';

const Rendimiento = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [range, setRange] = useState('1M');
  const [benchmark, setBenchmark] = useState('^GSPC');
  const [timeframe, setTimeframe] = useState('1D');
  const [kpis, setKpis] = useState({ pnlAbs: 0, pnlPct: 0, sharpe: 0, sortino: 0, maxDD: 0, cagr: 0 });
  const [equitySeries, setEquitySeries] = useState([]);
  const [drawdownSeries, setDrawdownSeries] = useState([]);
  const [trades, setTrades] = useState([]);

  const fetchPerformance = async () => {
    // TODO: reemplazar con axios.get('/Rendimiento?...') o similar
  };

  useEffect(() => { fetchPerformance(); }, [strategyId, range, timeframe, benchmark]);

  const emptyState = useMemo(() => !loading && !error && equitySeries.length === 0 && trades.length === 0, [loading, error, equitySeries.length, trades.length]);

  return (
    <FlexBox direction="Column" style={{ minHeight: '100vh', padding: 32, background: 'var(--project-color2)', color: 'var(--project-color1)', fontFamily: 'var(--font-primary)' }}>
      <Card style={{ marginBottom: 10, background: 'var(--project-color2)' }}>
        <CardHeader titleText="Rendimiento (En desarrollo)" style={{ color: 'var(--project-color3)' }} />
        <Text style={{ color: 'var(--project-color1)', margin: '4px 0 0 0', maxWidth: 640 }}>
          Visualiza KPIs, curvas de equity, drawdown y operaciones.
        </Text>
        <Toolbar style={{ marginTop: 18, gap: 10, flexWrap: 'wrap', background: 'none', padding: 0 }}>
          <Select value={strategyId} onChange={e => setStrategyId(e.target.value)} style={{ minWidth: 160 }}>
            <Option value="">Estrategia (todas)</Option>
            <Option value="demo-1">Momentum_US</Option>
            <Option value="demo-2">MeanReversion_EU</Option>
          </Select>
          <Select value={range} onChange={e => setRange(e.target.value)} style={{ minWidth: 120 }}>
            <Option value="7D">7D</Option>
            <Option value="1M">1M</Option>
            <Option value="3M">3M</Option>
            <Option value="YTD">YTD</Option>
            <Option value="1Y">1Y</Option>
            <Option value="ALL">ALL</Option>
          </Select>
          <Select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{ minWidth: 100 }}>
            <Option value="1D">1D</Option>
            <Option value="1H">1H</Option>
            <Option value="5m">5m</Option>
          </Select>
          <Input value={benchmark} onInput={e => setBenchmark(e.target.value)} placeholder="Benchmark (ej. ^GSPC)" style={{ minWidth: 160 }} />
          <Button design="Transparent" onClick={fetchPerformance}>Refrescar</Button>
        </Toolbar>
      </Card>

      {loading && <Text style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', color: 'var(--project-color4)' }}>Cargando métricas…</Text>}
      {error && !loading && <Text style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 8, background: 'rgba(255,82,82,0.2)', border: '1px solid rgba(255,82,82,0.6)', color: 'var(--project-color4)' }}>{error}</Text>}
      {message && <Text style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 8, background: 'rgba(29,209,161,0.2)', border: '1px solid rgba(29,209,161,0.6)', color: 'var(--project-color4)' }}>{message}</Text>}
      {emptyState && <Text style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', color: 'var(--project-color4)' }}>No hay datos para el rango seleccionado.</Text>}

      <FlexBox wrap style={{ gap: 12, margin: '16px 0 20px 0' }}>
        <KpiStat label="PnL (abs)" value={kpis.pnlAbs} suffix="" />
        <KpiStat label="PnL (%)" value={kpis.pnlPct} suffix="%" />
        <KpiStat label="Sharpe" value={kpis.sharpe} />
        <KpiStat label="Sortino" value={kpis.sortino} />
        <KpiStat label="Max DD" value={kpis.maxDD} suffix="%" />
        <KpiStat label="CAGR" value={kpis.cagr} suffix="%" />
      </FlexBox>

      <FlexBox direction="Column" style={{ gap: 14, marginBottom: 20 }}>
        <PerfChart title="Equity Curve" series={equitySeries} />
        <PerfChart title="Drawdown" series={drawdownSeries} />
      </FlexBox>

      <Card style={{ marginTop: 12, background: 'rgba(0,0,0,0.18)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.10)' }}>
        <CardHeader titleText="Operaciones" />
        <Toolbar style={{ justifyContent: 'flex-end', background: 'none', padding: 0 }}>
          <Button design="Transparent">Exportar CSV</Button>
        </Toolbar>
        <TradeTable rows={trades} />
      </Card>
    </FlexBox>
  );
};

export default Rendimiento;
