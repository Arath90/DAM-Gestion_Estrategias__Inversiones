import React, { useEffect, useMemo, useState } from 'react';
import {
  COMPONENT_OPTIONS,
  createComponentTemplate,
  normalizeComponent,
} from '../utils/datasetSpec';

const PRICE_FIELD_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'close', label: 'Close' },
  { value: 'volume', label: 'Volume' },
  { value: 'hlc3', label: 'HLC3' },
];

const SOURCE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'close', label: 'Close' },
];

const DatasetComponentsBuilder = ({ value = [], onChange }) => {
  const [selectedKind, setSelectedKind] = useState('price');
  const components = useMemo(
    () => value.map((component) => normalizeComponent(component)),
    [value],
  );

  const [selectedId, setSelectedId] = useState(() => components[0]?.id || null);

  useEffect(() => {
    if (!components.length) {
      setSelectedId(null);
      return;
    }
    const stillExists = components.some((component) => component.id === selectedId);
    if (!stillExists) {
      setSelectedId(components[components.length - 1]?.id || components[0].id);
    }
  }, [components, selectedId]);

  const persist = (nextList) => {
    onChange(nextList.map((component) => normalizeComponent(component)));
  };

  const updateComponent = (id, updater) => {
    persist(
      components.map((component) => {
        if (component.id !== id) return component;
        const draft =
          typeof updater === 'function'
            ? updater(component)
            : { ...component, ...updater };
        if (updater?.params || typeof updater === 'function') {
          draft.params = {
            ...component.params,
            ...(draft.params || {}),
          };
        }
        return normalizeComponent(draft);
      }),
    );
  };

  const handleAdd = () => {
    const template = createComponentTemplate(selectedKind);
    persist([...components, template]);
    setSelectedId(template.id);
  };

  const handleRemove = (id) => {
    const filtered = components.filter((component) => component.id !== id);
    persist(filtered);
    if (selectedId === id) {
      setSelectedId(filtered[0]?.id || null);
    }
  };

  const handleKindChange = (component, nextKind) => {
    updateComponent(component.id, () => ({
      ...createComponentTemplate(nextKind),
      id: component.id,
      alias: component.alias,
      output_key: component.output_key,
      include: component.include,
    }));
  };

  const handleAliasChange = (id, alias) => {
    updateComponent(id, { alias });
  };

  const handleOutputKeyChange = (id, output_key) => {
    updateComponent(id, { output_key });
  };

  const handleIncludeToggle = (id, include) => {
    updateComponent(id, { include });
  };

  const handleParamChange = (id, field, value) => {
    updateComponent(id, (component) => ({
      ...component,
      params: { ...component.params, [field]: value },
    }));
  };

  const handleParamNumberChange = (id, field, rawValue) => {
    if (rawValue === '') {
      handleParamChange(id, field, undefined);
      return;
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return;
    handleParamChange(id, field, numeric);
  };

  const handleNotesChange = (id, notes) => {
    updateComponent(id, { notes });
  };

  const renderKindParams = (component) => {
    switch (component.kind) {
      case 'price':
        return (
          <label className="component-field">
            <span>Campo base</span>
            <select
              value={component.params.field}
              title="Campo base del candle a usar"
              onChange={(event) =>
                handleParamChange(component.id, 'field', event.target.value)
              }
            >
              {PRICE_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        );
      case 'indicator:rsi':
        return (
          <>
            <label className="component-field">
              <span>Periodo</span>
              <input
                type="number"
                value={component.params.period ?? ''}
                min={2}
                title="Número de velas usadas para el cálculo"
                onChange={(event) =>
                  handleParamNumberChange(component.id, 'period', event.target.value)
                }
              />
            </label>
            <label className="component-field">
              <span>Fuente</span>
              <select
                value={component.params.source}
                title="Campo fuente para el cálculo"
                onChange={(event) =>
                  handleParamChange(component.id, 'source', event.target.value)
                }
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        );
      case 'indicator:ema':
      case 'indicator:sma':
        return (
          <>
            <label className="component-field">
              <span>Periodo</span>
              <input
                type="number"
                value={component.params.period ?? ''}
                min={2}
                title="Número de velas usadas para el cálculo"
                onChange={(event) =>
                  handleParamNumberChange(component.id, 'period', event.target.value)
                }
              />
            </label>
            <label className="component-field">
              <span>Fuente</span>
              <select
                value={component.params.source}
                title="Campo fuente para el cálculo"
                onChange={(event) =>
                  handleParamChange(component.id, 'source', event.target.value)
                }
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        );
      case 'indicator:macd':
        return (
          <>
            <label className="component-field">
              <span>Rápida</span>
              <input
                type="number"
                value={component.params.fast ?? ''}
                min={2}
                title="Periodo rápido del MACD"
                onChange={(event) =>
                  handleParamNumberChange(component.id, 'fast', event.target.value)
                }
              />
            </label>
            <label className="component-field">
              <span>Lenta</span>
              <input
                type="number"
                value={component.params.slow ?? ''}
                min={2}
                title="Periodo lento del MACD"
                onChange={(event) =>
                  handleParamNumberChange(component.id, 'slow', event.target.value)
                }
              />
            </label>
            <label className="component-field">
              <span>Señal</span>
              <input
                type="number"
                value={component.params.signal ?? ''}
                min={1}
                title="Periodo de la línea de señal"
                onChange={(event) =>
                  handleParamNumberChange(component.id, 'signal', event.target.value)
                }
              />
            </label>
            <label className="component-field">
              <span>Fuente</span>
              <select
                value={component.params.source}
                title="Campo fuente para el cálculo"
                onChange={(event) =>
                  handleParamChange(component.id, 'source', event.target.value)
                }
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        );

      case 'indicator:bb':
      return (
        <>
          <label className="component-field">
            <span>Periodo</span>
            <input
              type="number"
              value={component.params.period ?? ''}
              min={2}
              title="Periodo del cálculo"
              onChange={(event) =>
                handleParamNumberChange(component.id, 'period', event.target.value)
              }
            />
          </label>

          <label className="component-field">
            <span>Fuente</span>
            <select
              value={component.params.source}
              title="Campo fuente"
              onChange={(event) =>
                handleParamChange(component.id, 'source', event.target.value)
              }
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="component-field">
            <span>Multiplicador</span>
            <input
              type="number"
              value={component.params.multiplier ?? ''}
              min={1}
              title="Desviaciones estándar"
              onChange={(event) =>
                handleParamNumberChange(component.id, 'multiplier', event.target.value)
              }
            />
          </label>
        </>
      );
      case 'custom':
        return (
          <>
            <label className="component-field">
              <span>Expresión / Script</span>
              <textarea
                value={component.params.expression || ''}
                title="Fórmula o script a aplicar"
                onChange={(event) =>
                  handleParamChange(component.id, 'expression', event.target.value)
                }
              />
            </label>
            <label className="component-field">
              <span>Fuente base</span>
              <select
                value={component.params.source}
                title="Campo base para la expresión"
                onChange={(event) =>
                  handleParamChange(component.id, 'source', event.target.value)
                }
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="component-field">
              <span>Notas</span>
              <textarea
                value={component.notes || ''}
                title="Notas o documentación del componente"
                onChange={(event) => handleNotesChange(component.id, event.target.value)}
              />
            </label>
          </>
        );
      default:
        return null;
    }
  };

  const selectedComponent = components.find((component) => component.id === selectedId);

  return (
    <div className="components-builder">
      <div className="component-chip-row">
        {components.map((component) => (
          <button
            type="button"
            key={component.id}
            className={`component-chip${component.id === selectedId ? ' active' : ''}`}
            title={`Editar ${component.alias || component.output_key}`}
            onClick={() => setSelectedId(component.id)}
          >
            <span className="chip-label">{component.alias || component.output_key}</span>
            {component.include === false && <span className="chip-muted">· omitido</span>}
          </button>
        ))}
        <div className="chip-adder">
          <select
            value={selectedKind}
            onChange={(event) => setSelectedKind(event.target.value)}
            className="chip-adder-select"
            title="Tipo del componente que se va a agregar"
          >
            {COMPONENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="chip-add-btn"
            title="Agregar un nuevo componente con el tipo seleccionado"
            onClick={handleAdd}
          >
            +
          </button>
        </div>
      </div>

      {!components.length && (
        <div className="components-builder-empty">
          Añade al menos un componente para describir el dataset.
        </div>
      )}

      {selectedComponent && (
        <div className="component-detail">
          <header className="component-detail-head">
            <div className="component-title">
              <input
                type="text"
                value={selectedComponent.alias}
                title="Nombre legible del componente"
                onChange={(event) =>
                  handleAliasChange(selectedComponent.id, event.target.value)
                }
                placeholder="Alias legible"
              />
              <select
                value={selectedComponent.kind}
                title="Tipo de indicador o componente"
                onChange={(event) =>
                  handleKindChange(selectedComponent, event.target.value)
                }
              >
                {COMPONENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="component-head-actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={selectedComponent.include !== false}
                  title="Incluye o excluye este componente del array features"
                  onChange={(event) =>
                    handleIncludeToggle(selectedComponent.id, event.target.checked)
                  }
                />
                <span>Incluir en features</span>
              </label>
              <button
                type="button"
                className="btn-link danger"
                title="Quitar definitivamente este componente del dataset"
                onClick={() => handleRemove(selectedComponent.id)}
              >
                Quitar
              </button>
            </div>
          </header>

          <div className="component-body">
            <label className="component-field">
              <span>Clave / Identificador</span>
              <input
                type="text"
                value={selectedComponent.output_key}
                placeholder="Ej. ema20_close"
                title="Identificador que se usará dentro del dataset"
                onChange={(event) =>
                  handleOutputKeyChange(selectedComponent.id, event.target.value)
                }
              />
            </label>
            <div className="component-params-grid">
              {renderKindParams(selectedComponent)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetComponentsBuilder;
