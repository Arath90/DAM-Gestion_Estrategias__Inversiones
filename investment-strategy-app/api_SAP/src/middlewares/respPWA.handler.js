//src/middlewares/respPWA.handler.js
const { whatTypeVarIs } = require('../helpers/variables');
// TODO---> !agregar processType!
const BITACORA = () => ({
  success: false,
  status: 0,
  process: '',
  processType: '',
  messageUSR: '',
  messageDEV: '',
  countData: 0,
  countDataReq: 0,
  countDataRes: 0,
  countMsgUSR: 0,
  countMsgDEV: 0,
  dbServer: '',
  server: '',
  data: [],
  session: '',
  loggedUser: '',
  finalRes: false
});

const DATA = () => ({
  success: false,
  status: 0,
  process: '',
  principal: false,
  secuencia: 0,
  countDataReq: 0,
  countDataRes: 0,
  countFile: 0,
  messageUSR: '',
  messageDEV: '',
  method: '',
  api: '',
  dataReq: [],
  dataRes: [],
  file: []
});

const AddMSG = (bitacora, data, tipo, status = 500, principal = false) => {
  if (tipo === 'OK') { data.success = true; bitacora.success = true; }
  else { data.success = false; bitacora.success = false; }

  data.status = data.status || status;
  data.process = data.process || 'No Especificado';
  data.principal = data.principal || principal;
  data.method = data.method || 'No Especificado';
  data.api = data.api || 'No Especificado';
  data.secuencia++;

  if (data.messageDEV) { bitacora.messageDEV = data.messageDEV; bitacora.countMsgDEV++; }
  if (data.messageUSR) { bitacora.messageUSR = data.messageUSR; bitacora.countMsgUSR++; }

  if (data.dataReq) {//si dataReq existe y no es nulo y no es indefinido entonces 
    if (whatTypeVarIs(data.dataReq) === 'isArray') data.countDataReq = data.dataReq.length;//si es un array entonces contamos su longitud y la asignamos a countDataReq
    else if (whatTypeVarIs(data.dataReq) === 'isObject') data.countDataReq = 1;
    else data.countDataReq = 0;
    bitacora.countDataReq++;
  }

  if (data.dataRes) {
    if (whatTypeVarIs(data.dataRes) === 'isArray') data.countDataRes = data.dataRes.length;
    else if (whatTypeVarIs(data.dataRes) === 'isObject') data.countDataRes = 1;
    else data.countDataRes = 0;
    bitacora.countDataRes++;
  }

  if (data.file) {
    if (whatTypeVarIs(data.countFile) === 'isArray') data.countFile = data.countFile.length;
    else if (whatTypeVarIs(data.countFile) === 'isObject') data.countFile = 1;
    else data.countFile = 0;
  }

  bitacora.status = data.status;
  bitacora.data.push(data);
  bitacora.countData++;

  return bitacora;
};

const OK = (bitacora) => {
  if (!bitacora.dbServer) bitacora.dbServer = process.env.MONGO_INV_DB || process.env.DATABASE || 'Default';
  return {
    success: bitacora.success || true,
    status: bitacora.status || 200,
    process: bitacora.process || 'No Especificado',
    messageUSR: bitacora.messageUSR || 'OK',
    messageDEV: bitacora.messageDEV || '',
    countData: bitacora.countData || 0,
    countDataReq: bitacora.countDataReq || 0,
    countDataRes: bitacora.countDataRes || 0,
    countMsgUSR: bitacora.countMsgUSR || 0,
    countMsgDEV: bitacora.countMsgDEV || 0,
    dbServer: bitacora.dbServer || 'Default',
    server: bitacora.server || 'Default',
    data: bitacora.data || [],
    session: bitacora.session || 'No Especificado',
    loggedUser: bitacora.loggedUser || 'No Especificado',
    finalRes: true
  };
};

const FAIL = (bitacora) => {
  if (!bitacora.dbServer) bitacora.dbServer = process.env.MONGO_INV_DB || process.env.DATABASE || 'Default';
  return {
    success: false,
    status: bitacora.status || 500,
    process: bitacora.process || 'No Especificado',
    messageUSR: bitacora.messageUSR || 'Ocurrió un error.',
    messageDEV: bitacora.messageDEV || 'No Especificado',
    countData: bitacora.countData || 0,
    countDataReq: bitacora.countDataReq || 0,
    countDataRes: bitacora.countDataRes || 0,
    countMsgUSR: bitacora.countMsgUSR || 0,
    countMsgDEV: bitacora.countMsgDEV || 0,
    dbServer: bitacora.dbServer || 'Default',
    server: bitacora.server || 'Default',
    data: bitacora.data || [],
    session: bitacora.session || 'No Especificado',
    loggedUser: bitacora.loggedUser || 'No Especificado',
    finalRes: true
  };
};

module.exports = { BITACORA, DATA, AddMSG, OK, FAIL };
