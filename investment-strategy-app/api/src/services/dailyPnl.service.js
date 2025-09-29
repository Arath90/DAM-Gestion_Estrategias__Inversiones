import boom from '@hapi/boom';
import DailyPnl from '../models/dailyPnl.js';

export const getDailyPnlList = async () => {
  try { return await DailyPnl.find().sort({ date: -1 }); }
  catch (err) { throw boom.internal(err); }
};

export const getDailyPnlItem = async (id) => {
  try { return await DailyPnl.findById(id); }
  catch (err) { throw boom.internal(err); }
};

export const postDailyPnlItem = async (data) => {
  try { return await (new DailyPnl(data)).save(); }
  catch (err) { throw err; }
};

export const putDailyPnlItem = async (id, data) => {
  try {
    return await DailyPnl.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (err) { throw boom.internal(err); }
};

export const deleteDailyPnlItem = async (id) => {
  try { return await DailyPnl.findByIdAndDelete(id); }
  catch (err) { throw boom.internal(err); }
};
