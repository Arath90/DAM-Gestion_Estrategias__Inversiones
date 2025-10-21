// src/components/common/Drawer.jsx
import React from 'react';

export default function Drawer({ open, title, onClose, children, width = 520 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 h-full bg-[#111827] text-white shadow-2xl p-6 overflow-y-auto"
        style={{ width }}
      >
        <header className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none opacity-70 hover:opacity-100" aria-label="Close">
            x
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}
