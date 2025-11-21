// src/hooks/useMarketAutoload.js
// ---------------------------------------------------------
// Hook personalizado para gestionar la carga automática de velas
// cuando el usuario hace scroll hacia el inicio del gráfico.
// ---------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { getLimitForInterval } from '../utils/marketUtils';

/**
 * Hook para gestionar autoload de velas en el gráfico
 * 
 * @param {Object} params
 * @param {Object} params.chartRef - Referencia al chart de lightweight-charts
 * @param {Array} params.candles - Array de velas actuales
 * @param {string} params.interval - Intervalo actual (1m, 5m, 1H, etc.)
 * @param {Function} params.onLoadMore - Callback para cargar más velas
 * @returns {Object} - Estado de carga automática
 */
export const useMarketAutoload = ({ chartRef, candles, interval, onLoadMore }) => {
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const autoLoadTimeoutRef = useRef();

  useEffect(() => {
    // Si no hay chart montado, velas, o ya se está cargando, no se configura el listener
    if (!chartRef || !candles.length || isAutoLoading) return;
    
    console.log('[AutoLoad] Configurando listener de scroll/zoom para carga automática');
    
    // Suscribirse al cambio de rango visible en el eje de tiempo
    const handler = (range) => {
      if (!candles.length || isAutoLoading) return;
      
      const minIndex = range?.from ?? 0;
      const totalCandles = candles.length;
      
      // Si el usuario está cerca del inicio (minIndex < 5), cargamos más velas hacia atrás
      if (minIndex < 5 && totalCandles >= 50) {
        console.log(`[AutoLoad] Cerca del inicio (${minIndex}), cargando más velas... Total actual: ${totalCandles}`);
        
        setIsAutoLoading(true);
        
        // Evita múltiples timeouts superpuestos
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        
        autoLoadTimeoutRef.current = setTimeout(() => {
          onLoadMore();
          // Pequeño retraso antes de permitir nueva carga
          setTimeout(() => setIsAutoLoading(false), 2000);
        }, 1000);
      }
    };

    chartRef.timeScale().subscribeVisibleLogicalRangeChange(handler);
    
    // Limpieza al desmontar o cambiar dependencias
    return () => {
      try {
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        if (chartRef?.timeScale?.()) {
          chartRef.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        }
      } catch (e) {
        console.debug('[AutoLoad] Error al desuscribirse:', e.message);
      }
    };
  }, [chartRef, candles.length, isAutoLoading, onLoadMore]);

  return { isAutoLoading };
};
