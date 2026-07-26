import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  validateMasterCategoryForm,
  validateMasterUnitForm,
  validateMasterHsnForm,
  sanitizeText
} from '../utils/validation';
import BulkImportModal from '../components/BulkImportModal';

export default function Masters() {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'units' | 'hsncodes'

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ value: '', status: 'Active' });
  const [touched, setTouched] = useState({});

  // Delete Confirm Modal
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '/categories';
      if (activeTab === 'units') endpoint = '/units';
      if (activeTab === 'hsncodes') endpoint = '/hsncodes';

      const res = await api.get(endpoint, {
        params: {
          search: search.trim(),
          status: statusFilter
        }
      });
      setItems(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch master data records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    setCurrentPage(1);
  }, [activeTab, search, statusFilter]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch('');
    setStatusFilter('All');
    setError('');
    setSuccess('');
    setShowModal(false);
    setDeleteConfirmItem(null);
  };

  // Validation according to current tab
  const getValidationErrors = (data) => {
    if (activeTab === 'hsncodes') {
      return validateMasterHsnForm({ code: data.value, status: data.status });
    }
    if (activeTab === 'units') {
      return validateMasterUnitForm({ name: data.value, status: data.status });
    }
    return validateMasterCategoryForm({ name: data.value, status: data.status });
  };

  const formErrors = getValidationErrors(formData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleOpenAdd = () => {
    setFormData({ value: '', status: 'Active' });
    setTouched({});
    setEditId(null);
    setFormMode('add');
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    const val = activeTab === 'hsncodes' ? item.code : item.name;
    setFormData({ value: val, status: item.status || 'Active' });
    setTouched({});
    setEditId(item._id);
    setFormMode('edit');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const errors = getValidationErrors(formData);
    if (Object.values(errors).some(Boolean)) {
      setTouched({ value: true });
      return;
    }

    const cleanValue = sanitizeText(formData.value);
    let endpoint = '/categories';
    let bodyKey = 'name';

    if (activeTab === 'units') {
      endpoint = '/units';
      bodyKey = 'name';
    } else if (activeTab === 'hsncodes') {
      endpoint = '/hsncodes';
      bodyKey = 'code';
    }

    const payload = {
      [bodyKey]: cleanValue,
      status: formData.status
    };

    try {
      if (formMode === 'add') {
        await api.post(endpoint, payload);
        setSuccess(`${getTabTitle()} item created successfully! ✅`);
      } else {
        await api.put(`${endpoint}/${editId}`, payload);
        setSuccess(`${getTabTitle()} item updated successfully! ✅`);
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        setError(err.response?.data?.error || `Duplicate ${getTabTitle()} entry detected.`);
      } else {
        setError(err.response?.data?.error || `Failed to save ${getTabTitle()} item.`);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    setError('');
    setSuccess('');

    let endpoint = '/categories';
    if (activeTab === 'units') endpoint = '/units';
    if (activeTab === 'hsncodes') endpoint = '/hsncodes';

    try {
      await api.delete(`${endpoint}/${deleteConfirmItem._id}`);
      setSuccess(`${getTabTitle()} item deleted successfully. ✅`);
      setDeleteConfirmItem(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || `Failed to delete ${getTabTitle()} item.`);
    }
  };

  const getTabTitle = () => {
    if (activeTab === 'categories') return 'Category';
    if (activeTab === 'units') return 'Unit';
    return 'HSN Code';
  };

  // Sorting
  const sortedItems = [...items].sort((a, b) => {
    const valA = (activeTab === 'hsncodes' ? a.code : a.name) || '';
    const valB = (activeTab === 'hsncodes' ? b.code : b.name) || '';
    if (sortOrder === 'asc') return valA.localeCompare(valB);
    return valB.localeCompare(valA);
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = sortedItems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Alerts */}
      {success && (
        <div style={{ padding: '12px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '8px', fontSize: '13px', fontWeight: '500' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', fontWeight: '500' }}>
          {error}
        </div>
      )}

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '12px', padding: '6px', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => handleTabChange('categories')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeTab === 'categories' ? '#fff' : 'transparent',
              fontWeight: '600',
              color: activeTab === 'categories' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'categories' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📁 Product Categories
          </button>
          <button
            onClick={() => handleTabChange('units')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeTab === 'units' ? '#fff' : 'transparent',
              fontWeight: '600',
              color: activeTab === 'units' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'units' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📏 Units
          </button>
          <button
            onClick={() => handleTabChange('hsncodes')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeTab === 'hsncodes' ? '#fff' : 'transparent',
              fontWeight: '600',
              color: activeTab === 'hsncodes' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'hsncodes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🏷️ HSN Codes
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              padding: '12px 18px',
              background: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(5,150,105,0.2)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#047857')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#059669')}
          >
            📥 Bulk Import Excel
          </button>

          <button
            onClick={handleOpenAdd}
            style={{
              padding: '12px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
          >
            ➕ Add New {getTabTitle()}
          </button>
        </div>
      </div>

      {/* Filter and Search Action Bar */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <input
          type="text"
          placeholder={`🔍 Search ${getTabTitle()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '300px', outline: 'none', fontSize: '13px' }}
        />

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px' }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Sort:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px' }}
            >
              <option value="asc">A - Z / Ascending</option>
              <option value="desc">Z - A / Descending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Loading master data directory...
          </div>
        ) : paginatedItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No master {getTabTitle()} records found matching your filters.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '14px 16px' }}>{getTabTitle()} Value</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 16px' }}>Created Date</th>
                <th style={{ padding: '14px 16px' }}>Updated Date</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const displayVal = activeTab === 'hsncodes' ? item.code : item.name;
                return (
                  <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {displayVal}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: item.status === 'Active' ? '#d1fae5' : '#fef2f2',
                          color: item.status === 'Active' ? '#065f46' : '#b91c1c'
                        }}
                      >
                        {item.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          style={{
                            padding: '6px 12px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmItem(item)}
                          style={{
                            padding: '6px 12px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Page {currentPage} of {totalPages} ({sortedItems.length} total records)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: currentPage === 1 ? '#f1f5f9' : '#fff',
                  color: currentPage === 1 ? '#94a3b8' : '#334155',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                &laquo; Prev
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: currentPage === totalPages ? '#f1f5f9' : '#fff',
                  color: currentPage === totalPages ? '#94a3b8' : '#334155',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                Next &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>
              {formMode === 'add' ? `Add ${getTabTitle()}` : `Edit ${getTabTitle()}`}
            </h3>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  {getTabTitle()} Value<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  onBlur={() => handleBlur('value')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.value && formErrors.value || (activeTab === 'hsncodes' ? formErrors.code : formErrors.name) ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                  placeholder={`Enter ${getTabTitle().toLowerCase()} value...`}
                />
                {touched.value && (formErrors.value || (activeTab === 'hsncodes' ? formErrors.code : formErrors.name)) && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    {formErrors.value || (activeTab === 'hsncodes' ? formErrors.code : formErrors.name)}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Status<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: isFormValid ? '#3b82f6' : '#94a3b8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: isFormValid ? 'pointer' : 'not-allowed'
                  }}
                >
                  {formMode === 'add' ? 'Save' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '20px' }}>
              Are you sure you want to delete this {getTabTitle()} item (
              <strong>{activeTab === 'hsncodes' ? deleteConfirmItem.code : deleteConfirmItem.name}</strong>
              )? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDeleteConfirmItem(null)}
                style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Import Modal */}
      {showImportModal && (
        <BulkImportModal
          moduleName={activeTab}
          title={getTabTitle()}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => fetchItems()}
        />
      )}

    </div>
  );
}
