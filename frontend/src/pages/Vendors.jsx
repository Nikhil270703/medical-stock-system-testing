import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateVendorForm, formatMobileInput, formatNumberInput, sanitizeText } from '../utils/validation';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit' | null
  const [formData, setFormData] = useState({ name: '', contact: '', address: '', itemCategories: '', performanceScore: 100, qualityRating: 5 });
  const [touched, setTouched] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const formErrors = validateVendorForm(formData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleOpenAdd = () => {
    setFormData({ name: '', contact: '', address: '', itemCategories: '', performanceScore: 100, qualityRating: 5 });
    setTouched({});
    setFormMode('add');
  };

  const handleOpenEdit = (vendor) => {
    setFormData({
      name: vendor.name,
      contact: vendor.contact,
      address: vendor.address,
      itemCategories: vendor.itemCategories ? vendor.itemCategories.join(', ') : '',
      performanceScore: vendor.performanceScore || 100,
      qualityRating: vendor.qualityRating || 5
    });
    setTouched({});
    setSelectedId(vendor._id);
    setFormMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateVendorForm(formData);
    if (Object.values(errors).some(Boolean)) {

      setTouched({ name: true, contact: true, address: true, performanceScore: true, qualityRating: true });
      return;
    }
    try {
      setError('');
      // Convert comma-separated string to array
      const categoriesArray = formData.itemCategories
        ? formData.itemCategories.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        ...formData,
        name: sanitizeText(formData.name),
        address: sanitizeText(formData.address),
        itemCategories: categoriesArray
      };

      if (formMode === 'add') {
        await api.post('/vendors', payload);
      } else {
        await api.put(`/vendors/${selectedId}`, payload);
      }
      setFormMode(null);
      fetchVendors();
    } catch (err) {
      console.error(err);
      setError('Failed to save vendor details');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This might affect products linked to this vendor.')) return;
    try {
      setError('');
      await api.delete(`/vendors/${id}`);
      fetchVendors();
    } catch (err) {
      console.error(err);
      setError('Failed to delete vendor');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Supplier Master Directory</h2>
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Add Vendor
        </button>
      </div>

      {/* Vendors Table */}
      {loading ? (
        <div>Loading vendor list...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Vendor Name</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Contact Details</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Performance</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Categories Supplied</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Address</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length > 0 ? (
                vendors.map(v => (
                  <tr key={v._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: '#1e293b' }}>{v.name}</td>
                    <td style={{ padding: '14px 20px', color: '#334155' }}>{v.contact}</td>
                    <td style={{ padding: '14px 20px', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: v.performanceScore >= 80 ? '#d1fae5' : v.performanceScore >= 50 ? '#fef3c7' : '#fee2e2', color: v.performanceScore >= 80 ? '#065f46' : v.performanceScore >= 50 ? '#b45309' : '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                          {v.performanceScore || 100}
                        </div>
                        <div style={{ display: 'flex', color: '#f59e0b', fontSize: '12px' }}>
                          {'★'.repeat(Math.max(0, Math.min(5, v.qualityRating || 5)))}
                          {'☆'.repeat(Math.max(0, 5 - Math.min(5, v.qualityRating || 5)))}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {v.itemCategories && v.itemCategories.map((c, i) => (
                          <span key={i} style={{ background: '#eff6ff', color: '#3b82f6', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>{v.address}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleOpenEdit(v)}
                        style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(v._id)}
                        style={{ padding: '6px 12px', background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No vendors found. Add one to get started!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>{formMode === 'add' ? 'Add New Supplier Vendor' : 'Edit Supplier Vendor'}</h3>
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Vendor Name<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onBlur={() => handleBlur('name')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.name && formErrors.name ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.name && formErrors.name && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.name}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Contact Phone/Mobile<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="tel" 
                  value={formData.contact} 
                  onChange={(e) => setFormData({ ...formData, contact: formatMobileInput(e.target.value) })}
                  onBlur={() => handleBlur('contact')}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.contact && formErrors.contact ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.contact && formErrors.contact && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.contact}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Address<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea 
                  value={formData.address} 
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  onBlur={() => handleBlur('address')}
                  rows="3"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.address && formErrors.address ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.address && formErrors.address && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.address}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Item Categories Supplied (comma separated)</label>
                <input 
                  type="text" 
                  value={formData.itemCategories} 
                  placeholder="e.g. Medicines, Supplements, Hygiene"
                  onChange={(e) => setFormData({ ...formData, itemCategories: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Performance Score (0-100)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formData.performanceScore} 
                    onChange={(e) => setFormData({ ...formData, performanceScore: formatNumberInput(e.target.value, false) })}
                    onBlur={() => handleBlur('performanceScore')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.performanceScore && formErrors.performanceScore ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                  />
                  {touched.performanceScore && formErrors.performanceScore && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.performanceScore}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Quality Rating (1-5)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={formData.qualityRating} 
                    onChange={(e) => setFormData({ ...formData, qualityRating: formatNumberInput(e.target.value, false) })}
                    onBlur={() => handleBlur('qualityRating')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.qualityRating && formErrors.qualityRating ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                  />
                  {touched.qualityRating && formErrors.qualityRating && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.qualityRating}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setFormMode(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!isFormValid}
                  style={{ flex: 1, padding: '10px', background: isFormValid ? '#3b82f6' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isFormValid ? 'pointer' : 'not-allowed' }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
