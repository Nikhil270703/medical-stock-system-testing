import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateOrderForm, formatNumberInput } from '../utils/validation';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Order Details / Tracking View State
  const [trackingOrder, setTrackingOrder] = useState(null);

  // Form State
  const [formMode, setFormMode] = useState(null); // 'add' | null
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderItems, setOrderItems] = useState([{ product: '', quantity: 1, price: 0 }]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(30);
  const [touched, setTouched] = useState({});

  const fetchData = async () => {
    try {
      const [ordRes, custRes, prodRes, staffRes] = await Promise.all([
        api.get(`/orders${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/customers'),
        api.get('/products'),
        api.get('/employees') // Load from employees list for formal assignment mapping
      ]);
      setOrders(ordRes.data);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
      setStaffList(staffRes.data.filter(emp => emp.role === 'Delivery Staff'));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch orders or master directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const formErrors = validateOrderForm(selectedCustomerId, deliveryDate, isRecurring, recurringIntervalDays, orderItems);
  const isFormValid = !Object.values(formErrors).some(Boolean);


  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Leaflet initialization hook for trackingOrder modal location map
  useEffect(() => {
    if (trackingOrder && trackingOrder.latitude && trackingOrder.longitude) {
      // Dynamic load Leaflet CSS and JS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        try {
          const L = window.L;
          const container = document.getElementById('map-container');
          if (container) {
            container.innerHTML = "<div id='map-element' style='height: 180px; border-radius: 8px; z-index: 1;'></div>";
            const map = L.map('map-element').setView([trackingOrder.latitude, trackingOrder.longitude], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            L.marker([trackingOrder.latitude, trackingOrder.longitude]).addTo(map)
              .bindPopup(`Delivery Coordinates: ${trackingOrder.latitude.toFixed(4)}, ${trackingOrder.longitude.toFixed(4)}`)
              .openPopup();
          }
        } catch (err) {
          console.error('Leaflet map rendering failed:', err);
        }
      };
      document.body.appendChild(script);

      return () => {
        document.head.removeChild(link);
        document.body.removeChild(script);
      };
    }
  }, [trackingOrder]);

  const handleOpenAdd = () => {
    setSelectedCustomerId('');
    setDeliveryDate('');
    setOrderItems([{ product: '', quantity: 1, price: 0 }]);
    setIsRecurring(false);
    setRecurringIntervalDays(30);
    setFormMode('add');
  };

  const handleItemProductChange = (index, prodId) => {
    const selectedProd = products.find(p => p._id === prodId);
    const updated = [...orderItems];
    updated[index].product = prodId;
    updated[index].price = selectedProd ? selectedProd.price : 0;
    setOrderItems(updated);
  };

  const handleItemQtyChange = (index, qty) => {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, Number(qty));
    setOrderItems(updated);
  };

  const handleAddItemRow = () => {
    setOrderItems([...orderItems, { product: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    try {
      setError('');
      
      const payload = {
        customer: selectedCustomerId,
        deliveryDate,
        items: orderItems.map(it => ({ product: it.product, quantity: it.quantity })),
        isRecurring,
        recurringIntervalDays
      };

      await api.post('/orders', payload);
      setFormMode(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit order');
    }
  };

  const handleAssignStaff = async (orderId, employeeId) => {
    try {
      setError('');
      const emp = staffList.find(st => st._id === employeeId);
      if (!emp || !emp.user) {
        setError('Selected employee is not linked to any active portal user logins');
        return;
      }
      await api.put(`/orders/${orderId}/assign`, { staffId: emp.user._id });
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to assign staff');
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setError('');
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      fetchData(); // refresh the list
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update order status');
    }
  };

  const handleProcessLoopNow = async (orderId) => {
    if (!window.confirm('Are you sure you want to generate the next order loop now?')) return;
    try {
      setError('');
      await api.post(`/orders/${orderId}/process-loop-now`);
      fetchData(); // refresh the list
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to process recurring order manually');
    }
  };

  const upcomingLoops = orders.filter(o => {
    if (!o.isRecurring || o.recurringProcessed || o.status !== 'Delivered' || !o.deliveredAt) return false;
    const nextRun = new Date(new Date(o.deliveredAt).getTime() + (o.recurringIntervalDays || 30) * 24 * 60 * 60 * 1000);
    const diffDays = (nextRun - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays <= 1;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Status Filter:</label>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
          >
            <option value="">All Orders</option>
            <option value="Pending">Pending</option>
            <option value="Assigned">Assigned</option>
            <option value="Packed">Packed</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        
        <button 
          onClick={handleOpenAdd}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Create Order
        </button>
      </div>

      {/* Upcoming Recurring Loops Section */}
      {!loading && upcomingLoops.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ padding: '12px 20px', background: '#fef3c7', borderBottom: '1px solid #fde68a', fontWeight: 'bold', color: '#b45309', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⏳ Upcoming Recurring Orders (Action Required)</span>
            <span style={{ fontSize: '12px', padding: '2px 8px', background: '#b45309', color: '#fff', borderRadius: '10px' }}>{upcomingLoops.length} Due Soon</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #fde68a' }}>
                <th style={{ padding: '12px 20px', fontSize: '12px', color: '#b45309' }}>Source Order Ref</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', color: '#b45309' }}>Customer</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', color: '#b45309' }}>Renewal Date</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', color: '#b45309' }}>Est. Total</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', color: '#b45309', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {upcomingLoops.map(o => {
                const nextRun = new Date(new Date(o.deliveredAt).getTime() + (o.recurringIntervalDays || 30) * 24 * 60 * 60 * 1000);
                return (
                  <tr key={o._id} style={{ borderBottom: '1px solid #fef3c7' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 'bold', color: '#92400e' }}>ORD-{o._id.toString().substring(18).toUpperCase()}</td>
                    <td style={{ padding: '12px 20px', color: '#92400e' }}>{o.customer?.name}</td>
                    <td style={{ padding: '12px 20px', color: '#92400e' }}>{nextRun.toLocaleDateString()}</td>
                    <td style={{ padding: '12px 20px', color: '#92400e', fontWeight: 'bold' }}>Rs. {o.totalAmount.toFixed(2)}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleProcessLoopNow(o._id)}
                        style={{ padding: '6px 12px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        ⚡ Create New Order Now
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Orders Directory List */}
      {loading ? (
        <div>Loading orders runs...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Order Ref</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Schedule Date</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Grand Total</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Delivery Driver</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map(o => (
                  <tr 
                    key={o._id} 
                    onClick={() => setTrackingOrder(o)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', color: '#1e293b' }}>
                      <div style={{ fontWeight: '700' }}>ORD-{o._id.toString().substring(18).toUpperCase()}</div>
                      {o.isRecurring && (
                        <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 'bold', marginTop: '2px' }}>
                          🔁 Every 30 Days
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155', fontWeight: '600' }}>{o.customer?.name}</td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>{new Date(o.deliveryDate).toLocaleDateString()}</td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>Rs. {o.totalAmount.toFixed(2)}</td>
                    <td style={{ padding: '14px 20px' }}>
                      {o.assignedStaff ? (
                        <span style={{ color: '#334155' }}>{o.assignedStaff.name}</span>
                      ) : (
                        <select 
                          onChange={(e) => handleAssignStaff(o._id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px dashed #ef4444', color: '#ef4444', outline: 'none', background: '#fffbeb', fontSize: '12px' }}
                          defaultValue=""
                        >
                          <option value="" disabled>Unassigned ⚠️</option>
                          {staffList.map(st => (
                            <option key={st._id} value={st._id}>{st.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <select 
                        value={o.status}
                        onChange={(e) => handleUpdateStatus(o._id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          fontSize: '11px', 
                          padding: '4px 24px 4px 8px', 
                          borderRadius: '6px', 
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          outline: 'none',
                          border: '1px solid rgba(0,0,0,0.1)',
                          appearance: 'none',
                          background: o.status === 'Delivered' ? '#d1fae5 url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%23065f46\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M4 6l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 8px center' 
                                      : o.status === 'Cancelled' ? '#fee2e2 url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%23b91c1c\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M4 6l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 8px center' 
                                      : '#fef3c7 url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%23b45309\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M4 6l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 8px center',
                          color: o.status === 'Delivered' ? '#065f46' : o.status === 'Cancelled' ? '#b91c1c' : '#b45309'
                        }}
                      >
                        <option value="Pending">New Order</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Packed">Package</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={() => setTrackingOrder(o)}
                        style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        🚚 Track Run
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Order Modal */}
      {formMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Create New Dispatch Order</h3>
            
            <form onSubmit={handleSubmitOrder} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Select Customer<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCustomerId(cid);
                    const cust = customers.find(c => c._id === cid);
                    if (cust && cust.defaultRecurringDays && cust.defaultRecurringDays > 0) {
                      setIsRecurring(true);
                      setRecurringIntervalDays(cust.defaultRecurringDays);
                    } else {
                      setIsRecurring(false);
                      setRecurringIntervalDays(30);
                    }
                  }}
                  onBlur={() => handleBlur('customerId')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.customerId && formErrors.customerId ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Select customer Profile --</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.mobile})</option>
                  ))}
                </select>
                {touched.customerId && formErrors.customerId && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.customerId}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Scheduled Delivery Date<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  onBlur={() => handleBlur('deliveryDate')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.deliveryDate && formErrors.deliveryDate ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.deliveryDate && formErrors.deliveryDate && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.deliveryDate}</div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isRecurring} 
                    onChange={(e) => setIsRecurring(e.target.checked)} 
                  />
                  Enable Order Loop (Recurring Delivery)
                </label>
                {isRecurring && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#475569' }}>Repeat every:</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        value={recurringIntervalDays}
                        onChange={(e) => setRecurringIntervalDays(formatNumberInput(e.target.value, false))}
                        onBlur={() => handleBlur('recurringIntervalDays')}
                        style={{ width: '70px', padding: '6px 10px', borderRadius: '6px', border: touched.recurringIntervalDays && formErrors.recurringIntervalDays ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                      />
                      <span style={{ fontSize: '12px', color: '#475569' }}>days</span>
                    </div>
                    {touched.recurringIntervalDays && formErrors.recurringIntervalDays && (
                      <div style={{ color: '#ef4444', fontSize: '11px' }}>{formErrors.recurringIntervalDays}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Order Line Items</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orderItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select 
                        value={item.product}
                        onChange={(e) => handleItemProductChange(idx, e.target.value)}
                        style={{ flex: 2, padding: '8px 12px', borderRadius: '6px', border: !item.product && touched.items ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                      >
                        <option value="">Choose Product</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>{p.name} (Stock: {p.currentStock} | Price: Rs. {p.price.toFixed(2)})</option>
                        ))}
                      </select>

                      <input 
                        type="text"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, formatNumberInput(e.target.value, false))}
                        style={{ width: '80px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                      />

                      <div style={{ width: '80px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>
                        Rs. {(item.price * item.quantity).toFixed(2)}
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
                <span>Order Total:</span>
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
                  Confirm Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tracking Audit Modal */}
      {trackingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                Track Run &raquo; ORD-{trackingOrder._id.toString().substring(18).toUpperCase()}
              </h3>
              <button 
                onClick={() => setTrackingOrder(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>Customer: {trackingOrder.customer?.name}</strong>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Address: {trackingOrder.customer?.address}</p>
                <p style={{ fontSize: '12px', color: '#64748b' }}>Assigned Driver: {trackingOrder.assignedTo?.name || 'Unassigned'}</p>
              </div>

              {/* GPS Coordinates & Leaflet Map Container */}
              {trackingOrder.latitude && trackingOrder.longitude ? (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Delivery GPS Geolocation</h4>
                  <div style={{ width: '100%', height: '200px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                    <iframe 
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      scrolling="no" 
                      marginHeight="0" 
                      marginWidth="0" 
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(trackingOrder.longitude)-0.005},${Number(trackingOrder.latitude)-0.005},${Number(trackingOrder.longitude)+0.005},${Number(trackingOrder.latitude)+0.005}&layer=mapnik&marker=${Number(trackingOrder.latitude)},${Number(trackingOrder.longitude)}`}
                    ></iframe>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  ℹ️ No GPS coordinates logged at moment of delivery.
                </div>
              )}

              {/* Status Line */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '15px' }}>Order Status Line</h4>
                
                {trackingOrder.status === 'Cancelled' ? (
                  <div style={{ padding: '15px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                    🚫 This order was cancelled.
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 10px', margin: '20px 0' }}>
                    {/* Background Line */}
                    <div style={{ position: 'absolute', top: '15px', left: '30px', right: '30px', height: '3px', background: '#e2e8f0', zIndex: 1 }}></div>
                    
                    {['Pending', 'Assigned', 'Packed', 'Out for Delivery', 'Delivered'].map((step, idx) => {
                      const isCompleted = trackingOrder.statusHistory?.some(h => h.status === step) || 
                                          ['Pending', 'Assigned', 'Packed', 'Out for Delivery', 'Delivered'].indexOf(trackingOrder.status) >= idx;
                      const isCurrent = trackingOrder.status === step;
                      
                      return (
                        <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, gap: '8px', flex: 1 }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: isCompleted ? '#3b82f6' : '#fff', 
                            border: isCompleted ? '2px solid #3b82f6' : '2px solid #cbd5e1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isCompleted ? '#fff' : '#94a3b8', fontWeight: 'bold', fontSize: '14px'
                          }}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: isCurrent ? '#0f172a' : (isCompleted ? '#3b82f6' : '#64748b'), textAlign: 'center' }}>
                            {step === 'Pending' ? 'New Order' : step === 'Packed' ? 'Package' : step}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Delivery Photo Proof */}
              {trackingOrder.deliveryProofUrl && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>Delivery Photo Proof</h4>
                  <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                    <img 
                      src={trackingOrder.deliveryProofUrl} 
                      alt="Delivery Photo Proof" 
                      style={{ maxHeight: '150px', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              {/* Proof signature */}
              {trackingOrder.signatureUrl && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>Customer Digital Signature Proof</h4>
                  <div style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                    <img 
                      src={trackingOrder.signatureUrl} 
                      alt="Signature" 
                      style={{ maxHeight: '80px', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}

              {/* Customer Feedback */}
              {trackingOrder.feedbackRating && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>Customer Feedback</h4>
                  <div style={{ padding: '15px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fefce8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '20px', marginBottom: '8px' }}>
                      {'★'.repeat(Math.max(0, Math.min(5, trackingOrder.feedbackRating || 0)))}
                      {'☆'.repeat(Math.max(0, 5 - Math.min(5, trackingOrder.feedbackRating || 0)))}
                    </div>
                    {trackingOrder.feedbackComment && <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>"{trackingOrder.feedbackComment}"</p>}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
