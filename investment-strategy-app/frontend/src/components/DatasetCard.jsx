import React from 'react';

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
}) => {
  return (
    <article className={`dataset-row${isExpanded ? ' expanded' : ''}`}>
      <header className="dataset-head">
        <button type="button" className="dataset-toggle" onClick={() => onToggle(item.ID)}>
          <span className="title">{item.name || 'Sin nombre'}</span>
          <span className="meta">
            {item.instrument_conid ? `CONID ${item.instrument_conid}` : 'Sin instrumento'}
          </span>
          <span className="chevron" aria-hidden="true">{isExpanded ? '^' : 'v'}</span>
        </button>
        <button
          type="button"
          className="btn-danger"
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
              <span>{item.ID}</span>
            </div>
            <div>
              <strong>Descripción</strong>
              <span>{item.description || 'Sin descripción'}</span>
            </div>
            <div>
              <strong>Spec</strong>
              <span>{specPreview(item.spec_json)}</span>
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
                  <span>
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
