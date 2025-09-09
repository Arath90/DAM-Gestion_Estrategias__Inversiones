import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Instruments from './pages/Instruments';
import Signals from './pages/Signals';
import Orders from './pages/Orders';
import News from './pages/News';
import InstrumentList from './components/InstrumentList';
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/instruments" element={<Instruments />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/news" element={<News />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <div >
      <h1>Gestion de Estrategias de Inversion</h1>
      <InstrumentList />
    </div>
  );
}

export default App;