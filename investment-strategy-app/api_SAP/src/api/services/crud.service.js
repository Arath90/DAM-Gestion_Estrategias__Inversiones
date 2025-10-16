// src/api/services/crud.service.js
//porque es un servicio?
//porque define una funcionalidad reutilizable que puede ser utilizada por diferentes partes de la aplicación.
//este servicio define operaciones CRUD estandarizadas para las entidades del sistema.
//CRUD = Create, Read, Update, Delete.
//estas operaciones son fundamentales para interactuar con la base de datos y gestionar los datos de manera eficiente.
//el servicio utiliza Mongoose para interactuar con MongoDB
//y mapear los datos entre el formato utilizado por CDS y el formato utilizado por MongoDB (osea entre el formato de los modelos y el formato de los documentos).

//{{CARNALGAS, COMO JALA ESTE ROLLO?, COMO QUE WRAPER Y CRUD Y TODO ESO?}}
//?primero que nada se definen varias funciones auxiliares para mapear datos entre CDS y MongoDB (mapIn y mapOut)
    //*estas dos madresotas son indispensables para que el servicio funcione correctamente,
    //*convierten los datos entre los dos formatos,
    //*nambre imagina lo que tendria que hacer para cada fokin operacion CRUD si no existieran estas funciones, un desmadre.
//?luego se define una función envolvente (wrapOperation) que maneja la bitácora y las respuestas estandarizadas para cada operación CRUD
    //*esta función se encarga de registrar toda la información relevante en la bitácora,
    //*basicamente es como pues una lamina de plastico que envuelve la operación CRUD asegurandose que se mantenga dicha operacion, libre de errores y con un formato estandarizado
    //*además, captura cualquier error que ocurra durante la operación y lo maneja de manera adecuada,
    //*devolviendo una respuesta estandarizada con OK() o FAIL().
//?finalmente, se define la función principal (registerCRUD) que registra los manejadores para cada verbo CRUD (CREATE, READ, UPDATE, DELETE)
    //*esta función toma como parámetros el servicio CDS, la entidad CDS, el modelo de datos Mongoose y opciones adicionales.
    //*y registra los manejadores para cada verbo CRUD utilizando la función envolvente (wrapOperation) para asegurar un manejo consistente de errores y bitácora.
//! y pues ya, tenemos una respuesta estandarizada para todas las operaciones CRUD en todas las entidades que usen este servicio, sin necesidad de repetir el mismo código una y otra vez.
//=============================================
//      IMPORTS NECESARIOS
//=============================================
const mongoose = require('mongoose');
const cds = require('@sap/cds'); 
const { BITACORA, DATA, AddMSG, OK, FAIL } = require('../../middlewares/respPWA.handler');//manejo estandarizado de respuestas y bitácora

const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
const isStrict = ['true', '1', 'yes', 'on'].includes(String(env.STRICT_HTTP_ERRORS || '').toLowerCase());//si STRICT_HTTP_ERRORS está activado, se lanzan errores HTTP reales
const debugLogs = ['true', '1', 'yes', 'on'].includes(String(env.DEBUG_LOGS || '').toLowerCase());//si DEBUG_LOGS está activado, se muestran logs detallados en la consola
const includeBita = ['true', '1', 'yes', 'on'].includes(String(env.INCLUDE_BITACORA_IN_ERROR || '').toLowerCase());//si INCLUDE_BITACORA_IN_ERROR está activado, se incluye una versión compacta de la bitácora en los errores


//--------------------------------------------
// FUNCIONES DE MAPEADO ENTRE CDS Y MONGODB
//--------------------------------------------

//mapOut convierte un documento de MongoDB a un objeto plano con un campo ID en lugar de _id
const mapOut = (doc) => {
  const o = doc?.toObject ? doc.toObject() : doc; //toObject convierte un documento de Mongoose a un objeto JS plano
  const { _id, __v, ...rest } = o || {}; //__v es un campo interno de Mongoose que indica la versión del documento
  return { ID: _id?.toString?.(), ...rest }; //_id se convierte a string para mayor compatibilidad
};

//mapIn convierte un objeto plano con un campo ID a un objeto adecuado para MongoDB (sin el campo ID)
const mapIn = (data) => {
  const { ID, ...rest } = data || {}; //se elimina el campo ID y se retornan los demás campos
  return rest; //se retornan los demás campos sin el ID
};

//en resumen ambos mapOut y mapIn son funciones de mapeo que convierten entre el formato utilizado por CDS y el formato utilizado por MongoDB.
//esto permite que el servicio CRUD maneje los datos de manera consistente independientemente del origen o destino de los datos.


//-----------------------------------
//! FUNCIONES AUXILIARES PARA BITÁCORA
//-----------------------------------
//readQueryBounds lee los parámetros $top y $skip de la consulta CDS para paginación
function readQueryBounds(req) {
  const top = Number(req._query?.$top ?? 0);//donde top es el número máximo de registros a devolver y aqui se asigna 0 si no se proporciona
  const skip = Number(req._query?.$skip ?? 0);//donde skip es el número de registros a omitir y aqui se asigna 0 si no se proporciona
  return { top, skip };//ya al final nomas retorna los datos pequeños pero importantes. (en formato objeto para paginar mas abajo en los verbos CRUD)
}
//isValidId verifica si un ID es un ObjectId válido de MongoDB
function isValidId(id) {//un ID válido es una cadena que cumple con el formato de ObjectId de MongoDB
  return typeof id === 'string' && mongoose.isValidObjectId(id);//
}

//-----------------------------------
// FUNCIÓN ENVOLVENTE: wrapOperation()
//-----------------------------------
//esta función es la responsable de envolver cada operación CRUD dentro de un flujo controlado
//usando la bitácora y devolviendo una respuesta estandarizada con OK() o FAIL()
//gracias a esto, cualquier error se captura y se devuelve desde el servicio principal (no desde las funciones internas de cada verbo CRUD)
//además, se registra toda la información relevante en la bitácora para facilitar el seguimiento y la depuración.

function wrapOperation({ req, method, api, process, handler }) {//entonces en wrapOperation se reciben varios parámetros:
  // - req: la solicitud CDS
  // - method: el verbo CRUD (CREATE, READ, UPDATE, DELETE)
  // - api: una descripción de la API que se está llamando
  // - process: una descripción del proceso que se está ejecutando
  // - handler: una función asíncrona que realiza la operación específica y devuelve el resultado
  const bitacora = BITACORA();//se inicializa la bitácora 
  const data = DATA();//y el objeto de datos
  //metadatos iniciales
  bitacora.process = process;//se asigna el proceso a la bitácora, si esta no definido se asigna una cadena vacía.
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};//se obtiene el objeto env de process si está definido, de lo contrario se usa un objeto vacío
  bitacora.dbServer = env.MONGO_INV_DB || env.MONGODB_DB || env.DATABASE || 'Inversiones';//nombre de la base de datos
  data.method = method;//se asigna el método (CRUD)
  data.api = api;//se asigna la API
  data.dataReq = req.data || req._query || {};//se asignan los datos de la solicitud
  // lo anterior es el registro de los metadatos iniciales en la bitácora y el objeto de datos en el request de la operación CRUD 
  //flujo controlado
  //con flujo controlado nos referimos a que la operación se ejecuta dentro de un bloque try-catch
  //esto permite capturar cualquier error que ocurra durante la ejecución de la operación
  //y manejarlo de manera adecuada, registrándolo en la bitácora y devolviendo una respuesta estandarizada.
  // Nota sobre promesas:
  // Esta funcion regresa una promesa porque el IIFE async siempre produce un Promise resuelto o rechazado. (IIFE = )
  // Con este patron evitamos crear new Promise((resolve, reject) => ...) y encadenar .then()/.catch().
  // Usar async/await nos deja leer el flujo como si fuera sincrono y delega la propagacion de errores al motor de JS via throw.
  return (async () => {
    try {
      //ejecutamos la operación específica (READ, CREATE, UPDATE, DELETE)
      const result = await handler(); // handler es la función principal y await evita encadenar .then()
      // al usar await, cualquier throw dentro del handler se captura en este mismo try sin .catch adicional.
      //configuración de respuesta exitosa
      data.status = (method === 'CREATE') ? 201 : 200;//un if primitivo bien macabro que asigna 201 si el método es CREATE, sino 200
      data.messageUSR = 'Operación realizada con éxito.';//mensaje para el usuario
      data.messageDEV = 'Operacion realizada con exito MI DESARROLLADORA BANDA LIMON';//mensaje para el desarrollador 
      data.dataRes = result;//resultado de la operación
      //se agrega el mensaje a la bitácora
      AddMSG(bitacora, data, 'OK', data.status, true);
      if (debugLogs) {
        try {
          console.log('🧾 BITACORA =>');
          console.table(bitacora.data.map(b => ({
            Metodo: b.method, API: b.api, Status: b.status, Exito: b.success, Mensaje: b.messageUSR
          })));
        } catch { }
      }
      //retornamos un formato estandarizado de éxito
      return OK(bitacora);
      //lo anterior aparecera en la respuesta HTTP de la API en mi caso uso POSTMAN  y me aparecera algo asi
      /*
      {
        "status": 200,
        "messageUSR": "Operación realizada con éxito.",
        "messageDEV": "Operacion realizada con exito DEV",
        "dataRes": [ ...resultado de la operación... ],
        "bitacora": { ...detalles de la bitácora... }
      }
      */
    } catch (err) {
      //configuración de respuesta en caso de error donde 400 es error del cliente y 500 es error del servidor
      let status = err.status || (err.name === 'CastError' ? 400 : 500);//si el error tiene un status se usa ese, si es un CastError (error de conversión de tipo) se usa 400, sino 500
      // utilidad para compactar bitácora
      function compactBitacora(b) {
        return {
          success: b.success,
          status: b.status,
          process: b.process,
          messageUSR: b.messageUSR,
          messageDEV: b.messageDEV,
          dbServer: b.dbServer,
          // solo lo esencial de cada paso:
          data: (b.data || []).map(d => ({
            method: d.method,
            api: d.api,
            status: d.status,
            success: d.success,
            messageUSR: d.messageUSR,
            messageDEV: d.messageDEV,
            countDataReq: d.countDataReq,
            countDataRes: d.countDataRes
          }))
        };
      }
      data.status = status;//se asigna el status al objeto de datos
      data.messageUSR = 'La operación no se pudo completar.';//mensaje genérico para el usuario
      data.messageDEV = err.message || String(err);//mensaje del error para el desarrollador
      data.dataRes = { error: err?.stack || String(err) };//detalles del error

      AddMSG(bitacora, data, 'FAIL', status, true);//se agrega el mensaje de error a la bitácora

      if (isStrict) {
        // si STRICT_HTTP_ERRORS=true → usamos req.error(...) para que OData responda con HTTP 4xx/5xx real
        // además incluimos (opcional) una versión compacta de la bitácora en innererror para depurar
        req.error({//se lanza un error con cds.error
          code: status >= 500 ? 'Internal-Server-Error' : 'Bad-Request', //código de error donde si status es mayor o igual a 500 es error interno,
          //  pero porque >=500?, no seria mejor solo 500? bueno es para cubrir otros posibles errores del servidor como 501, 502, etc 
          status,//status HTTP
          message: data.messageUSR,//mensaje para el usuario
          target: data.messageDEV,//mensaje para el desarrollador
          '@Common.numericSeverity': status >= 500 ? 4 : 2,//severidad numérica (4 para errores del servidor, 2 para errores del cliente)
          // adicionalmente se pueden agregar más detalles al error
          // como un código específico de la aplicación, una lista de errores relacionados, etc.
          codeSAP: 'CRUD_SERVICE_ERROR',//código específico de la aplicación
          // opcional: lista de detalles
          details: [
            {
              message: data.messageDEV,//mensaje del error para el desarrollador
              '@Common.numericSeverity': status >= 500 ? 4 : 2//severidad numérica
            }
          ],
          // comprimiendo la bitacora como la coca para que no ocupe tanto espacio y quepa mas en la troca (response)
          innererror: includeBita ? compactBitacora(bitacora) : undefined
        });
        return; // no se llega a este return, pero lo pongo para que el linter no se queje, maldito como me  obligas a  poner returns. #NoHateLinterPeroEsLaNeta
      }

      // Modo dev: se devuelve FAIL(...) en el body (OData lo envolverá como 200)
      return FAIL(bitacora);//se devuelve un formato estandarizado de error
      //por ejemplo en Postman con un GET a una entidad que no existe http://localhost:4004/odata/v4/catalog/MLDatasets/66f0000000000000000000101
      /*
      {
        "status": 400,
        "messageUSR": "La operación no se pudo completar.",
        "messageDEV": "No encontrado",
        "dataRes": {
          "error": "Error: No encontrado\n    at ...stack trace..."
        },
        "bitacora": { ...detalles de la bitácora... }
      }
      */

    }


  })();
}


//-----------------------------------
// SERVICIO PRINCIPAL: registerCRUD()
//-----------------------------------
//primero que nada se define la función registerCRUD 
//que toma como parámetros:
// - srv: el servicio CDS
// - cdsEntity: la entidad CDS
// - Model: el modelo de datos Mongoose
// - opts: opciones adicionales (uniqueCheck, beforeCreate, beforeUpdate)
function registerCRUD(srv, cdsEntity, Model, opts = {}) {
  const { uniqueCheck, beforeCreate, beforeUpdate } = opts;
   // valida un ObjectId con “motivo” detallado para mensajes exactos
      function validateObjectIdDetailed(id) {
        // 1) tipo correcto
        if (typeof id !== 'string') {
          return { ok: false, reason: 'El ID debe ser una cadena.' };
        }
        // 2) longitud exacta (24) — ObjectId es 24 caracteres hex
        if (id.length !== 24) {
          return { ok: false, reason: `Longitud inválida (${id.length}). Se esperan 24 caracteres.` };
        }
        // 3) caracteres hex válidos
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
          return { ok: false, reason: 'Formato inválido. Debe contener solo caracteres hexadecimales [0-9a-f].' };
        }
        // 4) validación final de Mongoose
        if (!mongoose.isValidObjectId(id)) {
          return { ok: false, reason: 'ObjectId inválido.' };
        }
        return { ok: true, reason: '' };
      }
  //-----------------------------------
  // OPERACIÓN: READ
  //-----------------------------------
  //READ puede manejar tanto consultas por ID como consultas generales con paginación
  //entonces funciona como un GET para obtener uno o varios registros
  //si se proporciona un ID, se busca el documento por ID
  //si no, se realiza una consulta general con top y skip para paginación
  //osea get all y get one, tambien se podria un get many con más de un ID pero eso no esta implementado aqui... aun
  // READ (Get One / Get All)
  srv.on('READ', cdsEntity, async (req) => {
    // Este callback es async, asi que CDS recibe una Promise sin construir resolve/reject manuales.
    // Permite escribir el flujo igual que sincrono y los errores se propagan con throw (equivalente a reject()).
    return wrapOperation({
      req, method: 'READ',
      api: `READ ${cdsEntity.name}`,
      process: `Lectura de ${cdsEntity.name}`,
      handler: async () => {
        // Handler async: todo return genera una Promise resuelta y cualquier throw se convierte en rechazo.
        // Es la misma promesa que lograriamos con .then()/.catch(), pero sin piramides de callbacks ni resolve innecesario.
        if (req.data.ID) {
          // validación “exacta”
          const v = validateObjectIdDetailed(req.data.ID);
          if (!v.ok) { const e = new Error(`ID inválido: ${v.reason}`); e.status = 400; throw e; }

          const doc = await Model.findById(req.data.ID);//se busca el documento por ID y se espera el resultado (una promesa resuelta con await)
          // findById devuelve una Query thenable (ya es una promesa), por eso no creamos new Promise ni encadenamos .then().
          // Con async/await ganamos:
          //   1) Legibilidad lineal: el flujo parece síncrono y se entiende rápido qué sucede paso a paso.
          //   2) Manejo de errores uniforme: cualquier throw dentro del handler cae en el try/catch de wrapOperation sin escribir .catch(() => reject()).
          //   3) Stack traces más claros: no se corta la traza como pasaría al saltar entre callbacks .then().
          // En resumen, se usa la misma promesa interna de Mongoose pero con una sintaxis más limpia y fácil de mantener.
          if (!doc) { const e = new Error('No encontrado'); e.status = 404; throw e; }
          return [mapOut(doc)];
        }

        // GET ALL (con paginación)
        const { top, skip } = readQueryBounds(req);//top= numero máximo de registros a devolver, skip= número de registros a omitir
        //readQueryBounds lee los parámetros $top y $skip de la consulta CDS
        //y los convierte a números
        //si no se proporcionan, se usan 0 por defecto (sin límite ni omisión)
        let q = Model.find();//se crea una consulta Mongoose para encontrar todos los documentos
        // find() regresa un objeto Query (thenable): todavía no ejecuta nada hasta que hagamos await o .then().
        // Ese Query implementa internamente la promesa que resolverá la consulta, así que no necesitamos construir new Promise().
          //find internamente se veria asi:
          /*
          Model.find = function() {
            const query = new Query(this); // 'this' es el modelo
             ... configurar la consulta ...
            return query; // Query es thenable y maneja su propia promesa interna
            thenable, es una promesa que tiene el método then() pero no necesariamente todos los métodos de una promesa completa (como catch() o finally()).
            Esto permite que el objeto pueda ser usado en contextos donde se espera una promesa, como con await o encadenando .then().
            La ventaja de thenable es que puede implementar su propia lógica para manejar la resolución y el rechazo,
            sin tener que heredar de la clase Promise completa.
            En el caso de Mongoose, sus objetos Query son thenables para permitir un manejo flexible de las consultas a la base de datos.
          }
          */
        // Simplemente la consumimos; Mongoose se encarga de resolver/rechazar cuando el Query se evalúa.
        if (skip) q = q.skip(skip);//que hace skip? omite los primeros 'skip' documentos de la consulta, osease si skip=5, se omiten los primeros 5 documentos
        if (top) q = q.limit(top);//que hace limit? limita el número máximo de documentos devueltos a 'top', osease si top=10, se devuelven como máximo 10 documentos
        const docs = await q;//al hacer await, el Query se convierte en la promesa interna y trae los documentos desde Mongo.
        return docs.map(mapOut);//se mapean los documentos al formato plano con mapOut y se retornan en un array de objetos listo para ser enviado en la respuesta HTTP el formato de envia es en array porque en CDS un READ siempre devuelve un array, incluso si solo hay un registro.
      }
    });
  });


  //-----------------------------------
  // OPERACIÓN: CREATE
  //-----------------------------------
  //CREATE es el verbo usado por CDS para crear un nuevo registro (equivalente a POST)
  srv.on('CREATE', cdsEntity, async (req) => {
    return wrapOperation({
      req, method: 'CREATE',
      api: `CREATE ${cdsEntity.name}`,
      process: `Creación de ${cdsEntity.name}`,
      handler: async () => {
        // Mantenemos async/await para heredar el mismo contrato sin crear resolve/reject manuales.
        // Si beforeCreate arroja un error, wrapOperation lo captura igual que si invocaramos reject(err).
        if (beforeCreate) await beforeCreate(req);
        if (uniqueCheck) await uniqueCheck(req);
        const created = await Model.create(mapIn(req.data));
        return mapOut(created);
      }
    });
  });

  //-----------------------------------
  // OPERACIÓN: UPDATE
  //-----------------------------------
  //UPDATE corresponde al verbo PUT o PATCH en REST.
  //se actualiza un registro existente a partir de su ID
  // UPDATE
  srv.on('UPDATE', cdsEntity, async (req) => {
    return wrapOperation({
      req, method: 'UPDATE',
      api: `UPDATE ${cdsEntity.name}`,
      process: `Actualización de ${cdsEntity.name}`,
      handler: async () => {
        // async/await vuelve natural la lectura de errores: cualquier throw se convierte en rechazo sin .catch manual.
        if (!req.data.ID) { const e = new Error('ID requerido'); e.status = 400; throw e; }
        const v = validateObjectIdDetailed(req.data.ID);
        if (!v.ok) { const e = new Error(`ID inválido: ${v.reason}`); e.status = 400; throw e; }

        if (beforeUpdate) await beforeUpdate(req);
        const updated = await Model.findByIdAndUpdate(req.data.ID, mapIn(req.data), { new: true, runValidators: true });
        if (!updated) { const e = new Error('No encontrado'); e.status = 404; throw e; }
        return mapOut(updated);
      }
    });
  });

  //-----------------------------------
  // OPERACIÓN: DELETE
  //-----------------------------------
  //DELETE elimina un registro a partir de su ID
  // DELETE
  srv.on('DELETE', cdsEntity, async (req) => {
    return wrapOperation({
      req, method: 'DELETE',
      api: `DELETE ${cdsEntity.name}`,
      process: `Eliminación de ${cdsEntity.name}`,
      handler: async () => {
        // Igual que antes, usamos async para evitar cadenas .then() y dejar que throw propague el error.
        if (!req.data.ID) { const e = new Error('ID requerido'); e.status = 400; throw e; }
        const v = validateObjectIdDetailed(req.data.ID);
        if (!v.ok) { const e = new Error(`ID inválido: ${v.reason}`); e.status = 400; throw e; }

        const ok = await Model.findByIdAndDelete(req.data.ID);
        if (!ok) { const e = new Error('No encontrado'); e.status = 404; throw e; }
        return { deleted: true, ID: req.data.ID };
      }
    });
  });

}

//exportamos el servicio CRUD para ser usado por las entidades
module.exports = { registerCRUD };


//!pero porque es mejor async/await que la encadenacion de Promise con .then, reject, resolve ?
//*
