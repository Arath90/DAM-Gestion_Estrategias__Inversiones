//src/components/jsx/InstrumentList.jsx
import { useEffect, useState } from 'react';
import '../css/InstrumentList.css';

function InstrumentList() {
  const [instruments, setInstruments] = useState([]);
//fetch no va a ser la tecnología más adecuada para producción, pero es suficiente para este ejemplo
//después se puede cambiar por axios o similar.
  useEffect(() => {
    fetch('http://localhost:4004/odata/v4/catalog/Instruments')
      .then(res => res.json())
      .then(data => setInstruments(data.value)); // <-- usa data.value
  }, []);

  return (
    <div className="instrument-list-container">
      <div className="instrument-list-title">Instrumentos Bursátiles</div>
      <table className="instrument-table">
        <thead>
          <tr>
            <th title="Identificador único de IBKR">CONID</th>
            <th title="Símbolo bursátil del instrumento">Símbolo</th>
            <th title="Bolsa donde cotiza">Bolsa</th>
            <th title="Moneda de cotización">Moneda</th>
            <th title="Fecha del último trade">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {instruments.map(inst => (
            <tr key={inst.ID}>
              <td>{inst.ib_conid}</td>
              <td>{inst.symbol}</td>
              <td>{inst.exchange}</td>
              <td>{inst.currency}$</td>
              <td>{inst.last_trade_date?.slice(0,10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default InstrumentList;
