import React from 'react';
import { Card, CardHeader, FlexBox, Text } from '@ui5/webcomponents-react';

// Placeholder visual Fiori para gráfica (puedes integrar Chart.js o similar luego)
const PerfChart = ({ title, series = [] }) => {
  const hasData = Array.isArray(series) && series.length > 0;
  return (
    <Card style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', marginBottom: 8 }}>
      <CardHeader titleText={title} style={{ color: 'var(--project-color4)' }} />
      <FlexBox direction="Column" style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {hasData ? (
          <Text style={{ color: 'var(--project-color3)', fontSize: 18 }}>
            {/* Aquí puedes renderizar una gráfica real con Chart.js, Recharts, etc. */}
            [Gráfica de {title}]
          </Text>
        ) : (
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>Sin datos</Text>
        )}
      </FlexBox>
    </Card>
  );
};

export default PerfChart;
