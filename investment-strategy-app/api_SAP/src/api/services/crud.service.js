/**
 * Servicio CRUD (MongoDB + SAP CDS)
 * ---------------------------------------------------------------------------
 * - BD por defecto: "mongo"
 * - Switch por dbServer (mongo | hana)
 * - ID extraíble desde: req.data.ID / req.req.query / req.req.params
 * - Requiere siempre: ProcessType (excepto para pruebas internas)
 * - Manejo robusto de errores con mensajes explícitos
 */

const mongoose = require('mongoose');
const cds = require('@sap/cds');
const { BITACORA, DATA, AddMSG, OK, FAIL } = require('../../middlewares/respPWA.handler');

// =====================
// Helpers utilitarios
// =====================

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && mongoose.isValidObjectId(id);
}

const mapOut = (doc) => {
  const o = doc?.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = o || {};
  return { ID: _id?.toString?.(), ...rest };
};

const mapIn = (data) => {
  const { ID, ...rest } = data || {};
  return rest;
};

function readQueryBounds(req) {
  const top = Number(req._query?.$top ?? 0);
  const skip = Number(req._query?.$skip ?? 0);
  return { top, skip };
}

function extractId(req) {
  return req?.data?.ID ||
    req?.req?.params?.ID ||
    req?.req?.params?.id ||
    req?.req?.query?.ID ||
    req?.req?.query?.id ||
    null;
}
const isStrict = ['true', '1', 'yes', 'on'].includes(String(process.env.STRICT_HTTP_ERRORS || '').toLowerCase());

// =====================
// Núcleo: wrapOperation
// =====================

function wrapOperation({ req, method, api, process, handler }) {
  const bitacora = BITACORA();
  const data = DATA();

  const expressReq = req.req || {};
  const ProcessType = expressReq.query?.ProcessType;
  const LoggedUser = expressReq.query?.LoggedUser || expressReq.headers?.['x-logged-user'] || '';
  const dbServerRaw = req.catalogDbTarget || expressReq.query?.dbServer || expressReq.query?.db || 'mongo';
  const dbServer = String(dbServerRaw || 'mongo').toLowerCase();
  const idParam = extractId(req);

  bitacora.loggedUser = LoggedUser || '';
  bitacora.processType = ProcessType || '';
  bitacora.dbServer = dbServer;
  bitacora.process = process;
  data.method = method;
  data.api = api;

  return new Promise((resolve) => {
    Promise.resolve()
      .then(() => {
        // ProcessType obligatorio
        if (!ProcessType) {
          const e = new Error('Missing query param: ProcessType');
          e.status = 400;
          e.messageUSR = 'Debe especificar el tipo de proceso (ProcessType).';
          e.messageDEV = 'Missing query param: ProcessType';
          throw e;
        }
      })
      .then(() => handler({ dbServer, idParam }))
      .then((result) => {
        data.status = method === 'CREATE' ? 201 : 200;
        data.messageUSR = 'Operación realizada con éxito.';
        data.messageDEV = `OK ${api} [db:${dbServer}]`;
        data.dataRes = result;
        AddMSG(bitacora, data, 'OK', data.status, true);
        return resolve(OK(bitacora));
      })
      .catch((err) => {
        const status = err?.status || 500;
        data.status = status;
        data.messageUSR = err?.messageUSR || (status >= 500 ? 'Ocurrió un error interno.' : 'La operación no se pudo completar.');
        data.messageDEV = err?.messageDEV || err?.message || String(err);
        data.dataRes = { error: err?.stack || String(err) };
        AddMSG(bitacora, data, 'FAIL', status, true);

        if (isStrict && typeof req.error === 'function') {
          try {
            req.error({
              code: status >= 500 ? 'Internal-Server-Error' : 'Bad-Request',
              status,
              message: data.messageUSR,
              target: data.messageDEV,
              '@Common.numericSeverity': status >= 500 ? 4 : 2,
              details: [{ message: data.messageDEV }],
            });
            return resolve();
          } catch (_) {
            // si falla req.error, continuamos al fallback
          }
        }
        return resolve(FAIL(bitacora));
      });

  });
}

// =====================
// CRUD principal
// =====================
function registerCRUD(srv, cdsEntity, Model, opts = {}) {
  const { uniqueCheck, beforeCreate, beforeUpdate } = opts;
  const { SELECT, INSERT, UPDATE, DELETE } = cds;

  // Métodos MongoDB
  const findByIdMongo = (id) =>
    Model.findById(id).then(doc => doc || Model.findOne({ $expr: { $eq: [{ $toString: '$_id' }, id] } }));

  const updateByIdMongo = (id, payload) =>
    Model.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .then(doc => doc || Model.findOneAndUpdate({ $expr: { $eq: [{ $toString: '$_id' }, id] } }, payload, { new: true, runValidators: true }));

  const deleteByIdMongo = (id) =>
    Model.findByIdAndDelete(id).then(doc => doc || Model.findOneAndDelete({ $expr: { $eq: [{ $toString: '$_id' }, id] } }));


  // ---------------------- READ ----------------------
  srv.on('READ', cdsEntity, (req) => wrapOperation({
    req, method: 'READ', api: `READ ${cdsEntity.name}`, process: `Lectura de ${cdsEntity.name}`,ProcessType: `getAll`,
    handler: ({ dbServer, idParam }) => {
      switch (dbServer) {
        case 'hana': {
          const { top, skip } = readQueryBounds(req);
          let query = SELECT.from(cdsEntity.name);
          if (idParam) query.where({ ID: idParam });
          if (top) query.limit(top);
          if (skip) query.offset(skip);
          return cds.run(query).then(rows => {
            if (!rows || (Array.isArray(rows) && rows.length === 0)) {
              const e = new Error('No encontrado'); e.status = 404; throw e;
            }
            return Array.isArray(rows) ? rows : [rows];
          });
        }

        case 'mongo':
        default: {
          if (idParam) {
            if (!isValidObjectId(idParam)) {
              const e = new Error('ID inválido'); e.status = 400; throw e;
            }
            return findByIdMongo(idParam).then(doc => {
              if (!doc) { const e = new Error('No encontrado'); e.status = 404; throw e; }
              return [mapOut(doc)];
            });
          }

          const control = new Set(['ProcessType', 'LoggedUser', '$top', '$skip', 'dbServer', 'db']);
          const filter = Object.fromEntries(Object.entries(req.req?.query || {}).filter(([k]) => !control.has(k)));
          const { top, skip } = readQueryBounds(req);
          let q = Model.find(filter);
          if (skip) q = q.skip(skip);
          if (top) q = q.limit(top);
          return q.then(docs => docs.map(mapOut));
        }
      }
    }
  }));

  // ---------------------- CREATE ----------------------
  srv.on('CREATE', cdsEntity, (req) => wrapOperation({
    req, method: 'CREATE', api: `CREATE ${cdsEntity.name}`, process: `Creación de ${cdsEntity.name}`,
    handler: ({ dbServer }) => {
      const payload = mapIn(req.data);
      if (!payload || Object.keys(payload).length === 0) {
        const e = new Error('Body vacío'); e.status = 400; throw e;
      }

      switch (dbServer) {
        case 'hana':
          return Promise.resolve()
            .then(() => beforeCreate ? beforeCreate(req) : null)
            .then(() => uniqueCheck ? uniqueCheck(req) : null)
            .then(() => cds.run(INSERT.into(cdsEntity.name).entries(payload)));

        case 'mongo':
        default:
          return Promise.resolve()
            .then(() => beforeCreate ? beforeCreate(req) : null)
            .then(() => uniqueCheck ? uniqueCheck(req) : null)
            .then(() => Model.create(payload))
            .then(created => mapOut(created));
      }
    }
  }));

  // ---------------------- UPDATE ----------------------
  srv.on('UPDATE', cdsEntity, (req) => wrapOperation({
    req, method: 'UPDATE', api: `UPDATE ${cdsEntity.name}`, process: `Actualización de ${cdsEntity.name}`,
    handler: ({ dbServer, idParam }) => {
      const idToUse = idParam || req.data?.ID;
      if (!idToUse) { const e = new Error('ID requerido'); e.status = 400; throw e; }

      switch (dbServer) {
        case 'hana':
          return Promise.resolve()
            .then(() => beforeUpdate ? beforeUpdate(req) : null)
            .then(() => cds.run(UPDATE(cdsEntity.name).set(mapIn(req.data)).where({ ID: idToUse })))
            .then(() => cds.run(SELECT.from(cdsEntity.name).where({ ID: idToUse })))
            .then(rows => Array.isArray(rows) ? rows[0] : rows);

        case 'mongo':
        default:
          if (!isValidObjectId(idToUse)) { const e = new Error('ID inválido'); e.status = 400; throw e; }
          return Promise.resolve()
            .then(() => beforeUpdate ? beforeUpdate(req) : null)
            .then(() => updateByIdMongo(idToUse, mapIn(req.data)))
            .then(updated => {
              if (!updated) { const e = new Error('No encontrado'); e.status = 404; throw e; }
              return mapOut(updated);
            });
      }
    }
  }));

  // ---------------------- DELETE ----------------------
  srv.on('DELETE', cdsEntity, (req) => wrapOperation({
    req, method: 'DELETE', api: `DELETE ${cdsEntity.name}`, process: `Eliminación de ${cdsEntity.name}`,
    handler: ({ dbServer, idParam }) => {
      const idToUse = idParam || req.data?.ID;
      if (!idToUse) { const e = new Error('ID requerido'); e.status = 400; throw e; }

      switch (dbServer) {
        case 'hana':
          return cds.run(DELETE.from(cdsEntity.name).where({ ID: idToUse }))
            .then(res => ({ deleted: true, ID: idToUse, result: res }));

        case 'mongo':
        default:
          if (!isValidObjectId(idToUse)) { const e = new Error('ID inválido'); e.status = 400; throw e; }
          return deleteByIdMongo(idToUse).then(deleted => {
            if (!deleted) { const e = new Error('No encontrado'); e.status = 404; throw e; }
            return { deleted: true, ID: idToUse };
          });
      }
    }
  }));
}

module.exports = { registerCRUD };
