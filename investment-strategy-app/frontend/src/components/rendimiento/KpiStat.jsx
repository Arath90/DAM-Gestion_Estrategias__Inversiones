import React from 'react';
import { Card, CardHeader, FlexBox, Text } from '@ui5/webcomponents-react';

const format = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(2);
};

const KpiStat = ({ label, value, suffix = '' }) => (
  <Card style={{border: 'none', minWidth: 140 }}>
    <FlexBox direction="Column" style={{ alignItems: 'flex-start', padding: 12, background: 'var(--project-color1)', borderRadius: 5 }}>
      <Text style={{fontFamily: 'var(--font-primary)', fontSize: 14, opacity: 0.8, marginBottom: 6, color: 'var(--project-color3)' }}>{label}</Text>
      <Text style={{fontFamily: 'var(--font-primary)', fontSize: 17, fontWeight: 800, color: 'var(--project-color4)' }}>{format(value)}{suffix}</Text>
    </FlexBox>
  </Card>
);

export default KpiStat;
