import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateQuotationForm, formatNumberInput } from '../utils/validation';

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [formMode, setFormMode] = useState(null); // 'add' | 'edit' | null
  const [editId, setEditId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [validDays, setValidDays] = useState(15);
  const [quotationItems, setQuotationItems] = useState([{ product: '', quantity: 1, price: 0 }]);
  const [touched, setTouched] = useState({});

  const fetchData = async () => {
    try {
      const [qRes, custRes, prodRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/customers'),
        api.get('/products')
      ]);
      setQuotations(qRes.data);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch quotations or master profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formErrors = validateQuotationForm(selectedCustomerId, validDays, quotationItems);
  const isFormValid = !Object.values(formErrors).some(Boolean);


  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleOpenAdd = () => {
    setSelectedCustomerId('');
    setValidDays(15);
    setQuotationItems([{ product: '', quantity: 1, price: 0 }]);
    setEditId(null);
    setFormMode('add');
  };

  const handleOpenEdit = (q) => {
    setSelectedCustomerId(q.customer?._id || q.customer);
    const diffTime = Math.abs(new Date(q.validUntil) - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setValidDays(diffDays || 15);
    setQuotationItems(q.items.map(i => ({ product: i.product?._id || i.product, quantity: i.quantity, price: i.price })));
    setEditId(q._id);
    setFormMode('edit');
  };

  const handleItemProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p._id === prodId);
    const updated = [...quotationItems];
    updated[index].product = prodId;
    updated[index].price = selectedProd ? selectedProd.price : 0;
    setQuotationItems(updated);
  };

  const handleItemQtyChange = (index, qty) => {
    const updated = [...quotationItems];
    updated[index].quantity = Math.max(1, Number(qty));
    setQuotationItems(updated);
  };

  const handleItemPriceChange = (index, price) => {
    const updated = [...quotationItems];
    updated[index].price = Math.max(0, Number(price));
    setQuotationItems(updated);
  };

  const handleAddItemRow = () => {
    setQuotationItems([...quotationItems, { product: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (quotationItems.length === 1) return;
    setQuotationItems(quotationItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return quotationItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        customer: selectedCustomerId,
        validDays,
        items: quotationItems.map(it => ({ product: it.product, quantity: it.quantity, price: it.price }))
      };
      
      if (formMode === 'edit') {
        await api.put(`/quotations/${editId}`, payload);
      } else {
        await api.post('/quotations', payload);
      }
      
      setFormMode(null);
      setEditId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit quotation');
    }
  };

  const handleConvertToOrder = async (id) => {
    if (!window.confirm('Are you sure you want to convert this quotation into a live dispatch order?')) return;
    const wantsLoop = window.confirm('Do you want this to be a recurring order (order loop)?');
    let recurringIntervalDays = 30;
    if (wantsLoop) {
      const days = window.prompt('Enter recurring interval in days (e.g., 30):', '30');
      if (!days) return; // Cancelled
      recurringIntervalDays = Number(days);
    }
    
    try {
      setError('');
      await api.post(`/quotations/${id}/convert`, {
        isRecurring: wantsLoop,
        recurringIntervalDays
      });
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to convert quotation to order');
    }
  };

  const handleSendWhatsapp = async (id) => {
    try {
      setError('');
      const res = await api.post(`/quotations/${id}/whatsapp`);
      alert(res.data.message || 'Quotation sent successfully via WhatsApp!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send WhatsApp message');
    }
  };

  const handleShareWhatsAppWeb = (quotation) => {
    if (!quotation.customer || !quotation.customer.mobile) {
      alert('Customer does not have a valid mobile number.');
      return;
    }
    let mobile = quotation.customer.mobile.replace(/\D/g, '');
    if (!mobile.startsWith('91') && mobile.length === 10) mobile = '91' + mobile;

    const validDate = new Date(quotation.validUntil).toLocaleDateString();
    let itemsText = quotation.items.map(i => `- ${i.quantity}x ${i.product?.name || 'Item'} (Rs. ${i.price.toFixed(2)})`).join('\n');
    let messageText = `*Quotation/Cost Estimate*\n\nHello ${quotation.customer.name},\n\nHere is your requested quotation for the following items:\n\n${itemsText}\n\n*Total Amount:* Rs. ${quotation.totalAmount.toFixed(2)}\n*Valid Until:* ${validDate}\n\nThank you for choosing us!`;
    
    const encodedMessage = encodeURIComponent(messageText);
    const url = `https://wa.me/${mobile}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  const handleConvertToInvoice = async (id) => {
    if (!window.confirm('Convert this Quotation into a Tax Invoice Bill? All pricing and line items will be copied automatically.')) return;
    try {
      setError('');
      const res = await api.post(`/quotations/${id}/convert-invoice`);
      alert(res.data.message || 'Quotation converted to Bill successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to convert quotation to invoice');
    }
  };

  const handlePrintPDF = (id) => {
    const url = `${api.defaults.baseURL}/quotations/${id}/pdf`;
    window.open(url, '_blank');
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
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Quotations & Cost Estimates</h2>
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Create Quotation
        </button>
      </div>

      {/* Quotations List */}
      {loading ? (
        <div>Loading quotations...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Quotation ID</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Valid Until</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Estimated Total</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length > 0 ? (
                quotations.map(q => (
                  <tr key={q._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontWeight: '700', color: '#1e293b' }}>
                      Q-{q._id.toString().substring(18).toUpperCase()}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155', fontWeight: '600' }}>{q.customer?.name}</td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>{new Date(q.validUntil).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>Rs. {q.totalAmount.toFixed(2)}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        background: q.status === 'Converted' ? '#d1fae5' : '#e2e8f0',
                        color: q.status === 'Converted' ? '#065f46' : '#475569'
                      }}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button 
                          onClick={() => handleShareWhatsAppWeb(q)}
                          title="Send manually via your own WhatsApp"
                          style={{ padding: '6px 12px', background: '#dcfce3', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                        >
                          💬 Click-to-Chat
                        </button>
                        <button 
                          onClick={() => handleSendWhatsapp(q._id)}
                          title="Send automated via Backend API"
                          style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                        >
                          🤖 Auto-Send
                        </button>
                      </div>
                      <button 
                        onClick={() => handlePrintPDF(q._id)}
                        style={{ padding: '6px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        🖨️ PDF
                      </button>
                      {q.status !== 'Converted' && (
                        <>
                          {q.status === 'Draft' && (
                            <button 
                              onClick={() => handleOpenEdit(q)}
                              style={{ padding: '6px 12px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <button 
                            onClick={() => handleConvertToOrder(q._id)}
                            style={{ padding: '6px 12px', background: '#ecfdf5', color: '#047857', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          >
                            📦 Order
                          </button>
                          <button 
                            onClick={() => handleConvertToInvoice(q._id)}
                            style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          >
                            🧾 Bill
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No quotations created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Quotation Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>{formMode === 'edit' ? 'Edit Quotation' : 'Create Cost Estimation Quotation'}</h3>
            
            <form onSubmit={handleSubmitQuotation} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Select Customer<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  onBlur={() => handleBlur('customerId')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.customerId && formErrors.customerId ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
                {touched.customerId && formErrors.customerId && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.customerId}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Quote Validity (Days)<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={validDays}
                  onChange={(e) => setValidDays(formatNumberInput(e.target.value, false))}
                  onBlur={() => handleBlur('validDays')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.validDays && formErrors.validDays ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.validDays && formErrors.validDays && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.validDays}</div>
                )}
              </div>

              {/* Items Section */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Products & Quantities</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {quotationItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select 
                        value={item.product}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        style={{ flex: 2, padding: '8px 12px', borderRadius: '6px', border: !item.product && touched.items ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                      >
                        <option value="">Select Product</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name} (Rs. {p.price.toFixed(2)})</option>
                        ))}
                      </select>

                      <input 
                        type="text"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, formatNumberInput(e.target.value, false))}
                        style={{ width: '80px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                        title="Quantity"
                      />

                      <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <span style={{ fontSize: '13px', color: '#475569', marginRight: '4px' }}>Rs.</span>
                        <input 
                          type="text"
                          inputMode="decimal"
                          value={item.price}
                          onChange={(e) => handleItemPriceChange(idx, formatNumberInput(e.target.value, true))}
                          style={{ width: '70px', padding: '8px 0', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px' }}
                          title="Price per unit"
                        />
                      </div>

                      <div style={{ width: '80px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>
                        <b>Rs. {(item.price * item.quantity).toFixed(2)}</b>
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {touched.items && formErrors.items && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.items}</div>
                )}
                <button 
                  type="button" 
                  onClick={handleAddItemRow}
                  style={{ marginTop: '10px', padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  ➕ Add Row
                </button>
              </div>

              {/* Estimate Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '15px', marginTop: '10px', fontWeight: 'bold', fontSize: '16px', color: '#1e293b' }}>
                <span>Estimated Grand Total:</span>
                <span style={{ color: '#166534' }}>Rs. {calculateTotal().toFixed(2)}</span>
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
                  {formMode === 'edit' ? 'Save Changes' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
