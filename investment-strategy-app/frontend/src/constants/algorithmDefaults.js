export const DEFAULT_ALGORITHM_PARAMS = {
  emaFast: 20,
  emaSlow: 50,
  smaLong: 200,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  divergence: {
    peakWindow: 3,
    maxBarsBetweenPeaks: 60,
    minPriceChangePct: 0.002,
    minIndicatorChangePct: 0.01,
    maxPeakDistance: 8,
  },
};

export const mergeAlgorithmParams = (incoming = {}) => ({
  ...DEFAULT_ALGORITHM_PARAMS,
  ...incoming,
  divergence: {
    ...DEFAULT_ALGORITHM_PARAMS.divergence,
    ...(incoming?.divergence || {}),
  },
});

