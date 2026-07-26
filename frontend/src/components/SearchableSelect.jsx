import React, { useState, useRef, useEffect } from 'react';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  labelKey = 'name',
  valueKey = 'name',
  error = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    const text = typeof opt === 'string' ? opt : opt[labelKey];
    return text.toLowerCase().includes(search.toLowerCase());
  });

  const selectedText = typeof value === 'string' ? value : (value ? value[labelKey] : '');

  const handleSelect = (opt) => {
    const val = typeof opt === 'string' ? opt : opt[valueKey];
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: error ? '1px solid #ef4444' : '1px solid #cbd5e1',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: selectedText ? '#0f172a' : '#94a3b8'
        }}
      >
        <span>{selectedText || placeholder}</span>
        <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            zIndex: 1100,
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '6px'
          }}
        >
          <input
            type="text"
            placeholder="🔍 Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              marginBottom: '6px',
              outline: 'none',
              fontSize: '12px'
            }}
          />

          {filteredOptions.length === 0 ? (
            <div style={{ padding: '8px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
              No matches found
            </div>
          ) : (
            filteredOptions.map((opt, index) => {
              const itemVal = typeof opt === 'string' ? opt : opt[valueKey];
              const itemLabel = typeof opt === 'string' ? opt : opt[labelKey];
              const isSelected = itemVal === value;

              return (
                <div
                  key={index}
                  onClick={() => handleSelect(opt)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#2563eb' : '#334155',
                    fontWeight: isSelected ? '600' : '400',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {itemLabel}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
