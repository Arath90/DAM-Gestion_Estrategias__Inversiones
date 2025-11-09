// RSI clásico (Wilder). Fuente: close por defecto.
// Devuelve un array con valores RSI alineados a la longitud de candles (nulls iniciales).
function computeRSI(candles, { period = 14, source = 'close' } = {}) {
    // Validaciones básicas si el input es correcto o lo suficientemente largo retornar un array vacío
  if (!Array.isArray(candles) || candles.length < period + 2) return [];

  // Extraer los precios de cierre (u otro source)
  const closes = candles.map(c => c[source] ?? c.close);
  const out = new Array(closes.length).fill(null);

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + (avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    // Wilder smoothing
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }

  return out; // array alineado a candles.length (con nulls iniciales)
}

module.exports = { computeRSI };
