// src/api/services/indicators/rsi-alerts.service.js
// -----------------------------------------------------------
// Servicio: Generación de alertas basadas en el comportamiento del RSI.
// -----------------------------------------------------------
//
// Este módulo analiza una serie de valores RSI (Relative Strength Index)
// y genera alertas o "eventos" cuando se cruzan ciertos niveles de interés.
//
// Las alertas pueden indicar:
//  • Entrada a sobrecompra / sobreventa
//  • Cruces de niveles intermedios (preLow o 50)
//  • Salidas o confirmaciones de zonas extremas
//
// Este servicio se usa para construir señales visuales o para alimentar
// estrategias automáticas que reaccionen a los cambios de momentum.
//
// -----------------------------------------------------------
// Ejemplo visual (umbral alto=80, bajo=20):
//
// RSI:  [45, 52, 68, 81, 77, 48, 32, 18, 25, 41, 55]
// Index:  0   1   2   3   4   5   6   7   8   9  10
// Eventos detectados:
//  - i=3  → 'rsi_overbought_enter' (entra en sobrecompra)
//  - i=7  → 'rsi_oversold_enter'  (entra en sobreventa)
//  - i=10 → 'rsi_cross_up_50'     (sube por encima de 50)
// -----------------------------------------------------------

/**
 * Genera alertas a partir de una serie RSI.
 *
 * @param {Array<number>} rsiArr - Serie de valores RSI (entre 0 y 100).
 * @param {Object} options - Configuración de los niveles de alerta.
 * @param {number} [options.high=80] - Nivel de sobrecompra (por encima de este valor).
 * @param {number} [options.low=20] - Nivel de sobreventa (por debajo de este valor).
 * @param {number} [options.preLow=30] - Nivel previo o intermedio de sobreventa.
 * @param {boolean}[options.usePreLow=true] - Si true, evalúa también preLow como “alerta temprana”.
 * @param {boolean}[options.watch50=true] - Si true, detecta cruces del nivel 50 (cambio de momentum).
 *
 * @returns {Array<Object>} Lista de alertas detectadas.
 * Cada alerta tiene la forma:
 * {
 *   i: <índice en la serie>,
 *   type: <tipo de alerta>,
 *   level?: <valor de umbral involucrado>
 * }
 */
function rsiAlerts(rsiArr, {
  high = 80,       // umbral superior de sobrecompra
  low = 20,        // umbral inferior de sobreventa
  preLow = 30,     // umbral previo a sobreventa (aviso temprano)
  usePreLow = true, // activa o desactiva las alertas preLow
  watch50 = true   // activa o desactiva cruces del nivel 50
} = {}) {

  const alerts = []; // donde se guardarán todas las alertas encontradas

  // Recorre la serie RSI comparando valores consecutivos
  for (let i = 1; i < rsiArr.length; i++) {
    const prev = rsiArr[i - 1]; // valor anterior
    const cur  = rsiArr[i];     // valor actual
    if (cur == null || prev == null) continue; // ignora valores nulos

    // -----------------------------------------------------------
    // ENTRA EN SOBRECMPRA (cruza hacia arriba el nivel "high")
    // -----------------------------------------------------------
    if (cur >= high && prev < high)
      alerts.push({ i, type: 'rsi_overbought_enter', level: high });

    // -----------------------------------------------------------
    // ENTRA EN SOBREVENTA (cruza hacia abajo el nivel "low")
    // -----------------------------------------------------------
    if (cur <= low && prev > low)
      alerts.push({ i, type: 'rsi_oversold_enter', level: low });

    // -----------------------------------------------------------
    // ALERTA PREVIA DE SOBREVENTA (por debajo de preLow)
    // útil para detectar debilidad antes de entrar a zona extrema
    // -----------------------------------------------------------
    if (usePreLow && cur <= preLow && prev > preLow)
      alerts.push({ i, type: 'rsi_pre_oversold', level: preLow });

    // -----------------------------------------------------------
    // CRUCES DEL NIVEL CENTRAL (50)
    // Indican cambio de tendencia o momentum.
    // -----------------------------------------------------------
    if (watch50) {
      // Sube por encima de 50 (momentum alcista)
      if (prev < 50 && cur >= 50)
        alerts.push({ i, type: 'rsi_cross_up_50' });

      // Baja por debajo de 50 (momentum bajista)
      if (prev > 50 && cur <= 50)
        alerts.push({ i, type: 'rsi_cross_down_50' });
    }
  }

  // Devuelve todas las alertas detectadas
  return alerts;
}

// Exporta la función para su uso en otros servicios o módulos de señales
module.exports = { rsiAlerts };

// | Tipo de alerta         | Condición                        | Significado                 |
// | ---------------------- | -------------------------------- | --------------------------- |
// | `rsi_overbought_enter` | `prev < high && cur >= high`     | RSI entra en sobrecompra    |
// | `rsi_oversold_enter`   | `prev > low && cur <= low`       | RSI entra en sobreventa     |
// | `rsi_pre_oversold`     | `prev > preLow && cur <= preLow` | Aviso temprano de debilidad |
// | `rsi_cross_up_50`      | `prev < 50 && cur >= 50`         | Momentum se vuelve alcista  |
// | `rsi_cross_down_50`    | `prev > 50 && cur <= 50`         | Momentum se vuelve bajista  |
