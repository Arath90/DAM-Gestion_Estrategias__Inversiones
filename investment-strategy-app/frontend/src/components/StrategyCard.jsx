import React from 'react';

const StrategyCard = ({
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
    <article className={`strategy-row${isExpanded ? ' expanded' : ''}`}>
      <header className="strategy-head">
        <button type="button" className="strategy-toggle" onClick={() => onToggle(item.ID)}>
          <span className="title">{item.name || 'Sin nombre'}</span>
          <span className="meta">
            {item.type || 'N/D'} &middot; {item.status || 'Sin estado'} &middot;{' '}
            {item.owner || 'Sin dueño'}
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
        <div className="strategy-dropdown">
          <div className="strategy-details">
            <div>
              <strong>ID</strong>
              <span>{item.ID}</span>
            </div>
            <div>
              <strong>Capital asignado</strong>
              <span>{item.capital_allocated != null ? item.capital_allocated : '-'}</span>
            </div>
            <div>
              <strong>Frecuencia</strong>
              <span>{item.frequency || '-'}</span>
            </div>
            <div>
              <strong>Etiquetas</strong>
              <span>{Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '-')}</span>
            </div>
            <div>
              <strong>Creada</strong>
              <span>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</span>
            </div>
            <div>
              <strong>Actualizada</strong>
              <span>{item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</span>
            </div>
          </div>

          <form className="estrategia-form" onSubmit={(e) => onSubmitEdit(e, item.ID)}>
            <h4>Editar estrategia</h4>
            <div className="form-grid">
              {FIELD_CONFIG.map(({ name, label, type, placeholder, step, as, options }) => (
                <label key={name} className="form-field">
                  <span>{label}</span>
                  {as === 'textarea' ? (
                    <textarea
                      value={editState[name] ?? ''}
                      placeholder={placeholder}
                      onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                    />
                  ) : as === 'select' ? (
                    <select
                      value={editState[name] ?? ''}
                      onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                    >
                      {(options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type}
                      value={editState[name] ?? ''}
                      {...(['text', 'number', 'email', 'password', 'search', 'tel', 'url'].includes(type) && placeholder
                        ? { placeholder }
                        : {})}
                      step={step}
                      onChange={(ev) => onChangeField(item.ID, name, ev.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <button type="submit" className="primary" disabled={submittingId === item.ID}>
              {submittingId === item.ID ? 'Guardando...' : 'Actualizar'}
            </button>
          </form>
        </div>
      )}
    </article>
  );
};

export default StrategyCard;
