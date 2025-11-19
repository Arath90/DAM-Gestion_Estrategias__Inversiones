/**
 * Genera eventos/alertas a partir de MACD:
 *  - macd_cross_up / macd_cross_down: cruces MACD vs signal
 *  - macd_zero_up / macd_zero_down: cruces de la línea MACD con el eje 0
 *  - macd_hist_flip_up / macd_hist_flip_down: cambio de signo en el histograma
 *
 * Recibe:
 *  - macdLine:   number[]
 *  - signalLine: number[]
 *  - histogram:  number[]
 *  - candles:    velas originales (para time)
 *
 * Devuelve array de objetos { index, time, type, macd, signal, hist }.
 */
function macdAlerts({ macdLine = [], signalLine = [], histogram = [], candles = [] }) {
  const alerts = [];
  const n = macdLine.length;
  if (!n || !signalLine.length) return alerts;

  for (let i = 1; i < n; i++) {
    const macdPrev = macdLine[i - 1];
    const macdCur = macdLine[i];
    const sigPrev = signalLine[i - 1];
    const sigCur = signalLine[i];
    const histPrev = histogram[i - 1];
    const histCur = histogram[i];

    const time = candles[i]?.time ?? candles[i]?.ts ?? null;

    if (
      Number.isFinite(macdPrev) &&
      Number.isFinite(macdCur) &&
      Number.isFinite(sigPrev) &&
      Number.isFinite(sigCur)
    ) {
      // Cruce MACD vs signal
      if (macdPrev <= sigPrev && macdCur > sigCur) {
        alerts.push({
          index: i,
          time,
          type: 'macd_cross_up',
          macd: macdCur,
          signal: sigCur,
          hist: histCur,
        });
      }
      if (macdPrev >= sigPrev && macdCur < sigCur) {
        alerts.push({
          index: i,
          time,
          type: 'macd_cross_down',
          macd: macdCur,
          signal: sigCur,
          hist: histCur,
        });
      }

      // Cruces por el eje 0 (cambio de sesgo)
      if (macdPrev <= 0 && macdCur > 0) {
        alerts.push({
          index: i,
          time,
          type: 'macd_zero_up',
          macd: macdCur,
          signal: sigCur,
          hist: histCur,
        });
      }
      if (macdPrev >= 0 && macdCur < 0) {
        alerts.push({
          index: i,
          time,
          type: 'macd_zero_down',
          macd: macdCur,
          signal: sigCur,
          hist: histCur,
        });
      }
    }

    // Flip del histograma (cambio de momentum)
    if (Number.isFinite(histPrev) && Number.isFinite(histCur)) {
      if (histPrev <= 0 && histCur > 0) {
        alerts.push({
          index: i,
          time,
          type: 'macd_hist_flip_up',
          macd: macdCur,
          signal: sigCur,
          hist: histCur,
        });
      }
      if (histPrev >= 0 && histCur < 0) {
        alerts.push({
          index: i,
          time,
          type: 'macd_hist_flip_down',
          macd: macdCur,
          signal: sigCur,
          hist: histCur,
        });
      }
    }
  }

  return alerts;
}

module.exports = { macdAlerts };
