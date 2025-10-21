
import React, { useReducer, useCallback, useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import FormModal from '../common/FormModal.jsx';
import DataTable from '../common/DataTable.jsx';
import * as api from '../../services/catalog.js';
import '../../css/GenericCrudView.css';

const initialState = {
    searchTerm: '',
    isFormOpen: false,
    selectedItem: null,
    key: 0,
};

function reducer(state, action) {
    switch (action.type) {
        case 'search':
            return { ...state, searchTerm: action.value };
        case 'openForm':
            return { ...state, isFormOpen: true, selectedItem: action.item };
        case 'closeForm':
            return { ...state, isFormOpen: false, selectedItem: null };
        case 'refresh':
            return { ...state, key: state.key + 1 };
        default:
            return state;
    }
}

const Icon = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
);
const ICONS = {
    add: "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z",
};

const GenericCrudView = ({ entityName, entityConfig }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const debouncedSearchTerm = useDebounce(state.searchTerm, 300);
    const apiService = api[entityConfig.api];

    const fetchData = useCallback(() => {
        const filter = debouncedSearchTerm
            ? `contains(tolower(symbol), '${debouncedSearchTerm.toLowerCase()}')`
            : undefined;
        return apiService.list({ filter });
    }, [apiService, debouncedSearchTerm]);

    const { data: items, loading, error, reload } = useFetch(fetchData, [debouncedSearchTerm, state.key]);

    const handleSave = async (item) => {
        try {
            if (item.ID) {
                await apiService.update(item.ID, item);
            } else {
                await apiService.create(item);
            }
            dispatch({ type: 'closeForm' });
            reload();
        } catch (err) {
            console.error('Failed to save item:', err);
            alert(`Error saving: ${err.message}`);
        }
    };

    const handleDelete = async (itemId) => {
        if (window.confirm('¿Seguro que deseas eliminar este elemento?')) {
            try {
                await apiService.remove(itemId);
                reload();
            } catch (err) {
                console.error('Failed to delete item:', err);
                alert(`Error deleting: ${err.message}`);
            }
        }
    };

    const openFormForCreate = useCallback(() => {
        dispatch({ type: 'openForm', item: {} });
    }, []);

    const openFormForEdit = useCallback((item) => {
        dispatch({ type: 'openForm', item });
    }, []);

    const handleSearchChange = (e) => {
        dispatch({ type: 'search', value: e.target.value });
    };

    return (
        <div className="generic-view-container">
            <div className="view-header">
                <input
                    type="text"
                    placeholder={`Buscar en ${entityName}...`}
                    value={state.searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                />
                <button onClick={openFormForCreate} className="add-button">
                    <Icon path={ICONS.add} />
                    <span>Crear Nuevo</span>
                </button>
            </div>

            {loading && <p>Loading...</p>}
            {error && <p className="error-message">Error al obtener datos: {error.message}</p>}

            {!loading && !error && (
                <DataTable
                    items={items || []}
                    fields={entityConfig.fields}
                    onEdit={openFormForEdit}
                    onDelete={handleDelete}
                />
            )}

            {state.isFormOpen && (
                <FormModal
                    item={state.selectedItem}
                    fields={entityConfig.fields}
                    entityName={entityName}
                    onClose={() => dispatch({ type: 'closeForm' })}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default GenericCrudView;
