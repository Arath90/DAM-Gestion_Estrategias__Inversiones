// src/components/market/MarketChartsContainer.jsx
// ---------------------------------------------------------
// Contenedor que encapsula los tres gráficos:
// - Gráfico principal de precio con velas e indicadores
// - Gráfico RSI (si está habilitado)
// - Gráfico MACD (si está habilitado)
// ---------------------------------------------------------

import React from 'react';

/**
 * Contenedor de gráficos de mercado
 */
const MarketChartsContainer = ({
  chartContainerRef,
  rsiContainerRef,
  macdContainerRef,
  bbContainerRef,
  loading,
  error,
  candles,
  rsi14,
  macdLine,
  settings,
}) => {
  return (
    <section className="market-chart-wrapper">
      {/* Gráfico principal de precio */}
      <div className="market-chart" ref={chartContainerRef}>
        <div className="chart-title" title="Velas, volumen e indicadores seleccionados.">
          Precio y señales
        </div>
        {loading && <div className="chart-overlay">Cargando datos...</div>}
        {!loading && error && <div className="chart-overlay error">{error}</div>}
        {!loading && !error && !candles.length && (
          <div className="chart-overlay info">Sin datos para el rango seleccionado.</div>
        )}
      </div>

      {/* Gráfico RSI */}
      {settings.rsi && (
        <div className="market-chart rsi-chart" ref={rsiContainerRef}>
          <div className="chart-title" title="Oscilador de fuerza relativa (RSI).">
            RSI
          </div>
          {loading && <div className="chart-overlay">Calculando RSI...</div>}
          {!loading && !rsi14.length && (
            <div className="chart-overlay info">RSI requiere más historial.</div>
          )}
        </div>
      )}

      {/* Gráfico MACD */}
      {settings.macd && (
        <div className="market-chart macd-chart" ref={macdContainerRef}>
          <div className="chart-title" title="MACD, línea de señal e histograma.">
            MACD
          </div>
          {loading && <div className="chart-overlay">Calculando MACD...</div>}
          {!loading && !macdLine.length && (
            <div className="chart-overlay info">MACD requiere más historial.</div>
          )}
        </div>
      )}

      {/* Gráfico Bandas de Bollinger (BB) */}
      {settings.bb &&(
        <div className="market-chart macd-chart bb-chart" ref={bbContainerRef}>
          <div className="chart-title" title="Bandas de Bollinger — métrica / ancho.">
            Bollinger (panel)
          </div>
          {loading && <div className="chart-overlay">Calculando BB...</div>}
        </div>
      )}
    </section>
  );
};

export default MarketChartsContainer;
