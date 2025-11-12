import React, { useRef, useEffect } from 'react';
import { buildToastMessage } from '../../utils/marketUtils';
import Notification from '../Notification';
import '../../assets/css/components/SharedMarketComponents.css';

/**
 * Componente para manejar las señales de trading y notificaciones
 */
const TradeSignals = ({ 
  tradeSignals, 
  tradeMode, 
  onPersistSignals,
  lastSignalRef 
}) => {
  useEffect(() => {
    if (!tradeSignals.length) return;

    const lastKnown = lastSignalRef.current;
    const newestTimestamp = tradeSignals[tradeSignals.length - 1].time;
    lastSignalRef.current = Math.max(lastKnown, newestTimestamp);

    const freshSignals = tradeSignals.filter((signal) => signal.time > lastKnown);
    if (!freshSignals.length) return;

    console.log(`🔔 ${freshSignals.length} nueva(s) señal(es) detectada(s)`);
    
    freshSignals.forEach((signal) => {
      const message = buildToastMessage(signal, tradeMode);
      const isSuccess = signal.action === 'BUY';
      
      // Mostrar notificación
      Notification({
        message,
        isSuccess,
        duration: 5000,
      });
    });

    // Persistir señales si hay nuevas
    if (onPersistSignals) {
      onPersistSignals(freshSignals);
    }
  }, [tradeSignals, tradeMode, onPersistSignals, lastSignalRef]);

  return null; // Este componente solo maneja lógica, no renderiza UI
};

export default TradeSignals;