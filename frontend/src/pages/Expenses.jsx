import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateExpenseForm, formatNumberInput, sanitizeText } from '../utils/validation';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ category: 'fuel', amount: '', date: '', notes: '', receiptImage: '', branchId: '' });
  const [touched, setTouched] = useState({});

  const fetchData = async () => {
    try {
      const [expRes, branchRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/branches')
      ]);
      setExpenses(expRes.data);
      setBranches(branchRes.data);
      if (branchRes.data.length > 0) {
        setFormData(prev => ({ ...prev, branchId: branchRes.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch expenses directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formErrors = validateExpenseForm(formData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, receiptImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    const errors = validateExpenseForm(formData);
    if (Object.values(errors).some(Boolean)) {

      setTouched({ category: true, amount: true, branchId: true });
      return;
    }
    const payload = {
      ...formData,
      notes: sanitizeText(formData.notes)
    };
    try {
      await api.post('/expenses', payload);
      setSuccess('Expense logged successfully! ✅');
      setShowAdd(false);
      setTouched({});
      setFormData({ category: 'fuel', amount: '', date: '', notes: '', receiptImage: '', branchId: branches[0]?._id || '' });
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to record expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense entry?')) return;
    setSuccess('');
    setError('');
    try {
      await api.delete(`/expenses/${id}`);
      setSuccess('Expense entry removed successfully. ✅');
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to delete expense entry');
    }
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading expense loggers...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {success && (
        <div style={{ padding: '12px', background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '8px', fontSize: '13px' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Expenses</h2>
        <button 
          onClick={() => setShowAdd(true)}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Add Expense
        </button>
      </div>

      {/* Expenses Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Date</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Category</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Branch</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Amount</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Notes</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Receipt Attached</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length > 0 ? (
              expenses.map(e => (
                <tr key={e._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', color: '#475569' }}>{new Date(e.date).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 'bold', textTransform: 'capitalize', color: '#1e293b' }}>{e.category}</td>
                  <td style={{ padding: '14px 20px', color: '#475569' }}>{e.branch?.name || 'N/A'}</td>
                  <td style={{ padding: '14px 20px', color: '#b91c1c', fontWeight: 'bold' }}>Rs. {e.amount.toFixed(2)}</td>
                  <td style={{ padding: '14px 20px', color: '#475569' }}>{e.notes || '-'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    {e.receiptImage ? (
                      <a href={e.receiptImage} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '12px' }}>👁️ View Receipt</a>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDelete(e._id)}
                      style={{ padding: '6px 12px', background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No expenses logged for this branch.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Expense Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Add Expense</h3>
            
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Category<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="rent">Rent</option>
                  <option value="salary">Salary</option>
                  <option value="fuel">Fuel</option>
                  <option value="misc">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Amount (Rs.)<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatNumberInput(e.target.value, true) })}
                  onBlur={() => handleBlur('amount')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.amount && formErrors.amount ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                />
                {touched.amount && formErrors.amount && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.amount}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Date of Expense</label>
                <input 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Branch<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={formData.branchId} 
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {branches.map(br => (
                    <option key={br._id} value={br._id}>{br.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Notes</label>
                <input 
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Upload Receipt (File)</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ width: '100%', fontSize: '12px' }}
                />
                {formData.receiptImage && (
                  <img src={formData.receiptImage} alt="Receipt Preview" style={{ maxHeight: '60px', marginTop: '10px', objectFit: 'contain' }} />
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAdd(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!isFormValid}
                  style={{ flex: 1, padding: '10px', background: isFormValid ? '#3b82f6' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isFormValid ? 'pointer' : 'not-allowed' }}
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
