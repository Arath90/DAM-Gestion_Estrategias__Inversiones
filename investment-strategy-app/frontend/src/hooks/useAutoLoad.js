import { useState, useRef, useEffect } from 'react';

/**
 * Hook personalizado para manejar la carga automática de velas al hacer scroll
 */
export const useAutoLoad = (chartRef, candles, loadMoreCandles) => {
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const autoLoadTimeoutRef = useRef();

  useEffect(() => {
    if (!chartRef || !candles.length || isAutoLoading) return;
    
    console.log('[AutoLoad] Configurando listener de scroll/zoom para carga automática');
    
    const unsubscribe = chartRef.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!candles.length || isAutoLoading) return;
      
      const minIndex = range?.from ?? 0;
      const totalCandles = candles.length;
      
      // Solo cargar más velas si:
      // 1. Estamos cerca del inicio (minIndex < 5)
      // 2. Tenemos suficientes velas para justificar la carga (>= 50)
      // 3. No estamos ya cargando
      if (minIndex < 5 && totalCandles >= 50) {
        console.log(`[AutoLoad] Cerca del inicio (${minIndex}), cargando más velas... Total actual: ${totalCandles}`);
        
        // Prevenir múltiples cargas simultáneas
        setIsAutoLoading(true);
        
        // Limpiar timeout previo si existe
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        
        // Debounce de 1 segundo para evitar múltiples cargas
        autoLoadTimeoutRef.current = setTimeout(() => {
          loadMoreCandles();
          // Permitir nuevas cargas después de 2 segundos
          setTimeout(() => setIsAutoLoading(false), 2000);
        }, 1000);
      } else if (totalCandles < 50) {
        console.log(`[AutoLoad] Muy pocas velas (${totalCandles}), no se activa autoload`);
      }
    });
    
    // Cleanup
    return () => {
      try {
        if (autoLoadTimeoutRef.current) {
          clearTimeout(autoLoadTimeoutRef.current);
        }
        unsubscribe();
      } catch (e) {
        console.debug('[AutoLoad] Error al desuscribirse:', e.message);
      }
    };
  }, [chartRef, candles.length, isAutoLoading, loadMoreCandles]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (autoLoadTimeoutRef.current) {
        clearTimeout(autoLoadTimeoutRef.current);
      }
    };
  }, []);

  return {
    isAutoLoading,
    setIsAutoLoading,
  };
};