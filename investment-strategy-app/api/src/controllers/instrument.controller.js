import Instrument from '../models/instrument.js';
import boom from '@hapi/boom';

export const getInstruments = async (req, res, next) => {
  try {
    const instruments = await Instrument.find();
    if (!instruments) throw boom.notFound('No se encontraron instrumentos.');
    res.status(200).json(instruments);
  } catch (error) {
    next(error);
  }
};

export const getInstrumentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const instrument = await Instrument.findById(id);
    if (!instrument) throw boom.notFound('Instrumento no encontrado.');
    res.status(200).json(instrument);
  } catch (error) {
    next(error);
  }
};

export const createInstrument = async (req, res, next) => {
  try {
    const newInstrument = await Instrument.create(req.body);
    if (!newInstrument) throw boom.badRequest('No se pudo crear el instrumento.');
    res.status(201).json(newInstrument);
  } catch (error) {
    next(error);
  }
};