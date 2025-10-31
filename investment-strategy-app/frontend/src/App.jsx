
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivateRoute from './components/common/PrivateRoute';
import Dashboard from './pages/Dashboard';
import Inicio from './pages/Inicio';
import Instrumentos from './pages/Instrumentos';
import Mercado from './pages/Mercado';
import Estrategias from './pages/Estrategias';
import Datasets from './pages/Datasets';
import Rendimiento from './pages/Rendimiento';
import Ordenes from './pages/Ordenes';
import Riesgos from './pages/Riesgos';
import Configuracion from './pages/Configuracion';
import { initTheme } from './utils/theme';

function App() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard/*" element={
          <PrivateRoute>
            <Routes>
              <Route path="/" element={<Dashboard panelContent={<Inicio />} />} />
              <Route path="inicio" element={<Dashboard panelContent={<Inicio />} />} />
              <Route path="instrumentos" element={<Dashboard panelContent={<Instrumentos />} />} />
              <Route path="mercado" element={<Dashboard panelContent={<Mercado />} />} />
              <Route path="estrategias" element={<Dashboard panelContent={<Estrategias />} />} />
              <Route path="datasets" element={<Dashboard panelContent={<Datasets />} />} />
              <Route path="rendimiento" element={<Dashboard panelContent={<Rendimiento />} />} />
              <Route path="ordenes" element={<Dashboard panelContent={<Ordenes />} />} />
              <Route path="riesgos" element={<Dashboard panelContent={<Riesgos />} />} />
              <Route path="configuracion" element={<Dashboard panelContent={<Configuracion />} />} />
            </Routes>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
