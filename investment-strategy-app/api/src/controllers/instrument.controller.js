//este archivo contiene los controladores para manejar las operaciones CRUD de los instrumentos financieros
//utilizando Mongoose y Boom para el manejo de errores.
//se exportan funciones para obtener todos los instrumentos, obtener un instrumento por ID y crear un nuevo instrumento.
//estas funciones manejan las solicitudes HTTP y responden con los datos o errores correspondientes.
//se asume que el modelo Instrument ya está definido en ../models/instrument.js
import Instrument from '../models/instrument.js';
import boom from '@hapi/boom';
//
export const getInstruments = async (req, res, next) => {//funcion para obtener todos los instrumentos
  try {
    const instruments = await Instrument.find();
    if (!instruments) throw boom.notFound('No se encontraron instrumentos.');
    res.status(200).json(instruments);
  } catch (error) {
    next(error);
  }
};

export const getInstrumentById = async (req, res, next) => {//funcion para obtener un instrumento por su ID
  try {
    const { id } = req.params;
    const instrument = await Instrument.findById(id);
    if (!instrument) throw boom.notFound('Instrumento no encontrado.');
    res.status(200).json(instrument);
  } catch (error) {
    next(error);
  }
};

export const createInstrument = async (req, res, next) => {//funcion para crear un nuevo instrumento con post
  try {
    const newInstrument = await Instrument.create(req.body);
    if (!newInstrument) throw boom.badRequest('No se pudo crear el instrumento.');
    res.status(201).json(newInstrument);
  } catch (error) {
    next(error);
  }
};