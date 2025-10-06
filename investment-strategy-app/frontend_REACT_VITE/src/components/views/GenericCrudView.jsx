import React, { useState, useCallback } from 'react';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import FormModal from '../common/FormModal.jsx';
import DataTable from '../common/DataTable.jsx';
import * as api from '../../services/catalog.js';
import '../css/GenericCrudView.css';

// --- Iconos SVG ---
const Icon = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
);
const ICONS = {
    add: "M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z",
};

const GenericCrudView = ({ entityName, entityConfig }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [key, setKey] = useState(0); // Para forzar re-fetch

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const apiService = api[entityConfig.api];
    
    const fetchData = useCallback(() => {
        const filter = debouncedSearchTerm 
            ? `contains(tolower(symbol), '${debouncedSearchTerm.toLowerCase()}')` // Ajusta 'symbol' al campo principal de búsqueda
            : undefined;
        return apiService.list({ filter });
    }, [apiService, debouncedSearchTerm]);

    const { data: items, loading, error, reload } = useFetch(fetchData, [debouncedSearchTerm, key]);
    
    const handleRefresh = () => setKey(k => k + 1);

    const handleSave = async (item) => {
        try {
            if (item.ID) {
                await apiService.update(item.ID, item);
            } else {
                await apiService.create(item);
            }
            setIsFormOpen(false);
            reload();
        } catch (err) {
            console.error('Failed to save item:', err);
            alert(`Error saving: ${err.message}`);
        }
    };

    const handleDelete = async (itemId) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                await apiService.remove(itemId);
                reload();
            } catch (err) {
                console.error('Failed to delete item:', err);
                alert(`Error deleting: ${err.message}`);
            }
        }
    };

    const openFormForCreate = () => {
        setSelectedItem({});
        setIsFormOpen(true);
    };

    const openFormForEdit = (item) => {
        setSelectedItem(item);
        setIsFormOpen(true);
    };

    return (
        <div className="generic-view-container">
            <div className="view-header">
                <input
                    type="text"
                    placeholder={`Search in ${entityName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
                <button onClick={openFormForCreate} className="add-button">
                    <Icon path={ICONS.add} />
                    <span>Create New</span>
                </button>
            </div>

            {loading && <p>Loading...</p>}
            {error && <p className="error-message">Error fetching data: {error.message}</p>}
            
            {!loading && !error && (
                <DataTable
                    items={items || []}
                    fields={entityConfig.fields}
                    onEdit={openFormForEdit}
                    onDelete={handleDelete}
                />
            )}

            {isFormOpen && (
                <FormModal
                    item={selectedItem}
                    fields={entityConfig.fields}
                    entityName={entityName}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default GenericCrudView;
