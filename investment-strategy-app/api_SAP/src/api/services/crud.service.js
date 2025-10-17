/**
 * src/api/services/crud.service.js
 * ---------------------------------------------------------------------------
 * Servicio CRUD sencillo (MongoDB + SAP CDS) que registra handlers genéricos
 * para entidades OData mediante CAP (READ/CREATE/UPDATE/DELETE).
 *
 * ¿Por qué es un servicio?
 * - Porque encapsula operaciones CRUD reutilizables que otras partes de la app
 *   (tu controller) invocan con una sola función: registerCRUD(...).
 *
 * ¿Qué hace cada parte?
 * - registerCRUD: registra los 4 handlers OData para una entidad CDS y un Model Mongoose.
 * - wrapOperation: arma la bitácora, extrae params limpios (ProcessType, etc.) y envuelve
 *   cada operación con manejo estándar de OK/FAIL.
 * - mapOut/mapIn: convierten entre documento Mongoose y la forma CDS.
 * - Helpers: validan ObjectId y leen $top/$skip.
 *
 * Estilo: Promesas explícitas (.then / reject/resolve) para que el flujo sea muy legible.
 */

const mongoose = require('mongoose');
const { BITACORA, DATA, AddMSG, OK, FAIL } = require('../../middlewares/respPWA.handler');

// =====================
// Helpers utilitarios
// =====================

/** Enunciado: Valida si un string es un ObjectId Mongo. */
function isValidObjectId(id) {
  // comprobación estricta de 24 hex + validación Mongoose
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && mongoose.isValidObjectId(id);
}

/** Enunciado: Convierte doc Mongoose a objeto compatible CDS (ID como string). */
const mapOut = (doc) => {
  // si viene documento de Mongoose, lo pasamos a objeto plano
  const o = doc?.toObject ? doc.toObject() : doc;
  // omitimos internos y exponemos ID
  const { _id, __v, ...rest } = o || {};
  return { ID: _id?.toString?.(), ...rest };
};

/** Enunciado: Prepara payload de entrada eliminando ID (Mongo gestiona _id). */
const mapIn = (data) => {
  const { ID, ...rest } = data || {};
  return rest;
};

/** Enunciado: Lee $top/$skip de OData desde req. */
function readQueryBounds(req) {
  // _query es objeto de CAP con meta de OData
  const top = Number(req._query?.$top ?? 0);
  const skip = Number(req._query?.$skip ?? 0);
  return { top, skip };
}

/**
 * Enunciado: Envoltura de una operación CRUD.
 * - Crea bitácora y DATA.
 * - Extrae parámetros limpios (ProcessType, LoggedUser, etc.).
 * - Ejecuta el handler específico y normaliza la respuesta (OK/FAIL).
 */
function wrapOperation({ req, method, api, process, handler }) {
  // ---- Bitácora + estructura DATA para este paso ----
  let bitacora = BITACORA();
  let data = DATA();

  // ====== Parametría obligatoria (tu estilo) ======
  //  obtener ProcessType de la query
  let ProcessType = req.req?.query?.ProcessType;
  //  usuario logueado (query limpia)
  const { LoggedUser } = req.req?.query || {};
  //  todos los query params tal cual
  const params = req.req?.query || {};
  //  query params serializados (k=v&k2=v2)
  const paramString = req.req?.query ? new URLSearchParams(req.req.query).toString().trim() : '';
  //  body para creates/updates
  const body = req.req?.body;

  //  rellenar bitácora con datos de contexto
  bitacora.loggedUser = LoggedUser || bitacora.loggedUser || '';
  bitacora.processType = ProcessType || bitacora.processType || '';

  // nombre de proceso visible y metadatos base
  bitacora.process = process;
  data.method = method;
  data.api = api;

  // ===== Envolver toda la operación como promesa =====
  return new Promise((resolve) => {
    // Ejecuta handler específico ya con la request
    Promise.resolve()
      .then(() => handler({ params, paramString, body, ProcessType, LoggedUser }))
      .then((result) => {
        // Éxito → registrar en bitácora
        data.status = method === 'CREATE' ? 201 : 200;
        data.messageUSR = 'Operación realizada con éxito.';
        data.messageDEV = `OK ${api}`;
        data.dataRes = result;
        AddMSG(bitacora, data, 'OK', data.status, true);

        // Devolver respuesta OK normalizada
        return resolve(OK(bitacora));
      })
      .catch((err) => {
        // Error controlado/inesperado → FAIL
        data.status = err?.status || 500;
        data.messageUSR = err?.messageUSR || 'La operación no se pudo completar.';
        data.messageDEV = err?.message || String(err);
        data.dataRes = { error: err?.stack || String(err) };
        AddMSG(bitacora, data, 'FAIL', data.status, true);
        // Respuesta FAIL normalizada
        return resolve(FAIL(bitacora));
      });
  });
}

/**
 * Enunciado: Registra handlers CRUD (READ/CREATE/UPDATE/DELETE) para una entidad CDS,
 * usando un Model de Mongoose. Mantiene hooks opcionales uniqueCheck/beforeCreate/beforeUpdate.
 */
function registerCRUD(srv, cdsEntity, Model, opts = {}) {
  const { uniqueCheck, beforeCreate, beforeUpdate } = opts;

  // ----------------------
  // READ
  // ----------------------
  srv.on('READ', cdsEntity, (req) => {
    // Si viene key OData → detalle, si no → listado (con filtros simples por query).
    return wrapOperation({
      req,
      method: 'READ',
      api: `READ ${cdsEntity.name}`,
      process: `Lectura de ${cdsEntity.name}`,
      handler: ({ params }) => {
        // 1) Si llega ID por OData (req.data.ID) → GetOne
        if (req.data && req.data.ID) {
          const id = req.data.ID;
          // validamos formato ObjectId
          if (!isValidObjectId(id)) {
            const e = new Error('ID inválido'); e.status = 400; throw e;
          }
          // buscar y mapear a respuesta CDS
          return Model.findById(id)
            .then((doc) => {
              if (!doc) { const e = new Error('No encontrado'); e.status = 404; throw e; }
              return [mapOut(doc)]; // OData espera array
            });
        }

        // 2) Listado con filtros simples: tomar de query todos excepto control y OData
        const control = new Set(['ProcessType', 'LoggedUser', '$top', '$skip']);
        const filter = Object.fromEntries(
          Object.entries(params || {}).filter(([k]) => !control.has(k))
        );

        // 3) Paginación OData
        const { top, skip } = readQueryBounds(req);

        // 4) Ejecutar consulta
        let q = Model.find(filter);
        if (skip) q = q.skip(skip);
        if (top) q = q.limit(top);

        return q.then((docs) => docs.map(mapOut));
      }
    });
  });

  // ----------------------
  // CREATE
  // ----------------------
  srv.on('CREATE', cdsEntity, (req) => {
    return wrapOperation({
      req,
      method: 'CREATE',
      api: `CREATE ${cdsEntity.name}`,
      process: `Creación de ${cdsEntity.name}`,
      handler: () => {
        // hook previo opcional
        return Promise.resolve()
          .then(() => beforeCreate ? Promise.resolve(beforeCreate(req)) : null)
          .then(() => uniqueCheck ? Promise.resolve(uniqueCheck(req)) : null)
          // insertar usando mapIn para ignorar ID
          .then(() => Model.create(mapIn(req.data)))
          .then((created) => mapOut(created));
      }
    });
  });

  // ----------------------
  // UPDATE
  // ----------------------
  srv.on('UPDATE', cdsEntity, (req) => {
    return wrapOperation({
      req,
      method: 'UPDATE',
      api: `UPDATE ${cdsEntity.name}`,
      process: `Actualización de ${cdsEntity.name}`,
      handler: () => {
        // validar ID requerido y formato
        if (!req.data.ID) { const e = new Error('ID requerido'); e.status = 400; throw e; }
        if (!isValidObjectId(req.data.ID)) { const e = new Error('ID inválido'); e.status = 400; throw e; }

        // hook previo opcional
        return Promise.resolve()
          .then(() => beforeUpdate ? Promise.resolve(beforeUpdate(req)) : null)
          // actualizar y devolver mapeado
          .then(() =>
            Model.findByIdAndUpdate(req.data.ID, mapIn(req.data), { new: true, runValidators: true })
          )
          .then((updated) => {
            if (!updated) { const e = new Error('No encontrado'); e.status = 404; throw e; }
            return mapOut(updated);
          });
      }
    });
  });

  // ----------------------
  // DELETE
  // ----------------------
  srv.on('DELETE', cdsEntity, (req) => {
    return wrapOperation({
      req,
      method: 'DELETE',
      api: `DELETE ${cdsEntity.name}`,
      process: `Eliminación de ${cdsEntity.name}`,
      handler: () => {
        // validar ID requerido y formato
        if (!req.data.ID) { const e = new Error('ID requerido'); e.status = 400; throw e; }
        if (!isValidObjectId(req.data.ID)) { const e = new Error('ID inválido'); e.status = 400; throw e; }

        // borrar y responder estándar
        return Model.findByIdAndDelete(req.data.ID)
          .then((deleted) => {
            if (!deleted) { const e = new Error('No encontrado'); e.status = 404; throw e; }
            return { deleted: true, ID: req.data.ID };
          });
      }
    });
  });
}

// Export principal
module.exports = { registerCRUD };
