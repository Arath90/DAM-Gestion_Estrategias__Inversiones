import React from 'react';

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
          <span className="title">{item.code || 'Sin código'} — {item.name || 'Sin nombre'}</span>
          <span className="meta">
            {item.timeframe || 'N/D'} · {item.status || 'Sin estatus'} ·{' '}
            {Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || 'Sin etiquetas')}
          </span>
          <span className="chevron" aria-hidden="true">{isExpanded ? '^' : 'v'}</span>
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => onDelete(item.ID)}
          disabled={submittingId === item.ID}
        >
          {submittingId === item.ID ? 'Eliminando…' : 'Eliminar'}
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
              <strong>Desde</strong>
              <span>{item.dateStart || '-'}</span>
            </div>
            <div>
              <strong>Hasta</strong>
              <span>{item.dateEnd || '-'}</span>
            </div>
            <div>
              <strong>Actualizado</strong>
              <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </div>

          <form className="dataset-form" onSubmit={(e) => onSubmitEdit(e, item.ID)}>
            <h4>Editar dataset</h4>
            <div className="form-grid">
              {FIELD_CONFIG.map(({ name, label, type, placeholder, as }) => (
                <label key={name} className="form-field">
                  <span>{label}</span>
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
                      onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <button type="submit" className="btn-primary" disabled={submittingId === item.ID}>
              {submittingId === item.ID ? 'Guardando…' : 'Actualizar'}
            </button>
          </form>
        </div>
      )}
    </article>
  );
};

export default DatasetCard;
