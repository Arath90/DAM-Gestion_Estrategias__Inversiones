function rsiAlerts(rsiArr, {
  high = 80, low = 20, preLow = 30, usePreLow = true, watch50 = true
} = {}) {
  const alerts = [];
  for (let i = 1; i < rsiArr.length; i++) {
    const prev = rsiArr[i - 1], cur = rsiArr[i];
    if (cur == null || prev == null) continue;

    if (cur >= high && prev < high) alerts.push({ i, type: 'rsi_overbought_enter', level: high });
    if (cur <= low  && prev > low ) alerts.push({ i, type: 'rsi_oversold_enter',  level: low  });

    if (usePreLow && cur <= preLow && prev > preLow)
      alerts.push({ i, type: 'rsi_pre_oversold', level: preLow });

    if (watch50) {
      if (prev < 50 && cur >= 50) alerts.push({ i, type: 'rsi_cross_up_50' });
      if (prev > 50 && cur <= 50) alerts.push({ i, type: 'rsi_cross_down_50' });
    }
  }
  return alerts;
}

module.exports = { rsiAlerts };
