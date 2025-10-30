import React from 'react';
import { AnalyticalTable } from '@ui5/webcomponents-react';

const columns = [
  {
    Header: 'Fecha',
    accessor: 'date',
    Cell: ({ cell: { value } }) => value ? new Date(value).toLocaleString() : '—',
  },
  {
    Header: 'Símbolo',
    accessor: 'symbol',
    Cell: ({ cell: { value } }) => value || '—',
  },
  {
    Header: 'Lado',
    accessor: 'side',
    Cell: ({ cell: { value } }) => value || '—',
  },
  {
    Header: 'Cantidad',
    accessor: 'qty',
    Cell: ({ cell: { value } }) => value ?? '—',
  },
  {
    Header: 'Precio',
    accessor: 'price',
    Cell: ({ cell: { value } }) => value ?? '—',
  },
  {
    Header: 'PnL',
    accessor: 'pnl',
    Cell: ({ cell: { value } }) => {
      if (!Number.isFinite(Number(value))) return '—';
      return (
        <span style={{ color: Number(value) >= 0 ? '#36d399' : '#ff6b6b', fontWeight: 700 }}>
          {Number(value).toFixed(2)}
        </span>
      );
    },
  },
];

const TradeTable = ({ rows = [] }) => {
  return (
    <AnalyticalTable
      data={rows}
      columns={columns}
      noDataText="Sin operaciones"
      style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }}
      minRows={3}
      scaleWidthMode="Smart"
    />
  );
};

export default TradeTable;
