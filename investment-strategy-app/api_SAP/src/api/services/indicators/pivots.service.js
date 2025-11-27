// src/api/services/indicators/pivots.service.js
// ----------------------------------------------------
// Servicio: Detección de pivotes locales (máximos y mínimos) en una serie numérica.
// ----------------------------------------------------
//
// Un "pivote" es un punto donde el valor actual de una serie (por ejemplo, el precio o el RSI)
// es mayor o menor que sus vecinos dentro de una ventana de análisis.
//
// • Máximo local (High Pivot): el valor actual es mayor que los L valores a la izquierda y derecha.
// • Mínimo local (Low Pivot): el valor actual es menor que los L valores a la izquierda y derecha.
//
// Esta detección se utiliza como base para encontrar patrones técnicos,
// como las divergencias entre precio y RSI o los soportes/resistencias locales.
//
// ----------------------------------------------------
// Ejemplo visual:
//
//  Índices:   0   1   2   3   4   5   6
//  Valores: [ 2,  5,  7,  4,  6,  3,  2 ]
//                 ↑       ↑
//                High    Low
// ----------------------------------------------------

/**
 * Detecta pivotes (máximos y mínimos) en una serie numérica.
 *
 * @param {Array<number>} series - Serie numérica (por ejemplo precios o RSI)
 * @param {Object} options
 * @param {number} [options.swingLen=3] - Cantidad de elementos a comparar a la izquierda y derecha.
 *
 * @returns {Object} { highs: Array<{idx,val}>, lows: Array<{idx,val}> }
 * - highs: lista de picos o máximos locales
 * - lows:  lista de valles o mínimos locales
 */
function findPivots(series, { swingLen = 3 }) {
  const highs = [];  // almacenará los máximos detectados
  const lows  = [];  // almacenará los mínimos detectados
  const n = series.length;
  const L = Math.max(1, swingLen); // asegura que la ventana sea al menos de 1

  // Recorre la serie ignorando los primeros y últimos L elementos
  // (ya que no tienen suficientes vecinos a los lados para comparar)
  for (let i = L; i < n - L; i++) {
    const v = series[i]; // valor actual
    if (v == null) continue; // ignora valores vacíos o undefined

    // Flags para identificar si el punto actual es un máximo o un mínimo
    let isHigh = true, isLow = true;

    // Compara el valor actual con sus vecinos dentro de la ventana L
    for (let k = 1; k <= L; k++) {

      // Si los vecinos son nulos, el punto no es válido
      if (series[i - k] == null || series[i + k] == null) {
        isHigh = isLow = false;
        break;
      }

      // Condición para máximo local:
      // si algún vecino es mayor o igual, ya no es máximo
      if (series[i - k] >= v || series[i + k] >= v)
        isHigh = false;

      // Condición para mínimo local:
      // si algún vecino es menor o igual, ya no es mínimo
      if (series[i - k] <= v || series[i + k] <= v)
        isLow = false;

      // Si ambas condiciones fallan, no hace falta seguir comparando
      if (!isHigh && !isLow) break;
    }

    // Si el valor cumple condición de máximo, se agrega a la lista de highs
    if (isHigh)
      highs.push({ idx: i, val: v });

    // Si cumple condición de mínimo, se agrega a la lista de lows
    if (isLow)
      lows.push({ idx: i, val: v });
  }

  // Retorna ambos conjuntos de pivotes encontrados
  return { highs, lows };
}

// Exporta la función para uso en otros servicios (como divergence.service.js)
module.exports = { findPivots };
