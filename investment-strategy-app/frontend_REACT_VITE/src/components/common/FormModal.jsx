
import React, { useReducer } from 'react';

function getInputType(field, value) {
    const isDate = ['date', 'ts', '_at', '_at_utc'].some(s => field.toLowerCase().includes(s));
    if (isDate) return 'datetime-local';
    if (typeof value === 'number') return 'number';
    return 'text';
}

function formatValue(field, value) {
    const isDate = ['date', 'ts', '_at', '_at_utc'].some(s => field.toLowerCase().includes(s));
    if (isDate && value) {
        return new Date(new Date(value).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    return value ?? '';
}

const initialState = (item) => ({ ...item });

function reducer(state, action) {
    switch (action.type) {
        case 'field':
            return { ...state, [action.field]: action.value };
        case 'reset':
            return initialState(action.item);
        default:
            return state;
    }
}

const FormModal = ({ item, fields, entityName, onClose, onSave }) => {
    const [formData, dispatch] = useReducer(reducer, item, initialState);
    const [error, setError] = React.useState('');

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        let finalValue = value;
        if (type === 'number') {
            finalValue = parseFloat(value) || null;
        } else if (type === 'datetime-local') {
            finalValue = value ? new Date(value).toISOString() : null;
        }
        dispatch({ type: 'field', field: name, value: finalValue });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validación básica: todos los campos requeridos
        for (const field of fields) {
            if (!formData[field]) {
                setError(`El campo "${field.replace(/_/g, ' ')}" es obligatorio.`);
                return;
            }
        }
        setError('');
        onSave(formData);
    };

    const title = item?.ID ? `Editar ${entityName}` : `Crear nuevo ${entityName}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 transition-opacity duration-300" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light leading-none" aria-label="Cerrar">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {fields.map(field => (
                        <div key={field} className="flex flex-col">
                            <label htmlFor={field} className="mb-1 font-medium text-gray-700 capitalize">{field.replace(/_/g, ' ')}</label>
                            <input
                                type={getInputType(field, item?.[field])}
                                id={field}
                                name={field}
                                value={formatValue(field, formData[field])}
                                onChange={handleChange}
                                step={getInputType(field, item?.[field]) === 'number' ? 'any' : undefined}
                                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                placeholder={`Ingresa ${field.replace(/_/g, ' ')}`}
                                required
                            />
                        </div>
                    ))}
                    {error && <div className="error-message" style={{ color: '#d32f2f', marginBottom: '1rem', textAlign: 'center', fontWeight: 500 }}>{error}</div>}
                    <div className="flex justify-end items-center border-t pt-4 mt-4 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-200">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-200">Guardar</button>
                    </div>
                </form>
            </div>
            <style>{`
                @keyframes fade-in-scale {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default FormModal;
