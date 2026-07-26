import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { validateProductForm, formatNumberInput, sanitizeText } from '../utils/validation';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [reorderList, setReorderList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('all'); // all | reorder

  // Form State for CRUD
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', unit: '', price: '', currentStock: '', lowStockThreshold: '', linkedVendor: '', hsnCode: 'HSN3004', branchId: '' });
  const [touched, setTouched] = useState({});

  // Stock Adjustment Modal state
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ newQty: '', reason: 'recount' });
  const [adjustTouched, setAdjustTouched] = useState({});
  const [selectedProductLogs, setSelectedProductLogs] = useState([]);
  const [showLogsModal, setShowLogsModal] = useState(null);

  // Quick Order Modal state
  const [orderingProduct, setOrderingProduct] = useState(null);
  const [orderForm, setOrderForm] = useState({ quantity: '', expectedDeliveryDate: '' });
  const [orderTouched, setOrderTouched] = useState({});

  const fetchData = async () => {
    try {
      const [prodRes, venRes, branchRes, reorderRes] = await Promise.all([
        api.get('/products'),
        api.get('/vendors'),
        api.get('/branches'),
        api.get('/products/reorder-list')
      ]);
      setProducts(prodRes.data);
      setVendors(venRes.data);
      setBranches(branchRes.data);
      setReorderList(reorderRes.data);
      if (branchRes.data.length > 0) {
        setFormData(prev => ({ ...prev, branchId: branchRes.data[0]._id }));
      }
      if (venRes.data.length > 0) {
        setFormData(prev => ({ ...prev, linkedVendor: venRes.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch product information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addErrors = validateProductForm(formData);
  const isAddValid = !Object.values(addErrors).some(Boolean);


  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    const errors = validateProductForm(formData);
    if (Object.values(errors).some(Boolean)) {
      setTouched({ name: true, category: true, hsnCode: true, unit: true, price: true, currentStock: true, lowStockThreshold: true, linkedVendor: true, branchId: true });
      return;
    }
    const payload = {
      ...formData,
      name: sanitizeText(formData.name),
      category: sanitizeText(formData.category),
      hsnCode: sanitizeText(formData.hsnCode),
      unit: sanitizeText(formData.unit)
    };
    try {
      await api.post('/products', payload);
      setSuccess('Product registered successfully! ✅');
      setShowAdd(false);
      setTouched({});
      setFormData({ name: '', category: '', unit: '', price: '', currentStock: '', lowStockThreshold: '', linkedVendor: vendors[0]?._id || '', hsnCode: 'HSN3004', branchId: branches[0]?._id || '' });
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create product');
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.put(`/products/${adjustingProduct._id}/adjust-manual`, adjustForm);
      setSuccess(`Product stock updated successfully! ✅`);
      setAdjustingProduct(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.post('/purchases', {
        supplierId: orderingProduct.linkedVendor,
        items: [{
          product: orderingProduct._id,
          quantity: Number(orderForm.quantity),
          costPrice: orderingProduct.price || 0
        }],
        expectedDeliveryDate: orderForm.expectedDeliveryDate,
        branchId: orderingProduct.branch || branches[0]?._id
      });
      setSuccess('Purchase Order created successfully! ✅');
      setOrderingProduct(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create purchase order');
    }
  };

  const handleViewLogs = async (product) => {
    try {
      const res = await api.get(`/products/${product._id}/stock-logs`);
      setSelectedProductLogs(res.data);
      setShowLogsModal(product);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch stock log logs');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setSuccess('');
    setError('');
    try {
      await api.delete(`/products/${id}`);
      setSuccess('Product deleted successfully. ✅');
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to delete product');
    }
  };

  const activeProducts = activeTab === 'all' ? products : reorderList;

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading products directory...</div>;

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

      {/* Header Tabs and Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '12px', padding: '6px', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              background: activeTab === 'all' ? '#fff' : 'transparent', 
              fontWeight: '600', 
              color: activeTab === 'all' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            All Products <span style={{ background: activeTab === 'all' ? '#e2e8f0' : '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '6px' }}>{products.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('reorder')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              background: activeTab === 'reorder' ? '#fff' : 'transparent', 
              fontWeight: '600', 
              color: activeTab === 'reorder' ? '#dc2626' : '#64748b',
              boxShadow: activeTab === 'reorder' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Reorder List <span style={{ background: activeTab === 'reorder' ? '#fee2e2' : '#f1f5f9', color: activeTab === 'reorder' ? '#b91c1c' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{reorderList.length}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setShowAdd(true)}
            style={{ padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
          >
            ➕ Register Product
          </button>
        </div>
      </div>

      {/* Products Directory Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {activeProducts.map(prod => (
          <div key={prod._id} style={{ 
            background: '#fff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '16px', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            position: 'relative',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
          }}>
            
            {/* Low stock tag */}
            {prod.currentStock <= prod.lowStockThreshold && (
              <span style={{ position: 'absolute', top: '16px', right: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '11px', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444'}}></span> LOW STOCK
              </span>
            )}

            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>{prod.name}</h4>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>{prod.category}</span>
                <span>HSN: {prod.hsnCode || 'N/A'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Stock Status</span>
                <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: prod.currentStock <= prod.lowStockThreshold ? '#dc2626' : '#0f172a' }}>
                  {prod.currentStock} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>{prod.unit}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Retail Price</span>
                <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: '#059669' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>Rs.</span> {prod.price.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    setOrderingProduct(prod);
                    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
                    setOrderForm({ quantity: Math.max(10, prod.lowStockThreshold), expectedDeliveryDate: tmrw.toISOString().split('T')[0] });
                  }}
                  style={{ padding: '8px 12px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#dcfce7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f0fdf4'}
                  title="Quick Order"
                >
                  Order
                </button>
                <button 
                  onClick={() => {
                    setAdjustingProduct(prod);
                    setAdjustForm({ newQty: prod.currentStock, reason: 'recount' });
                  }}
                  style={{ padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  title="Adjust Stock"
                >
                  Adjust
                </button>
                <button 
                  onClick={() => handleViewLogs(prod)}
                  style={{ padding: '8px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#eff6ff'}
                  title="View Logs"
                >
                  Logs
                </button>
                <button 
                  onClick={() => handleDeleteProduct(prod._id)}
                  style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                  title="Delete Product"
                >
                  Delete
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Product CRUD Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Register Product</h3>
            
            <form onSubmit={handleAddSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Product Name<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onBlur={() => handleBlur('name')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.name && addErrors.name ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                />
                {touched.name && addErrors.name && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.name}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Category<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    onBlur={() => handleBlur('category')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.category && addErrors.category ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.category && addErrors.category && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.category}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    HSN Code<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    onBlur={() => handleBlur('hsnCode')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.hsnCode && addErrors.hsnCode ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.hsnCode && addErrors.hsnCode && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.hsnCode}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Unit (e.g. strips)<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    onBlur={() => handleBlur('unit')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.unit && addErrors.unit ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.unit && addErrors.unit && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.unit}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Retail Price (Rs.)<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: formatNumberInput(e.target.value, true) })}
                    onBlur={() => handleBlur('price')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.price && addErrors.price ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.price && addErrors.price && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.price}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Initial Stock<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: formatNumberInput(e.target.value, false) })}
                    onBlur={() => handleBlur('currentStock')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.currentStock && addErrors.currentStock ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.currentStock && addErrors.currentStock && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.currentStock}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Reorder Level<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: formatNumberInput(e.target.value, false) })}
                    onBlur={() => handleBlur('lowStockThreshold')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.lowStockThreshold && addErrors.lowStockThreshold ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                  />
                  {touched.lowStockThreshold && addErrors.lowStockThreshold && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{addErrors.lowStockThreshold}</div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Supplier Vendor<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={formData.linkedVendor} 
                  onChange={(e) => setFormData({ ...formData, linkedVendor: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {vendors.map(v => (
                    <option key={v._id} value={v._id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Branch Scoped<span style={{ color: '#ef4444' }}>*</span>
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
                  disabled={!isAddValid}
                  style={{ flex: 1, padding: '10px', background: isAddValid ? '#3b82f6' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isAddValid ? 'pointer' : 'not-allowed' }}
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Adjust Stock</h3>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '15px' }}>Product: {adjustingProduct.name}</span>
            
            <form onSubmit={handleAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>New Quantity Level*</label>
                <input 
                  type="number"
                  value={adjustForm.newQty}
                  onChange={(e) => setAdjustForm({ ...adjustForm, newQty: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Adjustment Reason*</label>
                <select 
                  value={adjustForm.reason} 
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="recount">Recount Audit Correction</option>
                  <option value="damage">Damaged Inventory</option>
                  <option value="loss">Loss / Theft</option>
                  <option value="return">Returned Stock</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setAdjustingProduct(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Logs Modal */}
      {showLogsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>Stock Movements Log</h3>
              <button onClick={() => setShowLogsModal(null)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <span style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '15px', fontWeight: '600' }}>Product: {showLogsModal.name}</span>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Timestamp</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Movement</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Source / Reason</th>
                </tr>
              </thead>
              <tbody>
                {selectedProductLogs.length > 0 ? (
                  selectedProductLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 'bold', color: log.type === 'in' ? '#166534' : '#b91c1c' }}>
                        {log.type === 'in' ? '➕ Stock In' : '➖ Stock Out'} ({log.quantity} units)
                      </td>
                      <td style={{ padding: '8px 10px', textTransform: 'capitalize', color: '#475569' }}>{log.reason}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ padding: '20px', textLight: 'center', color: '#94a3b8' }}>No stock movement logs recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Purchase Order Modal */}
      {orderingProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '5px' }}>Quick Purchase Order</h3>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{orderingProduct.name}</div>
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Vendor:</strong> {vendors.find(v => v._id === (orderingProduct.linkedVendor?._id || orderingProduct.linkedVendor))?.name || 'Unknown'}</span>
                <span><strong>Price:</strong> Rs. {orderingProduct.price.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Current Stock:</strong> {orderingProduct.currentStock} {orderingProduct.unit}</span>
                <span style={{ color: '#dc2626' }}><strong>Min Alert:</strong> {orderingProduct.lowStockThreshold} {orderingProduct.unit}</span>
              </div>
            </div>
            
            <form onSubmit={handleOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Quantity to Order*</label>
                  <input 
                    type="number"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    required
                    min="1"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Total Est. Value</label>
                  <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#0f172a' }}>
                    Rs. {(orderingProduct.price * (Number(orderForm.quantity) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Expected Delivery Date*</label>
                <input 
                  type="date"
                  value={orderForm.expectedDeliveryDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedDeliveryDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setOrderingProduct(null)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Dispatch Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
