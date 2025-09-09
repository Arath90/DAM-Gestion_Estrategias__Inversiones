import { useEffect, useState } from 'react';

function InstrumentList() {
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/instruments')
      .then(res => res.json())
      .then(data => setInstruments(data));
  }, []);

  return (
    <div>
      <h2>Instrumentos</h2>
      <ul>
        {instruments.map(inst => (
          <li key={inst._id}>
            {inst.symbol} - {inst.exchange} ({inst.currency})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default InstrumentList;