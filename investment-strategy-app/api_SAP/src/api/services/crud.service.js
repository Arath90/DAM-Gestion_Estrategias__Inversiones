const cds = require('@sap/cds');
const mongoose = require('mongoose');

const isValidObjectId = (id) =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && mongoose.isValidObjectId(id);

const mapOut = (doc) => {
  const o = doc?.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = o || {};
  return { ID: _id?.toString?.(), ...rest };
};
const mapIn = (data) => { const { ID, ...rest } = data || {}; return rest; };

// Mapea errores típicos de Mongo a HTTP legibles
function normalizeMongoError(err) {
  if (!err) return err;
  if (err?.name === 'ValidationError') { err.status = 400; return err; }
  if (err?.code === 11000) { // duplicate key
    err.status = 409;
    err.message = `Duplicate key: ${JSON.stringify(err.keyValue || {})}`;
    return err;
  }
  return err;
}

function makeCrudHandlers(cdsEntity, Model, opts = {}) {
  const { uniqueCheck, beforeCreate, beforeUpdate } = opts;
  const { SELECT, INSERT, UPDATE, DELETE } = cds;

  const findByIdMongo = (id) =>
    Model.findById(id).then(doc => doc || Model.findOne({ $expr: { $eq: [{ $toString: '$_id' }, id] } }));

  return {
    async READ(ctx) {
      const { db, id, top = 0, skip = 0, filter = {}, orderby = null } = ctx;

      if (db === 'hana') {
        let q = SELECT.from(cdsEntity.name);
        if (id) q = q.where({ ID: id });
        if (top) q = q.limit(top);
        if (skip) q = q.offset(skip);
        if (orderby) {
          const clauses = Object.entries(orderby).map(([field, dir]) => ({ ref: [field], sort: dir === -1 ? 'desc' : 'asc' }));
          if (clauses.length) q = q.orderBy(clauses);
        }
        const rows = await cds.run(q);
        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          const e = new Error('No encontrado'); e.status = 404; throw e;
        }
        return Array.isArray(rows) ? rows : [rows];
      }

      // mongo
      if (id) {
        if (!isValidObjectId(id)) { const e = new Error('ID inválido'); e.status = 400; throw e; }
        const doc = await findByIdMongo(id);
        if (!doc) { const e = new Error('No encontrado'); e.status = 404; throw e; }
        return [mapOut(doc)];
      }

      let q = Model.find(filter);
      if (orderby) q = q.sort(orderby);
      if (skip) q = q.skip(skip);
      if (top) q = q.limit(top);
      const docs = await q;
      return docs.map(mapOut);
    },

    async CREATE(ctx) {
      const { db, body, req } = ctx;
      const payload = mapIn(body);
      if (!payload || !Object.keys(payload).length) { const e = new Error('Body vacío'); e.status = 400; throw e; }

      if (uniqueCheck) await uniqueCheck(req);
      if (beforeCreate) await beforeCreate(req);

      if (db === 'hana') {
        return cds.run(INSERT.into(cdsEntity.name).entries(payload));
      }
      try {
        const created = await Model.create(payload);
        return mapOut(created);
      } catch (err) {
        throw normalizeMongoError(err);
      }
    },

    async UPDATE(ctx) {
      const { db, id, body, req } = ctx;
      if (!id) { const e = new Error('ID requerido'); e.status = 400; throw e; }

      if (beforeUpdate) await beforeUpdate(req);

      if (db === 'hana') {
        await cds.run(UPDATE(cdsEntity.name).set(mapIn(body)).where({ ID: id }));
        const row = await cds.run(SELECT.from(cdsEntity.name).where({ ID: id }));
        return Array.isArray(row) ? row[0] : row;
      }

      if (!isValidObjectId(id)) { const e = new Error('ID inválido'); e.status = 400; throw e; }
      try {
        const updated = await Model.findByIdAndUpdate(id, mapIn(body), { new: true, runValidators: true })
                    || await Model.findOneAndUpdate({ $expr: { $eq: [{ $toString: '$_id' }, id] } }, mapIn(body), { new: true, runValidators: true });
        if (!updated) { const e = new Error('No encontrado'); e.status = 404; throw e; }
        return mapOut(updated);
      } catch (err) {
        throw normalizeMongoError(err);
      }
    },

    async DELETE(ctx) {
      const { db, id } = ctx;
      if (!id) { const e = new Error('ID requerido'); e.status = 400; throw e; }

      if (db === 'hana') {
        await cds.run(DELETE.from(cdsEntity.name).where({ ID: id }));
        return { deleted: true, ID: id };
      }

      if (!isValidObjectId(id)) { const e = new Error('ID inválido'); e.status = 400; throw e; }
      const deleted = await Model.findByIdAndDelete(id)
                  || await Model.findOneAndDelete({ $expr: { $eq: [{ $toString: '$_id' }, id] } });
      if (!deleted) { const e = new Error('No encontrado'); e.status = 404; throw e; }
      return { deleted: true, ID: id };
    },
  };
}

module.exports = { makeCrudHandlers };
