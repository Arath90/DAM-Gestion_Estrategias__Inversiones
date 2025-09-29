import mongoose from 'mongoose';

const riskLimitSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, unique: true, trim: true },
    max_daily_loss: { type: Number, required: true, min: 0 },
    max_position_value: { type: Number, required: true, min: 0 },
    max_order_size: { type: Number, required: true, min: 0 },
    max_gamma: { type: Number, required: true },
    max_vega: { type: Number, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

riskLimitSchema.index({ account: 1 }, { unique: true });

const RiskLimit = mongoose.model('RiskLimit', riskLimitSchema);
export default RiskLimit;
