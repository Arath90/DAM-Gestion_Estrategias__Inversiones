import React from 'react';
import './DataTable.css';
// DataTable.jsx
// --- Iconos SVG ---
const Icon = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d={path} />
    </svg>
);
const ICONS = {
    edit: "M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z M5 14a1 1 0 11-2 0 1 1 0 012 0z M3 13a1 1 0 011-1h1.586l-2-2H3a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-1.586l-2-2V13H3z",
    delete: "M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z",
};

const DataTable = ({ items, fields, onEdit, onDelete }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toISOString().slice(0, 10);
        } catch (e) {
            return dateString;
        }
    };
    
    if (!items || items.length === 0) {
        return <div className="no-items-message">No items found.</div>;
    }

    const displayFields = ['ID', ...fields];

    return (
        <div className="data-table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        {displayFields.map(field => (
                            <th key={field}>{field.replace(/_/g, ' ')}</th>
                        ))}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => (
                        <tr key={item.ID}>
                            {displayFields.map(field => (
                                <td key={field} data-label={field}>
                                    {field.includes('date') || field.includes('ts') || field.includes('At')
                                        ? formatDate(item[field])
                                        : String(item[field] ?? 'N/A')}
                                </td>
                            ))}
                            <td data-label="Actions" className="actions-cell">
                                <button onClick={() => onEdit(item)} className="action-btn edit-btn" title="Edit">
                                    <Icon path={ICONS.edit} />
                                </button>
                                <button onClick={() => onDelete(item.ID)} className="action-btn delete-btn" title="Delete">
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
