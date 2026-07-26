import React, { useState, useRef, useEffect } from 'react';

export default function SearchableMultiSelect({
  options = [],
  value = [], // Array of selected value strings
  onChange,
  placeholder = 'Select categories...',
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

  const selectedList = Array.isArray(value) ? value : (value ? [value] : []);

  const filteredOptions = options.filter(opt => {
    const text = typeof opt === 'string' ? opt : opt[labelKey];
    return text.toLowerCase().includes(search.toLowerCase());
  });

  const handleToggle = (opt) => {
    const val = typeof opt === 'string' ? opt : opt[valueKey];
    let nextList;
    if (selectedList.includes(val)) {
      nextList = selectedList.filter(item => item !== val);
    } else {
      nextList = [...selectedList, val];
    }
    onChange(nextList);
  };

  const handleRemoveChip = (e, val) => {
    e.stopPropagation();
    onChange(selectedList.filter(item => item !== val));
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          minHeight: '38px',
          padding: '6px 10px',
          borderRadius: '6px',
          border: error ? '1px solid #ef4444' : '1px solid #cbd5e1',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', flex: 1 }}>
          {selectedList.length === 0 ? (
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>{placeholder}</span>
          ) : (
            selectedList.map((itemVal, idx) => (
              <span
                key={idx}
                style={{
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  borderRadius: '16px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {itemVal}
                <span
                  onClick={(e) => handleRemoveChip(e, itemVal)}
                  style={{ cursor: 'pointer', color: '#1d4ed8', fontWeight: 'bold', fontSize: '12px' }}
                >
                  ×
                </span>
              </span>
            ))
          )}
        </div>
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
            placeholder="🔍 Search categories..."
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
              No categories found
            </div>
          ) : (
            filteredOptions.map((opt, index) => {
              const itemVal = typeof opt === 'string' ? opt : opt[valueKey];
              const itemLabel = typeof opt === 'string' ? opt : opt[labelKey];
              const isChecked = selectedList.includes(itemVal);

              return (
                <div
                  key={index}
                  onClick={() => handleToggle(opt)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isChecked ? '#f0fdf4' : 'transparent',
                    color: isChecked ? '#166534' : '#334155',
                    fontWeight: isChecked ? '600' : '400',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isChecked) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isChecked) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{itemLabel}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
