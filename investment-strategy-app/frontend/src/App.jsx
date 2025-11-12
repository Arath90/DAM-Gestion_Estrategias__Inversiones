
import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/common/PrivateRoute';
import Dashboard from './pages/Dashboard';
import { initTheme } from './utils/theme';

// Páginas cargadas con lazy para reducir el tamaño inicial del bundle
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Inicio = lazy(() => import('./pages/Inicio'));
const Instrumentos = lazy(() => import('./pages/Instrumentos'));
const Mercado = lazy(() => import('./pages/Mercado'));
const Estrategias = lazy(() => import('./pages/Estrategias'));
const Datasets = lazy(() => import('./pages/Datasets'));
const Rendimiento = lazy(() => import('./pages/Rendimiento'));
const Ordenes = lazy(() => import('./pages/Ordenes'));
const Riesgos = lazy(() => import('./pages/Riesgos'));
const Configuracion = lazy(() => import('./pages/Configuracion'));

function App() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<div>Cargando...</div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard/*"
            element={
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
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
