import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validatePurchaseForm, formatNumberInput } from '../utils/validation';

export default function Purchases() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [poItems, setPoItems] = useState([{ product: '', quantity: 1, costPrice: 0 }]);
  const [touched, setTouched] = useState({});

  const fetchData = async () => {
    try {
      const [poRes, supRes, prodRes, branchRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/branches')
      ]);
      setPurchaseOrders(poRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
      setBranches(branchRes.data);
      
      if (branchRes.data.length > 0) setBranchId(branchRes.data[0]._id);
      if (supRes.data.length > 0) setSelectedSupplierId(supRes.data[0]._id);
    } catch (err) {
      console.error(err);
      setError('Failed to load purchase orders registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formErrors = validatePurchaseForm(selectedSupplierId, expectedDate, branchId, poItems);
  const isFormValid = !Object.values(formErrors).some(Boolean);


  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleOpenAdd = () => {
    setSelectedSupplierId(suppliers[0]?._id || '');
    setExpectedDate('');
    setBranchId(branches[0]?._id || '');
    setPoItems([{ product: '', quantity: 1, costPrice: 0 }]);
    setShowAdd(true);
  };

  const handleItemProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p._id === prodId);
    const updated = [...poItems];
    updated[index].product = prodId;
    updated[index].costPrice = selectedProd ? Math.floor(selectedProd.price * 0.7) : 0; // default cost price to 70% of retail price
    setPoItems(updated);
  };

  const handleItemFieldChange = (index, field, value) => {
    const updated = [...poItems];
    updated[index][field] = Number(value);
    setPoItems(updated);
  };

  const handleAddItemRow = () => {
    setPoItems([...poItems, { product: '', quantity: 1, costPrice: 0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (poItems.length === 1) return;
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return poItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  };

  const handleSubmitPO = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      const payload = {
        supplierId: selectedSupplierId,
        expectedDeliveryDate: expectedDate,
        branchId,
        items: poItems.map(it => ({ product: it.product, quantity: it.quantity, costPrice: it.costPrice }))
      };
      await api.post('/purchases', payload);
      setSuccess('Purchase Order generated successfully! ✅');
      setShowAdd(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to dispatch purchase order');
    }
  };

  const handleSendWA = (po) => {
    const vendor = po.supplier;
    if (!vendor || !vendor.contact) {
      alert('This vendor does not have a contact number saved.');
      return;
    }
    
    let mobile = vendor.contact.replace(/\D/g, '');
    if (mobile.length === 10) mobile = `91${mobile}`;

    const msg = `Hello ${vendor.name},\n\nA friendly reminder about Purchase Order (Ref: PO-${po._id.toString().substring(18).toUpperCase()}) dispatched to you.\n\nTotal Items: ${po.items.length}\nExpected Delivery Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}\nStatus: ${po.status}\n\nPlease update us on the delivery schedule. Thank you!`;
    
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleAutoSendWA = async (poId) => {
    try {
      const res = await api.post(`/purchases/${poId}/whatsapp`);
      setSuccess(res.data.message || 'WhatsApp notification sent successfully!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send WhatsApp message');
    }
  };

  const handleMarkReceived = async (poId) => {
    if (!window.confirm('Mark this Purchase Order as RECEIVED? This will increment product inventory levels.')) return;
    setSuccess('');
    setError('');
    try {
      const res = await api.put(`/purchases/${poId}/receive`);
      setSuccess(res.data.message || 'PO items received! ✅');
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to mark PO as received');
    }
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading purchases catalog...</div>;

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Supplier Purchase Orders</h2>
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Dispatch Purchase Order
        </button>
      </div>

      {/* PO Listing */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>PO Ref ID</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Supplier Vendor</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Branch</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Delivery Expectancy</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Cost Value</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length > 0 ? (
              purchaseOrders.map(po => (
                <tr key={po._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 'bold', color: '#1e293b' }}>
                    PO-{po._id.toString().substring(18).toUpperCase()}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#334155', fontWeight: '600' }}>{po.supplier?.name}</td>
                  <td style={{ padding: '14px 20px', color: '#475569' }}>{po.branch?.name || 'N/A'}</td>
                  <td style={{ padding: '14px 20px', color: '#475569' }}>{new Date(po.expectedDeliveryDate).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 20px', color: '#b91c1c', fontWeight: 'bold' }}>Rs. {po.totalCost.toFixed(2)}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      fontWeight: 'bold',
                      background: po.status === 'Received' ? '#d1fae5' : '#eff6ff',
                      color: po.status === 'Received' ? '#065f46' : '#1d4ed8'
                    }}>
                      {po.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button 
                          onClick={() => handleSendWA(po)}
                          style={{ padding: '6px 12px', background: '#dcfce3', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          title="Send manually via your own WhatsApp"
                        >
                          💬 Click-to-Chat
                        </button>
                        <button 
                          onClick={() => handleAutoSendWA(po._id)}
                          style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                          title="Send automated via Backend API"
                        >
                          🤖 Auto-Send
                        </button>
                      </div>
                      {po.status === 'Ordered' && (
                        <button 
                          onClick={() => handleMarkReceived(po._id)}
                          style={{ padding: '6px 12px', background: '#ecfdf5', color: '#047857', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                        >
                          📦 Mark Received
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No purchase orders dispatched yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Purchase Order Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Create Supplier Purchase Order</h3>
            
            <form onSubmit={handleSubmitPO} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Select Supplier Vendor<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  onBlur={() => handleBlur('supplierId')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.supplierId && formErrors.supplierId ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="">Choose Supplier</option>
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name} (GST: {s.gstNumber || 'None'})</option>
                  ))}
                </select>
                {touched.supplierId && formErrors.supplierId && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.supplierId}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Expected Delivery Date<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    onBlur={() => handleBlur('expectedDate')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.expectedDate && formErrors.expectedDate ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.expectedDate && formErrors.expectedDate && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.expectedDate}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Receiving Branch<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    onBlur={() => handleBlur('branchId')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.branchId && formErrors.branchId ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                  >
                    {branches.map(br => (
                      <option key={br._id} value={br._id}>{br.name}</option>
                    ))}
                  </select>
                  {touched.branchId && formErrors.branchId && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.branchId}</div>
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Purchase Order Items</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {poItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select 
                        value={item.product}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        style={{ flex: 2, padding: '8px 12px', borderRadius: '6px', border: !item.product && touched.items ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                      >
                        <option value="">Select Product</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>

                      <input 
                        type="text"
                        inputMode="numeric"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemFieldChange(idx, 'quantity', formatNumberInput(e.target.value, false))}
                        style={{ width: '85px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                      />

                      <input 
                        type="text"
                        inputMode="decimal"
                        placeholder="Cost"
                        value={item.costPrice}
                        onChange={(e) => handleItemFieldChange(idx, 'costPrice', formatNumberInput(e.target.value, true))}
                        style={{ width: '90px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                      />

                      <div style={{ width: '80px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>
                        Rs. {(item.costPrice * item.quantity).toFixed(2)}
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

              {/* Total Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '15px', marginTop: '10px', fontWeight: 'bold', fontSize: '16px', color: '#1e293b' }}>
                <span>Estimated Cost Total:</span>
                <span style={{ color: '#b91c1c' }}>Rs. {calculateTotal().toFixed(2)}</span>
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
                  Dispatch PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
