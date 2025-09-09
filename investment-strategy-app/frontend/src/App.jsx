import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Instruments from './pages/Instruments';
import Signals from './pages/Signals';
import Orders from './pages/Orders';
import News from './pages/News';

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

export default App;