import mongoose from 'mongoose';

const dailyPnlSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, trim: true }, // cuenta del broker
    date: { type: Date, required: true },                  // día (UTC) del PnL
    realized_pnl: { type: Number, required: true, default: 0 },
    unrealized_pnl: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Un registro por (account, date)
dailyPnlSchema.index({ account: 1, date: 1 }, { unique: true });
dailyPnlSchema.index({ date: -1 });

const DailyPnl = mongoose.model('DailyPnl', dailyPnlSchema);
export default DailyPnl;
