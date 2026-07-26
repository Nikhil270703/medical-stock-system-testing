import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateBillPaymentForm, formatNumberInput, sanitizeText } from '../utils/validation';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment Record Modal State
  const [payModal, setPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payData, setPayData] = useState({ amountPaid: '', paymentMode: 'UPI', referenceNumber: '', notes: '' });
  const [touched, setTouched] = useState({});

  // WhatsApp Reminder Modal State
  const [reminderModal, setReminderModal] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState(null);
  const [reminderLanguage, setReminderLanguage] = useState('english');
  const [outstandingDues, setOutstandingDues] = useState(0);

  const fetchBills = async () => {
    try {
      const res = await api.get('/bills');
      setBills(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const formErrors = validateBillPaymentForm(payData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleOpenPaymentModal = (bill) => {
    // calculate remaining unpaid balance
    setSelectedBill(bill);
    setPayData({
      amountPaid: bill.totalAmount.toString(),
      paymentMode: 'UPI',
      referenceNumber: '',
      notes: ''
    });
    setTouched({});
    setPayModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const errors = validateBillPaymentForm(payData);
    if (Object.values(errors).some(Boolean)) {

      setTouched({ amountPaid: true });
      return;
    }
    try {
      setError('');
      const payload = {
        billId: selectedBill._id,
        amountPaid: Number(payData.amountPaid),
        paymentMode: payData.paymentMode,
        referenceNumber: sanitizeText(payData.referenceNumber),
        notes: sanitizeText(payData.notes)
      };

      await api.post('/payments', payload);
      setPayModal(false);
      setTouched({});
      fetchBills();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to log payment transaction');
    }
  };

  const handleOpenReminderModal = async (bill) => {
    setReminderCustomer(bill.customer);
    // Find outstanding dues dynamically for this customer
    try {
      setLoading(true);
      const res = await api.get(`/customers/${bill.customer._id}`);
      setOutstandingDues(res.data.outstanding);
      setReminderModal(true);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch outstanding dues for customer reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async () => {
    try {
      setError('');
      const res = await api.post('/payments/reminder', {
        customerId: reminderCustomer._id,
        language: reminderLanguage,
        outstandingAmount: outstandingDues.toFixed(2)
      });
      alert(`Reminder dispatched!\n\nMessage Content:\n"${res.data.text}"`);
      setReminderModal(false);
    } catch (err) {
      console.error(err);
      setError('Failed to dispatch payment reminder alert');
    }
  };

  const handlePrintPDF = (id) => {
    const url = `${api.defaults.baseURL}/bills/${id}/pdf`;
    window.open(url, '_blank');
  };

  const handleShareWhatsAppWeb = (bill) => {
    const text = `Dear ${bill.customer.name},\nHere is your invoice ${bill.invoiceNumber} for Rs. ${bill.totalAmount.toFixed(2)}.\nDownload Tax Invoice PDF: ${api.defaults.baseURL}/bills/${bill._id}/pdf`;
    const formattedMobile = bill.customer.mobile.replace(/\D/g, '');
    const url = `https://wa.me/${formattedMobile.startsWith('91') ? '' : '91'}${formattedMobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleGeneratePaymentLink = async (bill) => {
    try {
      const res = await api.post('/payments/create-link', { billId: bill._id });
      if (res.data.isSandbox) {
        alert(`SANDBOX PAYMENT LINK GENERATED\n\nMock Order ID: ${res.data.orderId}\n\n(In production, this would open the Razorpay checkout)`);
      } else {
        alert(`Payment link generated with Order ID: ${res.data.orderId}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate payment link: ' + (err.response?.data?.message || err.message));
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
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>Invoices & Billing</h2>
      </div>

      {/* Bills Directory List */}
      {loading ? (
        <div>Loading bills...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Invoice ID</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Customer</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Created Date</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>GST CGST/SGST</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Grand Total</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.length > 0 ? (
                bills.map(b => {
                  const cGst = b.cgstTotal || 0;
                  const sGst = b.sgstTotal || 0;
                  const iGst = b.igstTotal || 0;
                  return (
                    <tr key={b._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px', fontWeight: '700', color: '#1e293b' }}>
                        {b.invoiceNumber}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#334155', fontWeight: '600' }}>{b.customer?.name}</td>
                      <td style={{ padding: '14px 20px', color: '#475569' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '14px 20px', color: '#475569' }}>
                        {iGst > 0 ? `IGST: Rs. ${iGst.toFixed(2)}` : `CGST/SGST: Rs. ${(cGst + sGst).toFixed(2)}`}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#166534', fontWeight: 'bold' }}>Rs. {b.totalAmount.toFixed(2)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          fontWeight: 'bold',
                          background: b.status === 'Paid' ? '#d1fae5' : '#fee2e2',
                          color: b.status === 'Paid' ? '#065f46' : '#b91c1c'
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handlePrintPDF(b._id)}
                          style={{ padding: '6px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                        >
                          🖨️ PDF/Print
                        </button>
                        <button 
                          onClick={() => handleShareWhatsAppWeb(b)}
                          style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                        >
                          💬 Share
                        </button>
                        
                        {b.status !== 'Paid' && (
                          <>
                            <button 
                              onClick={() => handleOpenPaymentModal(b)}
                              style={{ padding: '6px 12px', background: '#ecfdf5', color: '#047857', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            >
                              💵 Log Payment
                            </button>
                            <button 
                              onClick={() => handleGeneratePaymentLink(b)}
                              style={{ padding: '6px 12px', background: '#eef2ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            >
                              🔗 Pay Link
                            </button>
                            <button 
                              onClick={() => handleOpenReminderModal(b)}
                              style={{ padding: '6px 12px', background: '#fffbeb', color: '#d97706', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                            >
                              💬 WhatsApp
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textLight: 'center', color: '#64748b' }}>No invoices logged. Complete delivery runs to auto-generate bills.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Log Payment Collection</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Record payment against Invoice {selectedBill?.invoiceNumber}. Total Amount due: Rs. {selectedBill?.totalAmount.toFixed(2)}</p>
            
            <form onSubmit={handleSavePayment} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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

      {/* WhatsApp Localized Reminder Modal */}
      {reminderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Send Dues Reminder</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Send outstanding balance reminder to <strong>{reminderCustomer?.name}</strong> (Mobile: {reminderCustomer?.mobile}).</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Select Message Language</label>
                <select 
                  value={reminderLanguage}
                  onChange={(e) => setReminderLanguage(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="english">English Template</option>
                  <option value="marathi">Marathi Template (मराठी)</option>
                </select>
              </div>

              <div style={{ padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '12px', color: '#334155', minHeight: '80px', lineHeight: '1.6' }}>
                {reminderLanguage === 'english' ? (
                  <span>Dear {reminderCustomer?.name}, your outstanding payment of Rs. {outstandingDues.toFixed(2)} is pending. Please pay at the earliest. Thank you, Tammewar Pharmacy.</span>
                ) : (
                  <span>प्रिय {reminderCustomer?.name}, तुमचे थकीत बिल {outstandingDues.toFixed(2)} रुपये प्रलंबित आहे. कृपया लवकरात लवकर भरणा करावा. धन्यवाद, Tammewar Pharmacy.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setReminderModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSendReminder}
                  style={{ flex: 1, padding: '10px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  💬 Send WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
