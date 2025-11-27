// src/hooks/useTradeSignalNotifications.js
// ---------------------------------------------------------
// Hook personalizado para gestionar notificaciones de señales de trading.
// Procesa nuevas señales, actualiza historial y persiste en backend si es necesario.
// ---------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { persistTradeSignals } from '../services/tradingSignals';
import { buildToastMessage, getStrategyKey } from '../utils/marketUtils';
import { TRADE_MODES } from '../constants/marketConstants';

/**
 * Hook para gestionar notificaciones de señales de trading
 * 
 * @param {Object} params
 * @param {Array} params.tradeSignals - Señales de trading generadas
 * @param {string} params.tradeMode - Modo actual (notify o auto)
 * @param {string} params.symbol - Símbolo actual
 * @param {string} params.intervalLabel - Etiqueta del intervalo
 * @param {Object} params.selectedStrategy - Estrategia seleccionada
 * @returns {Object} - Estado de notificaciones y popup
 */
export const useTradeSignalNotifications = ({
  tradeSignals,
  tradeMode,
  symbol,
  intervalLabel,
  selectedStrategy,
}) => {
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState({ open: false, message: '' });
  const lastSignalRef = useRef(0);

  useEffect(() => {
    if (!tradeSignals.length) return;

    const lastKnown = lastSignalRef.current;
    const newestTimestamp = tradeSignals[tradeSignals.length - 1].time;

    // Actualiza la marca de "último procesado"
    lastSignalRef.current = Math.max(lastKnown, newestTimestamp);

    // Filtra solo las señales más recientes
    const freshSignals = tradeSignals.filter((signal) => signal.time > lastKnown);
    if (!freshSignals.length) return;

    // Obtiene identificador y código de estrategia
    const strategyKey = getStrategyKey(selectedStrategy);
    const strategyCode =
      selectedStrategy?.strategy_code ||
      selectedStrategy?.name ||
      'FRONTEND_MACD_RSI';

    // Prepara el batch de señales a guardar y mostrar
    const batch = freshSignals.map((signal) => ({
      id: signal.id,
      ts: signal.time,
      recorded: Date.now(),
      action: signal.action,
      price: signal.price,
      reasons: signal.reasons,
      confidence: signal.confidence,
      symbol: signal.symbol || symbol,
      interval: signal.interval || intervalLabel,
      mode: tradeMode,
      strategyId: strategyKey,
      strategyCode,
    }));

    // Actualiza bandeja de notificaciones (mantiene solo las últimas 20)
    setNotifications((prev) => {
      const next = [...batch, ...prev];
      return next.slice(0, 20);
    });

    // Muestra popup con la última señal del batch
    const latest = batch[batch.length - 1];
    setPopup({
      open: true,
      message: buildToastMessage(latest, tradeMode),
    });

    // Si el modo es automático, persiste las señales en backend
    if (tradeMode === TRADE_MODES.auto) {
      persistTradeSignals(batch, {
        symbol,
        interval: intervalLabel,
        mode: tradeMode,
        strategyCode,
      })
        .then(({ persisted, errors }) => {
          console.log(`✓ ${persisted} señales guardadas`);
          if (errors.length) {
            console.warn('[signals] errores al persistir:', errors);
          }
        })
        .catch((err) => {
          console.error('[signals] persistencia fallida:', err?.message);
        });
    }
  }, [tradeSignals, tradeMode, symbol, intervalLabel, selectedStrategy]);

  return {
    notifications,
    popup,
    closePopup: () => setPopup({ open: false, message: '' }),
  };
};
