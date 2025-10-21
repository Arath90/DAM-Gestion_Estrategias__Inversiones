// src/components/jsx/InstrumentList.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import '../css/InstrumentList.css';

function InstrumentList() {
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:4004/odata/v4/catalog/Instruments')
      .then((res) => setInstruments(res.data.value || []))
      .catch((err) => {
        console.error('Error fetching instruments:', err);
        setInstruments([]);
      });
  }, []);

  return (
    <div className="instrument-list-container">
      <div className="instrument-list-title">Instrumentos Bursatiles</div>
      <table className="instrument-table">
        <thead>
          <tr>
            <th title="Identificador unico de IBKR">CONID</th>
            <th title="Simbolo bursatil del instrumento">Simbolo</th>
            <th title="Bolsa donde cotiza">Bolsa</th>
            <th title="Moneda de cotizacion">Moneda</th>
            <th title="Fecha del ultimo trade">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {instruments.map((inst) => (
            <tr key={inst.ID}>
              <td>{inst.ib_conid}</td>
              <td>{inst.symbol}</td>
              <td>{inst.exchange}</td>
              <td>{inst.currency}</td>
              <td>{inst.last_trade_date?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default InstrumentList;
