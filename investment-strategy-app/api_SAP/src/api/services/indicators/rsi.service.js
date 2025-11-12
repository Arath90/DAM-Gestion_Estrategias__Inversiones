// src/api/services/indicators/rsi.service.js
// -----------------------------------------------------------
// Servicio: Cálculo del RSI (Relative Strength Index) clásico de Wilder.
// -----------------------------------------------------------
//
// El RSI mide la fuerza relativa de los movimientos alcistas y bajistas
// dentro de un periodo determinado, devolviendo un valor entre 0 y 100.
//
// • Valores > 70–80  → zona de sobrecompra (precio extendido al alza)
// • Valores < 30–20  → zona de sobreventa (precio extendido a la baja)
//
// Este indicador es la base para detectar divergencias y cambios de momentum.
//
// Fórmula base:
//
//   RSI = 100 - (100 / (1 + RS))
//   RS  = (Promedio Ganancias / Promedio Pérdidas)
//
// Donde los promedios son suavizados usando el método de Wilder
// (similar a una media móvil exponencial).
//
// -----------------------------------------------------------
// Ejemplo rápido:
//   period = 14
//   source = 'close'
//
//   computeRSI(candles) → [null, null, ..., 45.8, 52.3, 67.1, ...]
// -----------------------------------------------------------

/**
 * Calcula el RSI clásico (método de Wilder) sobre una serie de velas.
 *
 * @param {Array<Object>} candles - Serie de velas con campos de precio (ej. close, open, etc.)
 * @param {Object} options
 * @param {number} [options.period=14] - Periodo de cálculo (número de velas).
 * @param {string} [options.source='close'] - Campo de la vela que se usará para el cálculo.
 *
 * @returns {Array<number|null>} Array de valores RSI, alineado con la longitud de candles.
 * Los primeros valores son `null` porque no hay suficientes datos para calcular el RSI.
 */
function computeRSI(candles, { period = 14, source = 'close' } = {}) {
  // -----------------------------------------------------------
  // Validaciones básicas
  // Si no se pasa un array válido o es demasiado corto,
  // se devuelve un array vacío.
  // -----------------------------------------------------------
  if (!Array.isArray(candles) || candles.length < period + 2) return [];

  // -----------------------------------------------------------
  // Extrae los precios de cierre (o del campo "source" especificado)
  // -----------------------------------------------------------
  const closes = candles.map(c => c[source] ?? c.close);

  // Array de salida (rellenado inicialmente con nulls)
  const out = new Array(closes.length).fill(null);

  // -----------------------------------------------------------
  // Paso 1: Calcular las ganancias y pérdidas iniciales
  // (usadas para el primer promedio de 14 velas)
  // -----------------------------------------------------------
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1]; // cambio entre velas consecutivas
    if (ch >= 0) gain += ch;              // acumula ganancias
    else loss -= ch;                      // acumula pérdidas (convertidas a positivas)
  }

  // Promedios iniciales de ganancias y pérdidas
  let avgGain = gain / period;
  let avgLoss = loss / period;

  // Cálculo del primer valor de RSI disponible
  out[period] = avgLoss === 0
    ? 100                                   // Si no hubo pérdidas → RSI = 100
    : 100 - 100 / (1 + (avgGain / avgLoss)); // Fórmula RSI

  // -----------------------------------------------------------
  // Paso 2: Aplicar el suavizado de Wilder
  // -----------------------------------------------------------
  // Cada nuevo valor de RSI reutiliza el promedio anterior,
  // suavizando los resultados para evitar saltos bruscos.
  // -----------------------------------------------------------
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1]; // variación actual

    // Determina ganancia y pérdida del candle actual
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;

    // Fórmulas de suavizado de Wilder:
    // nuevo_promedio = ((promedio_anterior * (period - 1)) + nuevo_valor) / period
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;

    // Cálculo de RS (Relative Strength)
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;

    // Cálculo de RSI
    out[i] = 100 - 100 / (1 + rs);
  }

  // -----------------------------------------------------------
  // Devuelve el array completo, alineado con la longitud de candles
  // (los primeros elementos son null por falta de datos)
  // -----------------------------------------------------------
  return out;
}

// Exporta la función para ser usada en otros servicios (divergence, alerts, etc.)
module.exports = { computeRSI };

// | Etapa                      | Descripción                                                          |
// | -------------------------- | -------------------------------------------------------------------- |
// | **1. Extracción**          | Se toma la serie de precios (`close` por defecto).                   |
// | **2. Cálculo inicial**     | Se obtienen las ganancias y pérdidas de las primeras `period` velas. |
// | **3. Promedios iniciales** | Se calculan los promedios simples de ganancia y pérdida.             |
// | **4. Suavizado de Wilder** | Cada nuevo candle ajusta el promedio anterior suavemente.            |
// | **5. Cálculo RSI**         | `RSI = 100 - (100 / (1 + (AvgGain / AvgLoss)))`.                     |
