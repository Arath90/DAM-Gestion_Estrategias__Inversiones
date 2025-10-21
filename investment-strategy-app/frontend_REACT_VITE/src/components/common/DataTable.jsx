
import React, { useMemo } from 'react';
import './DataTable.css';

const Icon = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d={path} />
    </svg>
);
const ICONS = {
    edit: "M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z M5 14a1 1 0 11-2 0 1 1 0 012 0z M3 13a1 1 0 011-1h1.586l-2-2H3a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-1.586l-2-2V13H3z",
    delete: "M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z",
};

function formatCell(field, value) {
    if (field.toLowerCase().includes('date') || field.toLowerCase().includes('ts') || field.toLowerCase().includes('at')) {
        if (!value) return 'N/A';
        try {
            return new Date(value).toISOString().slice(0, 10);
        } catch {
            return value;
        }
    }
    return String(value ?? 'N/A');
}

const DataTable = ({ items, fields, onEdit, onDelete }) => {
    const displayFields = useMemo(() => ['ID', ...fields], [fields]);

    if (!items || items.length === 0) {
        return <div className="no-items-message">No hay elementos.</div>;
    }

    return (
        <div className="data-table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        {displayFields.map(field => (
                            <th key={field}>{field.replace(/_/g, ' ')}</th>
                        ))}
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => (
                        <tr key={item.ID}>
                            {displayFields.map(field => (
                                <td key={field} data-label={field}>
                                    {formatCell(field, item[field])}
                                </td>
                            ))}
                            <td data-label="Acciones" className="actions-cell">
                                <button
                                    onClick={() => onEdit(item)}
                                    className="action-btn edit-btn"
                                    title="Editar"
                                    aria-label={`Editar ${item.ID}`}
                                >
                                    <Icon path={ICONS.edit} />
                                </button>
                                <button
                                    onClick={() => onDelete(item.ID)}
                                    className="action-btn delete-btn"
                                    title="Eliminar"
                                    aria-label={`Eliminar ${item.ID}`}
                                >
                                    <Icon path={ICONS.delete} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;
