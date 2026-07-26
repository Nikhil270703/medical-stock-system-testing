import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validatePaymentForm, formatNumberInput, sanitizeText } from '../utils/validation';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [customers, setCustomers] = useState([]);
  const [payModal, setPayModal] = useState(false);
  const [payData, setPayData] = useState({ customerId: '', amountPaid: '', paymentMode: 'UPI', referenceNumber: '', notes: '', autoAllocate: true });
  const [touched, setTouched] = useState({});

  const fetchPayments = async () => {
    try {
      const res = await api.get('/payments');
      setPayments(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch payment collections');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
  }, []);

  const formErrors = validatePaymentForm(payData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const errors = validatePaymentForm(payData);
    if (Object.values(errors).some(Boolean)) {

      setTouched({ customerId: true, amountPaid: true });
      return;
    }
    try {
      setError('');
      const payload = {
        customerId: payData.customerId,
        amountPaid: Number(payData.amountPaid),
        paymentMode: payData.paymentMode,
        referenceNumber: sanitizeText(payData.referenceNumber),
        notes: sanitizeText(payData.notes),
        autoAllocate: payData.autoAllocate
      };

      await api.post('/payments', payload);
      setPayModal(false);
      setTouched({});
      fetchPayments();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to log general payment');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Payment Collection Register</h2>
        <button 
          onClick={() => { setPayData({ customerId: '', amountPaid: '', paymentMode: 'UPI', referenceNumber: '', notes: '', autoAllocate: true }); setPayModal(true); }}
          style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
        >
          ➕ Log General Payment (Auto-Allocate)
        </button>
      </div>

      {/* Payments table */}
      {loading ? (
        <div>Loading payment records...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Collection Date</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Invoice Bill Ref</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Amount Collected</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Payment Mode</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Reference / Auth ID</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.length > 0 ? (
                payments.map(p => (
                  <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>
                      {new Date(p.date).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: '#1e293b' }}>
                      {p.customer?.name}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#1e40af', fontWeight: '700' }}>
                      {p.bill?.invoiceNumber || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>
                      Rs. {p.amountPaid.toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        background: '#f1f5f9',
                        color: '#475569',
                        textTransform: 'uppercase'
                      }}>
                        {p.paymentMode}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>
                      {p.referenceNumber || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px' }}>
                      {p.notes || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No payments collected yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Record General Payment Modal */}
      {payModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Log General Payment</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Record a payment against a customer. The amount will be automatically allocated to their oldest unpaid invoices (FIFO) if auto-allocate is checked.</p>
            
            <form onSubmit={handleSavePayment} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Customer<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={payData.customerId}
                  onChange={(e) => setPayData({ ...payData, customerId: e.target.value })}
                  onBlur={() => handleBlur('customerId')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.customerId && formErrors.customerId ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="">Select Customer...</option>
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
                  Amount Paid (Rs.)<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={payData.amountPaid}
                  onChange={(e) => setPayData({ ...payData, amountPaid: formatNumberInput(e.target.value, true) })}
                  onBlur={() => handleBlur('amountPaid')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.amountPaid && formErrors.amountPaid ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                />
                {touched.amountPaid && formErrors.amountPaid && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.amountPaid}</div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Payment Mode*</label>
                <select 
                  value={payData.paymentMode}
                  onChange={(e) => setPayData({ ...payData, paymentMode: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="cash">Cash Payment</option>
                  <option value="bank transfer">Bank IMPS / NEFT Transfer</option>
                  <option value="cheque">Bank Cheque</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Transaction Ref Number</label>
                <input 
                  type="text"
                  placeholder="e.g. Bank/UPI Transaction ID"
                  value={payData.referenceNumber}
                  onChange={(e) => setPayData({ ...payData, referenceNumber: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                  <input 
                    type="checkbox" 
                    checked={payData.autoAllocate} 
                    onChange={e => setPayData({ ...payData, autoAllocate: e.target.checked })} 
                  />
                  Auto-allocate to oldest unpaid invoices (FIFO)
                </label>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Notes</label>
                <input 
                  type="text"
                  value={payData.notes}
                  onChange={(e) => setPayData({ ...payData, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setPayModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!isFormValid}
                  style={{ flex: 1, padding: '10px', background: isFormValid ? '#10b981' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: isFormValid ? 'pointer' : 'not-allowed' }}
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
