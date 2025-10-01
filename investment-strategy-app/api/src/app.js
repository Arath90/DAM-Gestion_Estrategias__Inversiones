import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import config from './config/config.js';
import routeAPI from './routes/index.js'; // Ajusta el path si es necesario
import './config/database.config.js'; // Conexión a MongoDB

dotenv.config();

const app = express();

// Settings
app.set('port', config.PORT);

// Middlewares
app.use(cors());
app.use(morgan ('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rutas de prueba
const api = config.API_URL || '/api';
app.get(`${api}`, (req, res) => {
    res.send(
        `<h1>Por ahora los siguientes modelos pueden ser accesados para el Proyecto </h1>
            <ul>
                <li><a href="${api}/instruments">${api}/instruments</a></li>
                <li><a href="${api}/daily-pnl">${api}/daily-pnl</a></li>
                <li><a href="${api}/executions">${api}/executions</a></li>
                <li><a href="${api}/ml-datasets">${api}/ml-datasets</a></li>
                <li><a href="${api}/orders">${api}/orders</a></li>
                <li><a href="${api}/risk-limits">${api}/risk-limits</a></li>
            </ul>
        `
        
    );
});

// Rutas principales de la API
routeAPI(app);

export default app;
