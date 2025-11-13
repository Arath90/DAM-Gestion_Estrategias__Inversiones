import React, { useMemo } from 'react';
import DatasetComponentsBuilder from './DatasetComponentsBuilder';
import { SPEC_META_FIELDS, extractSpecState } from '../utils/datasetSpec';

const prettyDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const specPreview = (spec) => {
  if (!spec) return 'Sin especificación';
  if (typeof spec === 'string') return spec.slice(0, 140);
  try {
    return JSON.stringify(spec, null, 2).slice(0, 140);
  } catch {
    return String(spec);
  }
};

const DatasetCard = ({
  item,
  isExpanded,
  onToggle,
  onDelete,
  onChangeField,
  onSubmitEdit,
  editState,
  submittingId,
  FIELD_CONFIG,
  onChangeMeta,
  onChangeComponents,
  metadataFields = SPEC_META_FIELDS,
  componentsOverride = null,
  metadataOverride = null,
}) => {
  const { metadata: extractedMeta, components: extractedComponents } = useMemo(
    () => extractSpecState(item.spec_json),
    [item.spec_json],
  );
  const specMeta = useMemo(
    () => ({ ...extractedMeta, ...(metadataOverride || {}) }),
    [extractedMeta, metadataOverride],
  );
  const specComponents =
    (componentsOverride && componentsOverride.length && componentsOverride) ||
    extractedComponents;

  return (
    <article className={`dataset-row${isExpanded ? ' expanded' : ''}`}>
      <header className="dataset-head">
        <button
          type="button"
          className="dataset-toggle"
          title={isExpanded ? 'Cerrar detalles del dataset' : 'Ver detalles y configuración'}
          onClick={() => onToggle(item.ID)}
        >
          <span className="title">{item.name || 'Sin nombre'}</span>
          <span className="meta">
            {item.instrument_conid ? `CONID ${item.instrument_conid}` : 'Sin instrumento'}
          </span>
          <span className="chevron" aria-hidden="true">{isExpanded ? '^' : 'v'}</span>
        </button>
        <button
          type="button"
          className="btn-danger"
          title="Eliminar este dataset"
          onClick={() => onDelete(item.ID)}
          disabled={submittingId === item.ID}
        >
          {submittingId === item.ID ? 'Eliminando...' : 'Eliminar'}
        </button>
      </header>

      {isExpanded && (
        <div className="dataset-dropdown">
          <div className="dataset-details">
            <div>
              <strong>ID</strong>
              <span title="Identificador único del dataset">{item.ID}</span>
            </div>
            <div>
              <strong>Descripción</strong>
              <span title="Descripción rápida del dataset">{item.description || 'Sin descripción'}</span>
            </div>
            <div>
              <strong>Spec</strong>
              <span title="JSON generado con los componentes">{specPreview(item.spec_json)}</span>
            </div>
            <div className="dataset-meta-block">
              <div>
                <strong>Símbolo</strong>
                <span title="Ticker o símbolo asociado">{specMeta.symbol || 'N/D'}</span>
              </div>
              <div>
                <strong>Timeframe</strong>
                <span title="Temporalidad objetivo del dataset">{specMeta.timeframe || 'N/D'}</span>
              </div>
              <div>
                <strong>Objetivo</strong>
                <span title="Variable objetivo/label">{specMeta.target || 'N/D'}</span>
              </div>
            </div>
            <div>
              <strong>Componentes</strong>
              {specComponents.length ? (
                <ul className="dataset-component-summary">
                  {specComponents.slice(0, 4).map((component) => (
                    <li key={component.id} title={`${component.kind} · ${component.alias || component.output_key}`}>
                      <span className="component-kind">{component.kind}</span>
                      <span className="component-alias">{component.alias}</span>
                    </li>
                  ))}
                  {specComponents.length > 4 && (
                    <li className="muted">+{specComponents.length - 4} más</li>
                  )}
                </ul>
              ) : (
                <span>Sin componentes declarados.</span>
              )}
            </div>
            <div>
              <strong>Creado</strong>
              <span>{prettyDate(item.createdAt)}</span>
            </div>
            <div>
              <strong>Actualizado</strong>
              <span>{prettyDate(item.updatedAt)}</span>
            </div>
          </div>

          <form className="dataset-form" onSubmit={(e) => onSubmitEdit(e, item.ID)}>
            <h4>Editar dataset</h4>
            <div className="form-grid">
            {FIELD_CONFIG.map(({ name, label, type, placeholder, as, step }) => (
              <label key={name} className="form-field">
                <span title={`Campo ${label}`}>
                  {label}
                  {name === 'name' ? ' *' : ''}
                </span>
                  {as === 'textarea' ? (
                    <textarea
                      value={editState[name] ?? ''}
                      placeholder={placeholder}
                      onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                    />
                  ) : (
                    <input
                      type={type || 'text'}
                      value={editState[name] ?? ''}
                      placeholder={placeholder}
                      step={step}
                      onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="spec-meta-grid">
              <h5>Metadatos del dataset</h5>
              <div className="form-grid">
                {metadataFields.map(({ name, label, placeholder, as }) => (
                  <label key={name} className="form-field">
                    <span title={`Valor para ${label}`}>{label}</span>
                    {as === 'textarea' ? (
                      <textarea
                        value={editState.specMeta?.[name] ?? ''}
                        placeholder={placeholder}
                        onChange={(event) =>
                          onChangeMeta(item.ID, name, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        value={editState.specMeta?.[name] ?? ''}
                        placeholder={placeholder}
                        onChange={(event) =>
                          onChangeMeta(item.ID, name, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <DatasetComponentsBuilder
              value={editState.components || []}
              onChange={(next) => onChangeComponents(item.ID, next)}
            />
            <button type="submit" className="btn-primary" disabled={submittingId === item.ID}>
              {submittingId === item.ID ? 'Guardando...' : 'Actualizar'}
            </button>
          </form>
        </div>
      )}
    </article>
  );
};

export default DatasetCard;
