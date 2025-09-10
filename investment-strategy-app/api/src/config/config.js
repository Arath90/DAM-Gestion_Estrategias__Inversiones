import dotenv from 'dotenv';
dotenv.config();
export default {
    HOST: process.env.HOST || 'NO ENCONTRE VARIABLE DE ENTORNO HOST',
    PORT: process.env.PORT || 'NO ENCONTRE VARIABLE DE ENTORNO PORT',
    API_URL: process.env.API_URL || '/api/v1',
    CONNECTION_STRING: process.env.CONNECTION_STRING || 'mongodb://localhost:27017/?serverSelectionTimeoutMS=5000&connectTimeoutMS=10000',
    DATABASE: process.env.DATABASE || 'db_default',
    DB_PASSWORD: process.env.DB_PASSWORD || 'admin',
    DB_USER: process.env.DB_USER || 'admin',

}
//este archivo se encarga de leer las variables de entorno y exportarlas para que puedan ser usadas en otros archivos del proyecto.

//lee las variables de entorno desde el archivo .env y las asigna a las propiedades del objeto exportado.

//pero que no config.js tiene variables tambien?, asi es, pero estas son las que se usan en el proyecto y config.js las lee desde aqui.