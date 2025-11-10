//-----------------------------------------------------------------------------
// Archivo: src/api/routes/index.js
// Descripción:
// Este archivo centraliza la configuración de rutas para todos los endpoints de la API.
// Aquí se definen las rutas base de cada módulo (productos/servicios, órdenes, etc.)
// y se importan los archivos de rutas específicos de cada módulo.
//-----------------------------------------------------------------------------
// Funcionamiento general:
// 1. Se importa Router de Express para crear un router modular.
// 2. Se importa la configuración global (config.js) para obtener la ruta base de la API (API_URL).
// 3. Se importan los archivos de rutas de cada módulo (por ejemplo, prodServRoutes para productos/servicios).
// 4. La función routerAPI recibe la instancia principal de la app Express (app).
// 5. Se crea un router y se monta en la ruta base definida por API_URL (por ejemplo, '/api/v1').
// 6. Dentro de esa ruta base, se agregan las rutas específicas de cada módulo usando router.use().
//    - Ejemplo: '/prod-serv' para productos y servicios.
// 7. Se pueden agregar más módulos simplemente importando sus rutas y agregando router.use().
// 8. El router se retorna para que Express lo use en la aplicación principal.
// 9. Así, todos los endpoints (GET, POST, PUT, DELETE, etc.) quedan organizados y accesibles bajo la ruta base.
//-----------------------------------------------------------------------------
// Ejemplo de estructura de rutas generada:
// /api/v1/prod-serv        -> Endpoints de productos y servicios
// /api/v1/orders           -> Endpoints de órdenes (si se agregan)
//-----------------------------------------------------------------------------

import { Router } from 'express'; 
import config from '../config/config.js'; 
// Import Routes
import instrumentRoutes from './instrument.routes.js';
import candleRoutes from './candle.routes.js';
import mlDatasetRoutes from './mlDataset.routes.js';
import dailyPnlRoutes from './dailyPnl.routes.js';
import executions from './execution.routes.js';
import orderRoutes from './order.routes.js';
import riskLimitRoutes from './riskLimit.routes.js';
import positionRoutes from './position.routes.js';
import signalRoutes from './signal.routes.js';

const routerAPI = (app) => { 
  const router = Router(); 
  const api = config.API_URL || '/api'; 
// * TODOS LOS PRODUCTOS
  app.use(api, router); 
  // Routes 
  router.use('/candles', candleRoutes); // Candles
  router.use('/instruments', instrumentRoutes);//Instruments
  router.use('/ml-datasets', mlDatasetRoutes);//mlDataset
  router.use('/daily-pnl', dailyPnlRoutes);
  router.use('/executions',executions)
  router.use('/orders', orderRoutes);
  router.use('/risk-limits', riskLimitRoutes);
  router.use('/positions', positionRoutes);
  router.use('/signals', signalRoutes);

  return router; 
}; 

export default routerAPI;

//! este index sirve para to osea todos los endpoints de la API post get put delete traka naga ninga sapa todos we, toditos cawn.
// a pero arath? como es posible eso no tienes que agregar las rutas de cada endpoint por separado?
// si pero en este index solo se agrega la ruta base de cada modulo y luego se importa el archivo de rutas correspondiente no seas naco cawn.
