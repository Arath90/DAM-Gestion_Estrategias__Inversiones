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
        `<h1>RESTful running in root (página base)</h1> <p> Inversiones: <b>${api}/api-docs</b> for more information.</p>`
    );
});
app.get('/DrFIC', (req, res) => {
    res.send(
        `<h1>RESTful running in NIGGA CHAIN AI LAYER 2 (como comprobacion y prueba)</h1> <p> Inversiones: <b>${api}/api-docs</b> for more information.</p>`
    );
});

// Rutas principales de la API
routeAPI(app);

export default app;
