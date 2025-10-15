// src/api/services/crud.service.js

//porque es un servicio? 
//porque define una funcionalidad reutilizable que puede ser utilizada por diferentes partes de la aplicación.
//este servicio define operaciones CRUD estandarizadas para las entidades del sistema.
//CRUD = Create, Read, Update, Delete.
//estas operaciones son fundamentales para interactuar con la base de datos y gestionar los datos de manera eficiente.
//el servicio utiliza Mongoose para interactuar con MongoDB
//y mapear los datos entre el formato utilizado por CDS y el formato utilizado por MongoDB (osea entre el formato de los modelos y el formato de los documentos).

//=============================================
//      IMPORTS NECESARIOS
//=============================================
const { BITACORA, DATA, AddMSG, OK, FAIL } = require('../../middlewares/respPWA.handler');

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
// FUNCIONES AUXILIARES PARA BITÁCORA
//-----------------------------------
function readQueryBounds(req) {
  const top = Number(req._query?.$top ?? 0);
  const skip = Number(req._query?.$skip ?? 0);
  return { top, skip };
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
  const env = process?.env || {};//se obtienen las variables de entorno para obtener el nombre de la base de datos 
  bitacora.dbServer = env.MONGO_INV_DB || env.MONGODB_DB || env.DATABASE || 'Inversiones';//nombre de la base de datos

  data.method = method;//se asigna el método (CRUD)
  data.api = api;//se asigna la API
  data.dataReq = req.data || req._query || {};//se asignan los datos de la solicitud
  // lo anterior es el registro de los metadatos iniciales en la bitácora y el objeto de datos en el request de la operación CRUD 
  //flujo controlado
  //con flujo controlado nos referimos a que la operación se ejecuta dentro de un bloque try-catch
  //esto permite capturar cualquier error que ocurra durante la ejecución de la operación
  //y manejarlo de manera adecuada, registrándolo en la bitácora y devolviendo una respuesta estandarizada.
  return (async () => {
    try {
      //ejecutamos la operación específica (READ, CREATE, UPDATE, DELETE)
      const result = await handler();//handler es la función que realiza la operación específica 


      //configuración de respuesta exitosa
      data.status = (method === 'CREATE') ? 201 : 200;//201 para creación, 200 para los demás
      data.messageUSR = 'Operación realizada con éxito.';//mensaje para el usuario
      data.messageDEV = 'Operacion realizada con exito DEV';//mensaje para el desarrollador 
      data.dataRes = result;//resultado de la operación

      //se agrega el mensaje a la bitácora
      AddMSG(bitacora, data, 'OK', data.status, true);
      if (process.env.DEBUG_LOGS === 'true' && Array.isArray(bitacora.data) && bitacora.data.length > 0) {
        console.log('🧾 BITACORA =>');
        console.table(bitacora.data.map(b => ({
          Metodo: b.method,
          API: b.api,
          Status: b.status,
          Exito: b.success,
          Mensaje: b.messageUSR
        })));
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
      //configuración de respuesta de error
      data.status = err.status || 500;
      data.messageUSR = 'La operación no se pudo completar.';
      data.messageDEV = err.message || String(err);
      data.dataRes = { error: err?.stack || String(err) };

      //registramos el error en la bitácora
      AddMSG(bitacora, data, 'FAIL', data.status, true);

      //retornamos un formato estandarizado de error
      
      return FAIL(bitacora);
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

  //-----------------------------------
  // OPERACIÓN: READ
  //-----------------------------------
  //READ puede manejar tanto consultas por ID como consultas generales con paginación
  //entonces funciona como un GET para obtener uno o varios registros
  //si se proporciona un ID, se busca el documento por ID
  //si no, se realiza una consulta general con top y skip para paginación
  //osea get all y get one, tambien se podria un get many con más de un ID pero eso no esta implementado aqui... aun
  srv.on('READ', cdsEntity, async (req) => {
    const res = await wrapOperation({
      req,
      method: 'READ',
      api: `READ ${cdsEntity.name}`,
      process: `Lectura de ${cdsEntity.name}`,
      handler: async () => {
        if (req.data.ID) {
          const doc = await Model.findById(req.data.ID);
          return doc ? [mapOut(doc)] : [];
        }
        const { top, skip } = readQueryBounds(req);
        let q = Model.find();
        if (skip) q = q.skip(skip);
        if (top) q = q.limit(top);
        const docs = await q;
        return docs.map(mapOut);
      }
    });
    req.reply(res, res.status); // <-- Esto fuerza el código HTTP correcto
  });


  //-----------------------------------
  // OPERACIÓN: CREATE
  //-----------------------------------
  //CREATE es el verbo usado por CDS para crear un nuevo registro (equivalente a POST)
  srv.on('CREATE', cdsEntity, async (req) => wrapOperation({
    req,
    method: 'CREATE',
    api: `CREATE ${cdsEntity.name}`,
    process: `Creación de ${cdsEntity.name}`,
    handler: async () => {
      if (beforeCreate) await beforeCreate(req);
      if (uniqueCheck) await uniqueCheck(req);
      const created = await Model.create(mapIn(req.data));
      return mapOut(created);
    }
  }));


  //-----------------------------------
  // OPERACIÓN: UPDATE
  //-----------------------------------
  //UPDATE corresponde al verbo PUT o PATCH en REST.
  //se actualiza un registro existente a partir de su ID
  srv.on('UPDATE', cdsEntity, async (req) => wrapOperation({
    req,
    method: 'UPDATE',
    api: `UPDATE ${cdsEntity.name}`,
    process: `Actualización de ${cdsEntity.name}`,
    handler: async () => {
      if (!req.data.ID) { const e = new Error('ID requerido'); e.status = 400; throw e; }
      if (beforeUpdate) await beforeUpdate(req);
      const updated = await Model.findByIdAndUpdate(req.data.ID, mapIn(req.data), { new: true, runValidators: true });
      if (!updated) { const e = new Error('No encontrado'); e.status = 404; throw e; }
      return mapOut(updated);
    }
  }));


  //-----------------------------------
  // OPERACIÓN: DELETE
  //-----------------------------------
  //DELETE elimina un registro a partir de su ID
  srv.on('DELETE', cdsEntity, async (req) => wrapOperation({
    req,
    method: 'DELETE',
    api: `DELETE ${cdsEntity.name}`,
    process: `Eliminación de ${cdsEntity.name}`,
    handler: async () => {
      if (!req.data.ID) { const e = new Error('ID requerido'); e.status = 400; throw e; }
      const ok = await Model.findByIdAndDelete(req.data.ID);
      if (!ok) { const e = new Error('No encontrado'); e.status = 404; throw e; }
      return { deleted: true, ID: req.data.ID };
    }
  }));
}

//exportamos el servicio CRUD para ser usado por las entidades
module.exports = { registerCRUD };
