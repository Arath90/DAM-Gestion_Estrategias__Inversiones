//index.js establece el puerto en el que se ejecutara el servidor y arranca la app.
//luego muestra en consola la url en la que se esta ejecutando el servidor.
//se importa la app desde el archivo app.js y la configuracion desde config.js


import app from './app';//importa la app desde app.js
import config from '../config/config.js';//importa la configuracion desde config.js
app.listen(app.get('port'));//arranca la app en el puerto establecido en app.js pero como?
//  pues usando el metodo listen de express, que recibe como parametro el puerto en el que se ejecutara el servidor 
// aun asi  no se ve claro, porque app.get('port')?
//  pues porque en app.js se establece el puerto usando app.set('port', config.PORT);
//  y config.PORT se lee desde las variables de entorno en config.js
// basicamente index.js-->app.js-->config.js-->.env 
console.log(
  `Server is running on: http://${config.HOST}:${app.get('port')}${
    config.API_URL
  }`
);