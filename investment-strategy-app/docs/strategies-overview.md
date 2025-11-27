# Estrategias: guía rápida (frontend + backend)

Este documento explica cómo viaja la información de una estrategia desde la UI hasta Mongo, pensando en alguien que no conoce el flujo.

## Campos clave de la estrategia
- `strategy_code`, `dataset_id`, `period_start`, `period_end`: obligatorios. Identifican la estrategia y el rango temporal.
- `indicators` (string JSON): switches de indicadores activos (ej. `{ "rsi": true, "macd": false }`).
- `indicator_params` (string JSON): parámetros numéricos de esos indicadores (ej. `{ "RSI_period": 14, "RSI_overbought": 70, "RSI_oversold": 30 }`).
- `metrics_json`: libre para métricas si se usan.

## Frontend (Estrategias.jsx / StrategyCard.jsx)
1) El usuario completa el formulario y activa indicadores.
2) `sanitizePayload` limpia y serializa:
   - Limita los indicadores a los permitidos por el dataset.
   - Combina valores de `signal_config` relevantes en `indicator_params` (ej. umbrales RSI si RSI está activo).
   - Serializa `indicators` e `indicator_params` a JSON (strings) para enviarlos al backend.
3) Se envía a `/Strategies` con `ProcessType=CREATE/UPDATE`.

### Si quieres agregar un indicador nuevo
1. Añade el toggle en `INDICATOR_TOGGLES` y su config en `indicatorConfig`.
2. Inclúyelo en `DEFAULT_INDICATOR_SETTINGS`.
3. Ajusta `filterParamsByConfig` y `buildFilteredSignalConfig` si aporta parámetros o umbrales.

## Backend (Strategies.js y schema.cds)
- Modelo Mongo: `indicators` y `indicator_params` son campos `Mixed` (aceptan cualquier JSON).
- Esquema CAP (`schema.cds`): expone `indicators` e `indicator_params` como `LargeString` (las cadenas JSON que envía el front).
- Ya no se usa `params_json`; fue reemplazado por los campos anteriores.

## Tips de depuración
- Si ves errores de tipo en CAP, confirma que `indicators` e `indicator_params` se envían serializados (string JSON).
- En Compass, revisa que los mapas solo contengan claves permitidas por el dataset y los indicadores activados.

## Flujo resumido
UI ➜ `sanitizePayload` ➜ axios PATCH/POST `/Strategies` (con `indicators` + `indicator_params` serializados) ➜ CAP / Mongo almacena los strings JSON.
