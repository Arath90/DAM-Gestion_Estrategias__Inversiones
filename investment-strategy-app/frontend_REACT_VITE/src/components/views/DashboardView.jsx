// src/components/views/DashboardView.jsx
import React from 'react';
import Card from '../common/Card';
import './DashboardView.css';

const dashboardCards = [
  { title: 'Capital Total', value: '$1,250,450.75', sub: '+2.5% hoy', subColor: 'green' },
  { title: 'P/L Diario', value: '$30,512.30', sub: 'Desde la apertura', subColor: 'green' },
  { title: 'Estrategias Activas', value: '7', sub: '2 inactivas' },
  { title: 'Riesgo (VaR 95%)', value: '-$15,230.00', sub: 'Diario', subColor: 'red' },
];

const DashboardView = () => (
  <>
    <section className="dashboard-cards">
      {dashboardCards.map((card) => <Card key={card.title} {...card} />)}
    </section>
    <section className="dashboard-portfolio">
      <h2>Rendimiento del Portafolio</h2>
      <div className="portfolio-chart-placeholder">
        {/* Aqui ira el grafico de portafolio */}
      </div>
    </section>
  </>
);

export default DashboardView;
