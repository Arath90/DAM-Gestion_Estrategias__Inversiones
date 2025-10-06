import React, { useState } from 'react';

const FormModal = ({ item, fields, entityName, onClose, onSave }) => {
    // Initialize form data from the item prop, or as an empty object.
    const [formData, setFormData] = useState(item || {});

    // Handles changes in form inputs.
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        
        let finalValue = value;
        // Correctly parse numbers and dates before updating state.
        if (type === 'number') {
            finalValue = parseFloat(value) || null;
        } else if (type === 'datetime-local') {
            finalValue = value ? new Date(value).toISOString() : null;
        }
        
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    // Handles form submission.
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    // Determine the modal title based on whether we are editing or creating an item.
    const title = item?.ID ? `Edit ${entityName}` : `Create New ${entityName}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 transition-opacity duration-300">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light leading-none">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {fields.map(field => {
                        const value = formData[field] ?? '';
                        
                        // Heuristics to determine if a field is a date for appropriate input rendering.
                        const isDate = ['date', 'ts', '_at', '_at_utc'].some(s => field.toLowerCase().includes(s));
                        let inputType = 'text';

                        // Determine the input type based on original data type or field name.
                        if (isDate) {
                            inputType = 'datetime-local';
                        } else if (typeof item?.[field] === 'number') {
                            inputType = 'number';
                        }

                        // Format date values for the datetime-local input.
                        const displayValue = (isDate && value)
                            ? new Date(new Date(value).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                            : value;

                        return (
                            <div key={field} className="flex flex-col">
                                <label htmlFor={field} className="mb-1 font-medium text-gray-700 capitalize">{field.replace(/_/g, ' ')}</label>
                                <input
                                    type={inputType}
                                    id={field}
                                    name={field}
                                    value={displayValue}
                                    onChange={handleChange}
                                    step={inputType === 'number' ? 'any' : undefined}
                                    className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                                />
                            </div>
                        );
                    })}
                    <div className="flex justify-end items-center border-t pt-4 mt-4 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-200">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-200">Save</button>
                    </div>
                </form>
            </div>
            {/* Simple keyframe animation for modal popup */}
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