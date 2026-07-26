import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateCustomerForm, formatMobileInput, formatNumberInput, sanitizeText } from '../utils/validation';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit' | null
  const [formData, setFormData] = useState({ name: '', mobile: '', address: '', gstNumber: '', notes: '', defaultRecurringDays: '', creditLimit: '', password: '' });
  const [touched, setTouched] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  // Profile Modal State
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await api.get(`/customers?search=${search}`);
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const formErrors = validateCustomerForm(formData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleOpenAdd = () => {
    setFormData({ name: '', mobile: '', address: '', gstNumber: '', notes: '', defaultRecurringDays: '', creditLimit: '', password: '' });
    setTouched({});
    setFormMode('add');
  };

  const handleOpenEdit = (customer) => {
    setFormData({
      name: customer.name,
      mobile: customer.mobile,
      address: customer.address,
      gstNumber: customer.gstNumber || '',
      notes: customer.notes || '',
      defaultRecurringDays: customer.defaultRecurringDays || '',
      creditLimit: customer.creditLimit || '',
      password: ''
    });
    setTouched({});
    setSelectedId(customer._id);
    setFormMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateCustomerForm(formData);
    if (Object.values(errors).some(Boolean)) {

      setTouched({ name: true, mobile: true, address: true, gstNumber: true, defaultRecurringDays: true, creditLimit: true, password: true });
      return;
    }
    const sanitizedData = {
      ...formData,
      name: sanitizeText(formData.name),
      address: sanitizeText(formData.address),
      gstNumber: formData.gstNumber ? formData.gstNumber.trim().toUpperCase() : '',
      notes: sanitizeText(formData.notes)
    };
    try {
      setError('');
      if (formMode === 'add') {
        await api.post('/customers', sanitizedData);
      } else {
        await api.put(`/customers/${selectedId}`, sanitizedData);
      }
      setFormMode(null);
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save customer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      setError('');
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      console.error(err);
      setError('Failed to delete customer');
    }
  };

  const handleOpenProfile = async (customer) => {
    setProfileCustomer(customer);
    setProfileLoading(true);
    try {
      const res = await api.get(`/customers/${customer._id}`);
      setProfileData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch customer profile ledger');
    } finally {
      setProfileLoading(false);
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
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <input 
          type="text"
          placeholder="🔍 Search customers by name or mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '320px', outline: 'none' }}
        />
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Add Customer
        </button>
      </div>

      {/* Customer List Table */}
      {loading ? (
        <div>Loading customer records...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer Name</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Mobile</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>GSTIN</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Credit Limit</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Address</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length > 0 ? (
                customers.map(c => (
                  <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: '#1e293b' }}>
                      <span onClick={() => handleOpenProfile(c)} style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>{c.name}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155' }}>{c.mobile}</td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>{c.gstNumber || 'N/A'}</td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>{c.creditLimit > 0 ? `Rs. ${c.creditLimit}` : 'None'}</td>
                    <td style={{ padding: '14px 20px', color: '#475569', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleOpenProfile(c)}
                        style={{ padding: '6px 12px', background: '#ecfdf5', color: '#047857', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        📂 Ledger
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(c)}
                        style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(c._id)}
                        style={{ padding: '6px 12px', background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>{formMode === 'add' ? 'Add New Customer' : 'Edit Customer'}</h3>
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Customer Name<span style={{ color: '#ef4444' }}>*</span>
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
                  Mobile Number<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="tel" 
                  value={formData.mobile} 
                  onChange={(e) => setFormData({ ...formData, mobile: formatMobileInput(e.target.value) })}
                  onBlur={() => handleBlur('mobile')}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.mobile && formErrors.mobile ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.mobile && formErrors.mobile && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.mobile}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>GST Number (Optional)</label>
                <input 
                  type="text" 
                  value={formData.gstNumber} 
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                  onBlur={() => handleBlur('gstNumber')}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  maxLength={15}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.gstNumber && formErrors.gstNumber ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.gstNumber && formErrors.gstNumber && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.gstNumber}</div>
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
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Notes</label>
                <input 
                  type="text" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Default Order Loop (Days) - Optional</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 30"
                  value={formData.defaultRecurringDays} 
                  onChange={(e) => setFormData({ ...formData, defaultRecurringDays: formatNumberInput(e.target.value, false) })}
                  onBlur={() => handleBlur('defaultRecurringDays')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.defaultRecurringDays && formErrors.defaultRecurringDays ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.defaultRecurringDays && formErrors.defaultRecurringDays && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.defaultRecurringDays}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Credit Limit (Rs.) - Optional</label>
                <input 
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 50000"
                  value={formData.creditLimit} 
                  onChange={(e) => setFormData({ ...formData, creditLimit: formatNumberInput(e.target.value, true) })}
                  onBlur={() => handleBlur('creditLimit')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.creditLimit && formErrors.creditLimit ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.creditLimit && formErrors.creditLimit && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.creditLimit}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Portal Password (Optional)</label>
                <input 
                  type="text"
                  placeholder={formMode === 'edit' ? "Leave blank to keep unchanged" : "Set password for customer portal"}
                  value={formData.password} 
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onBlur={() => handleBlur('password')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.password && formErrors.password ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.password && formErrors.password && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.password}</div>
                )}
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

      {/* Customer Profile / Ledger Modal */}
      {profileCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{profileCustomer.name}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>📍 {profileCustomer.address} | 📞 {profileCustomer.mobile}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    const token = localStorage.getItem('sis_jwt_token');
                    window.open(`${api.defaults.baseURL}/reports/ledger?customerId=${profileCustomer._id}&pdf=true&token=${token}`, '_blank');
                  }}
                  style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
                >
                  📋 Download Statement PDF
                </button>
                <button 
                  onClick={() => setProfileCustomer(null)}
                  style={{ background: '#cbd5e1', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', color: '#1e293b', fontWeight: 'bold' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {profileLoading ? (
              <div>Loading ledger statements...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Financial Summary */}
                <div style={{ display: 'flex', gap: '15px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Outstanding Balance</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#b91c1c', marginTop: '4px' }}>
                      Rs. {profileData?.outstanding?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid #cbd5e1', paddingLeft: '15px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Invoiced</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#334155', marginTop: '4px' }}>
                      Rs. {profileData?.billHistory?.reduce((sum, b) => sum + b.totalAmount, 0).toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>

                {/* Financial Transactions */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>Financial Transactions</h4>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Date</th>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Activity Type</th>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Ref ID</th>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Status</th>
                          <th style={{ padding: '10px 15px', color: '#475569', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileData?.timeline && profileData.timeline.filter(t => ['Invoice', 'Payment', 'Refund'].includes(t.type)).length > 0 ? (
                          profileData.timeline.filter(t => ['Invoice', 'Payment', 'Refund'].includes(t.type)).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 15px', color: '#475569' }}>{new Date(item.date).toLocaleDateString()}</td>
                              <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#334155' }}>{item.type}</td>
                              <td style={{ padding: '10px 15px', color: '#475569' }}>{item.ref}</td>
                              <td style={{ padding: '10px 15px' }}>
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: item.status === 'Paid' || item.status === 'Cleared' ? '#d1fae5' : '#fee2e2',
                                  color: item.status === 'Paid' || item.status === 'Cleared' ? '#065f46' : '#b91c1c',
                                  fontWeight: '600'
                                }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 15px', textAlign: 'right', fontWeight: 'bold', color: item.type.includes('Payment') ? '#166534' : '#1e293b' }}>
                                {item.type.includes('Payment') ? '-' : ''}Rs. {item.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ padding: '20px', textLight: 'center', color: '#94a3b8' }}>No financial transactions found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Order History */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>Order History</h4>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Date</th>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Activity Type</th>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Ref ID</th>
                          <th style={{ padding: '10px 15px', color: '#475569' }}>Status</th>
                          <th style={{ padding: '10px 15px', color: '#475569', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileData?.timeline && profileData.timeline.filter(t => ['Order', 'Quotation'].includes(t.type)).length > 0 ? (
                          profileData.timeline.filter(t => ['Order', 'Quotation'].includes(t.type)).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 15px', color: '#475569' }}>{new Date(item.date).toLocaleDateString()}</td>
                              <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#334155' }}>{item.type}</td>
                              <td style={{ padding: '10px 15px', color: '#475569' }}>{item.ref}</td>
                              <td style={{ padding: '10px 15px' }}>
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: item.status === 'Delivered' || item.status === 'Completed' ? '#d1fae5' : '#e0e7ff',
                                  color: item.status === 'Delivered' || item.status === 'Completed' ? '#065f46' : '#3730a3',
                                  fontWeight: '600'
                                }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 15px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                                Rs. {item.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ padding: '20px', textLight: 'center', color: '#94a3b8' }}>No order history found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
