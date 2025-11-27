# 📊 Refactorización de Mercado.jsx

> **Fecha:** 21 de Noviembre, 2025  
> **Rama:** Refactoring  
> **Estado:** ✅ Completado

## 🎯 Objetivo

Refactorizar el componente `Mercado.jsx` para mejorar su mantenibilidad, legibilidad y escalabilidad siguiendo buenas prácticas de React y arquitectura frontend moderna, **sin modificar el backend**.

---

## 📦 Archivos Nuevos Creados

### **Hooks Personalizados**

#### 1. `useMarketAutoload.js`
```
frontend/src/hooks/useMarketAutoload.js
```
**Responsabilidad:** Gestiona la carga automática de velas cuando el usuario hace scroll hacia el inicio del gráfico.

**Características:**
- Suscripción al evento `visibleLogicalRangeChange` del timeline
- Previene cargas múltiples simultáneas con debouncing
- Configurable mediante props (chartRef, candles, interval, onLoadMore)

---

#### 2. `useTradeSignalNotifications.js`
```
frontend/src/hooks/useTradeSignalNotifications.js
```
**Responsabilidad:** Procesa señales de trading, actualiza notificaciones y persiste datos en backend cuando el modo es automático.

**Características:**
- Filtra solo señales nuevas usando referencia temporal
- Actualiza bandeja de notificaciones (máximo 20)
- Muestra popup con última señal
- Persiste en backend si `tradeMode === 'auto'`
- Manejo de errores y logging

---

### **Componentes UI**

#### 3. `MarketConfigPanel.jsx`
```
frontend/src/components/market/MarketConfigPanel.jsx
```
**Responsabilidad:** Agrupa todos los controles de configuración de mercado en un solo panel.

**Agrupa:**
- `IntervalSelector` - Selector de intervalo temporal
- `StrategySelector` - Selector de estrategia con configuración
- `TradingControls` - Modo de trading (notify/auto)
- Renderizado de errores de mercado

---

#### 4. `MarketChartsContainer.jsx`
```
frontend/src/components/market/MarketChartsContainer.jsx
```
**Responsabilidad:** Encapsula los tres gráficos principales con sus estados de carga.

**Contiene:**
- Gráfico principal de precio (velas + indicadores)
- Gráfico RSI (condicional si `settings.rsi === true`)
- Gráfico MACD (condicional si `settings.macd === true`)
- Estados de carga y error para cada gráfico

---

### **Utilidades**

#### 5. `strategyConfig.js`
```
frontend/src/utils/strategyConfig.js
```
**Responsabilidad:** Funciones helper para gestionar configuración de estrategias.

**Funciones exportadas:**

##### `getStrategyConfig(strategy)`
Obtiene la configuración hidratada de una estrategia.
```javascript
const { indicatorSettings, signalConfig } = getStrategyConfig(selectedStrategy);
```

##### `mergeSignalConfig(strategySignalConfig, settings)`
Combina configuración por defecto con configuración de estrategia.
```javascript
const signalConfig = mergeSignalConfig(strategySignalConfig, settings);
```

##### `prepareIndicatorsForEvents(indicators)`
Prepara indicadores en formato simplificado para construcción de eventos.
```javascript
const indicatorsForEvents = prepareIndicatorsForEvents({ 
  ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram 
});
```

---

## 🔄 Cambios en Mercado.jsx

### **Antes vs Después**

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Líneas de código** | ~500 | ~290 | **-42%** |
| **Secciones lógicas** | Difusas | 15 bien definidas | ✅ |
| **Imports** | 50+ mezclados | 47 organizados | ✅ |
| **Comentarios** | Muy verbosos | Concisos | ✅ |
| **Responsabilidades** | Múltiples | Una (orquestación) | ✅ |

---

### **Estructura de Imports (Nuevo)**

```javascript
// Componentes de UI
import Notification from '../components/Notification';
import MarketHeader from '../components/market/MarketHeader';
import MarketConfigPanel from '../components/market/MarketConfigPanel';
import MarketChartsContainer from '../components/market/MarketChartsContainer';
import MarketSummary from '../components/market/MarketSummary';
import EventsTable from '../components/market/EventsTable';
import NotificationTray from '../components/market/NotificationTray';

// Hooks personalizados
import { useMarketData } from '../hooks/useMarketData';
import { useMarketCharts } from '../hooks/useMarketCharts';
import { useStrategies } from '../hooks/useStrategies';
import { useSupportResistance } from '../hooks/useSupportResistance';
import { useMarketAutoload } from '../hooks/useMarketAutoload';
import { useTradeSignalNotifications } from '../hooks/useTradeSignalNotifications';

// Constantes y configuraciones
import { DEFAULT_SYMBOLS } from '../services/marketData';
import { INTERVALS, TRADE_MODES } from '../constants/marketConstants';
import { DEFAULT_INDICATOR_SETTINGS } from '../constants/strategyProfiles';

// Utilidades
import { 
  getIntervalLabel,
  getLimitForInterval,
  filterCandlesLastYear
} from '../utils/marketUtils';
import { 
  getStrategyConfig,
  mergeSignalConfig,
  prepareIndicatorsForEvents
} from '../utils/strategyConfig';
import { buildEvents } from '../utils/events';

// Estilos
import '../assets/css/Mercado.css';
import '../assets/globalAssets.css';
```

---

### **Secciones del Componente (Nuevo)**

El componente `Mercado.jsx` ahora está organizado en **15 secciones** claramente delimitadas:

1. **Estado Principal** - symbol, interval, settings, tradeMode, etc.
2. **Hook de Estrategias** - useStrategies()
3. **Hidratación de Configuración** - Actualiza settings cuando cambia estrategia
4. **Merge de Configuración** - Combina configs de estrategia con defaults
5. **Hook de Datos de Mercado** - useMarketData()
6. **Función Autoload** - loadMoreCandles()
7. **Filtro de Velas** - Solo último año para gráficos
8. **Preparar Indicadores** - Para construcción de eventos
9. **Construcción de Eventos** - buildEvents()
10. **Inicialización de Gráficos** - useMarketCharts()
11. **Soporte y Resistencia** - useSupportResistance()
12. **Autoload de Velas** - useMarketAutoload()
13. **Procesamiento de Señales** - useTradeSignalNotifications()
14. **Handlers** - Ticker personalizado
15. **Render** - JSX del componente

---

### **Simplificación del Render**

#### **Antes:**
```jsx
<section className="market-controls">
  {renderError}
  <IntervalSelector ... />
  <StrategySelector ... />
  <div className="controls-divider"></div>
  <TradingControls ... />
</section>

<section className="market-chart-wrapper">
  <div className="market-chart" ref={chartContainerRef}>
    {/* 20+ líneas de JSX */}
  </div>
  {settings.rsi && (
    <div className="market-chart rsi-chart" ref={rsiContainerRef}>
      {/* 15+ líneas de JSX */}
    </div>
  )}
  {settings.macd && (
    <div className="market-chart macd-chart" ref={macdContainerRef}>
      {/* 15+ líneas de JSX */}
    </div>
  )}
</section>
```

#### **Después:**
```jsx
<MarketConfigPanel
  interval={interval}
  onIntervalChange={setInterval}
  strategies={strategies}
  selectedStrategyId={selectedStrategyId}
  onStrategyChange={setSelectedStrategyId}
  strategiesLoading={strategiesLoading}
  strategiesError={strategiesError}
  onRefreshStrategies={loadStrategies}
  settings={settings}
  signalConfig={signalConfig}
  tradeMode={tradeMode}
  onTradeModeChange={setTradeMode}
  error={error}
/>

<MarketChartsContainer
  chartContainerRef={chartContainerRef}
  rsiContainerRef={rsiContainerRef}
  macdContainerRef={macdContainerRef}
  loading={loading}
  error={error}
  candles={candles}
  rsi14={rsi14}
  macdLine={macdLine}
  settings={settings}
/>
```

---

## 🎯 Mejoras Aplicadas

### **1. Separación de Responsabilidades (SRP)**
Cada archivo tiene una única responsabilidad bien definida:
- Hooks → Lógica de negocio reutilizable
- Componentes → Presentación y composición
- Utilidades → Funciones helper puras

### **2. Nombres Consistentes**
- `candles1y` → `candlesLastYear` (más descriptivo)
- Eliminación de abreviaciones confusas
- Nombres que reflejan intención, no implementación

### **3. Comentarios Concisos**
- Comentarios enfocados en el "qué" y "por qué"
- Eliminación de comentarios obvios
- Secciones claramente delimitadas con números

### **4. Reducción de Complejidad**
- Lógica compleja movida a hooks/utilidades
- Componente principal solo orquesta
- Menos anidación en JSX

### **5. Reusabilidad**
- Hooks pueden usarse en otras pantallas
- Utilidades son funciones puras (fácil testeo)
- Componentes independientes del contexto de Mercado

---

## 🧪 Testing Facilitado

Con la nueva estructura es más fácil testear:

```javascript
// Antes: Difícil testear lógica dentro de Mercado.jsx

// Después: Tests unitarios independientes
describe('useMarketAutoload', () => {
  it('should trigger onLoadMore when near start', () => { /* ... */ });
});

describe('useTradeSignalNotifications', () => {
  it('should filter only new signals', () => { /* ... */ });
  it('should persist signals in auto mode', () => { /* ... */ });
});

describe('strategyConfig utils', () => {
  it('should merge signal config correctly', () => { /* ... */ });
});
```

---

## 📂 Estructura de Archivos Final

```
frontend/src/
├── pages/
│   └── Mercado.jsx                    (290 líneas) ⬇️ -42%
├── hooks/
│   ├── useMarketData.js               (existente)
│   ├── useMarketCharts.js             (existente)
│   ├── useStrategies.js               (existente)
│   ├── useSupportResistance.js        (existente)
│   ├── useMarketAutoload.js           ✨ NUEVO (70 líneas)
│   └── useTradeSignalNotifications.js ✨ NUEVO (110 líneas)
├── components/
│   └── market/
│       ├── MarketHeader.jsx           (existente)
│       ├── MarketSummary.jsx          (existente)
│       ├── EventsTable.jsx            (existente)
│       ├── NotificationTray.jsx       (existente)
│       ├── IntervalSelector.jsx       (existente)
│       ├── StrategySelector.jsx       (existente)
│       ├── TradingControls.jsx        (existente)
│       ├── MarketConfigPanel.jsx      ✨ NUEVO (75 líneas)
│       └── MarketChartsContainer.jsx  ✨ NUEVO (65 líneas)
└── utils/
    ├── marketUtils.js                 (existente)
    ├── events.js                      (existente)
    └── strategyConfig.js              ✨ NUEVO (55 líneas)
```

---

## ✅ Checklist de Buenas Prácticas

- [x] **Single Responsibility Principle** - Cada archivo una responsabilidad
- [x] **DRY (Don't Repeat Yourself)** - Lógica común en utilidades
- [x] **Separation of Concerns** - UI separada de lógica
- [x] **Composición sobre herencia** - Componentes pequeños y reutilizables
- [x] **Nombres descriptivos** - Claros y consistentes
- [x] **Comentarios útiles** - Explican el "por qué"
- [x] **Imports organizados** - Por categorías lógicas
- [x] **Hooks personalizados** - Lógica compleja encapsulada
- [x] **Props explícitas** - No hay prop drilling excesivo
- [x] **Testeable** - Funciones y hooks aislados

---

## 🚀 Beneficios Obtenidos

### **Mantenibilidad**
- ✅ Código más fácil de entender
- ✅ Cambios aislados (modificar un hook no afecta otros)
- ✅ Reducción de bugs por acoplamiento

### **Escalabilidad**
- ✅ Fácil agregar nuevos hooks o componentes
- ✅ Lógica reutilizable en otras pantallas
- ✅ Estructura clara para nuevos desarrolladores

### **Testing**
- ✅ Tests unitarios por archivo
- ✅ Mocks más simples
- ✅ Coverage más fácil de alcanzar

### **Performance**
- ✅ Memoización apropiada (useMemo, useCallback)
- ✅ Re-renders controlados por hooks
- ✅ Sin cambios en performance vs versión anterior

---

## 🔍 Próximos Pasos Opcionales

### **Mejoras Futuras Sugeridas:**

1. **Context API para Estado Global**
   - Evitar prop drilling si crece la complejidad
   - `MarketContext` para symbol, interval, settings

2. **React Query / SWR**
   - Cache automático de datos de mercado
   - Revalidación en background
   - Menor código en hooks de datos

3. **Tests Unitarios**
   - Vitest/Jest para hooks
   - React Testing Library para componentes

4. **Storybook**
   - Documentación visual de componentes
   - Desarrollo aislado de UI

5. **TypeScript**
   - Type safety en props y hooks
   - Mejor IntelliSense

---

## 📚 Referencias

- [React Hooks Best Practices](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Component Composition](https://react.dev/learn/passing-props-to-a-component)
- [Clean Code in React](https://react.dev/learn/thinking-in-react)
- [SOLID Principles in React](https://konstantinlebedev.com/solid-in-react/)

---

## 👥 Autor

**Equipo de Desarrollo**  
Proyecto: DAM - Gestión de Estrategias de Inversión  
Universidad: Tecnológico  
Semestre: 10mo  
Fecha: Noviembre 2025

---

## 📝 Notas Finales

Esta refactorización **NO modifica el backend** y es **100% compatible** con la versión anterior. Todos los endpoints, servicios y APIs permanecen intactos.