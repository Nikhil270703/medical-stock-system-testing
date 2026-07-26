import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { validateEmployeeForm, formatMobileInput, sanitizeText, sanitizeEmail } from '../utils/validation';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perfLoading, setPerfLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Performance Filters
  const [perfStart, setPerfStart] = useState('');
  const [perfEnd, setPerfEnd] = useState('');

  // Form State
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', mobile: '', role: 'Delivery Staff', joiningDate: '', branchId: '', email: '', password: '' });
  const [touched, setTouched] = useState({});

  const fetchData = async () => {
    try {
      const [empRes, branchRes] = await Promise.all([
        api.get('/employees'),
        api.get('/branches')
      ]);
      setEmployees(empRes.data);
      setBranches(branchRes.data);
      if (branchRes.data.length > 0) {
        setFormData(prev => ({ ...prev, branchId: branchRes.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load employee list or branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async () => {
    setPerfLoading(true);
    try {
      let params = [];
      if (perfStart) params.push(`startDate=${perfStart}`);
      if (perfEnd) params.push(`endDate=${perfEnd}`);
      const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
      
      const res = await api.get(`/employees/performance${queryStr}`);
      setPerformance(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch employee delivery performance metrics');
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPerformance();
  }, []);

  const formErrors = validateEmployeeForm(formData);
  const isFormValid = !Object.values(formErrors).some(Boolean);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    const errors = validateEmployeeForm(formData);
    if (Object.values(errors).some(Boolean)) {

      setTouched({ name: true, mobile: true, branchId: true, email: true, password: true });
      return;
    }
    const payload = {
      ...formData,
      name: sanitizeText(formData.name),
      email: formData.email ? sanitizeEmail(formData.email) : ''
    };
    try {
      await api.post('/employees', payload);
      setSuccess('Employee profile registered successfully! ✅');
      setShowAdd(false);
      setTouched({});
      setFormData({ name: '', mobile: '', role: 'Delivery Staff', joiningDate: '', branchId: branches[0]?._id || '', email: '', password: '' });
      fetchData();
      fetchPerformance();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to register employee');
    }
  };

  const handleToggleStatus = async (employee) => {
    setSuccess('');
    setError('');
    const nextStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.put(`/employees/${employee._id}`, { status: nextStatus });
      setSuccess(`Employee status updated to ${nextStatus}! ✅`);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee? This will also remove their user account.')) return;
    setSuccess('');
    setError('');
    try {
      await api.delete(`/employees/${id}`);
      setSuccess('Employee profile deleted successfully. ✅');
      fetchData();
      fetchPerformance();
    } catch (err) {
      console.error(err);
      setError('Failed to delete employee profile');
    }
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading employees catalog...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {success && (
        <div style={{ padding: '12px', background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '8px' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Employees CRUD List */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>👥 Staff List</h3>
          <button 
            onClick={() => setShowAdd(true)}
            style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
          >
            Add Staff
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Name</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Mobile</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Branch</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Role</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Joining Date</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 15px', fontWeight: '600', color: '#334155' }}>{emp.name}</td>
                <td style={{ padding: '10px 15px', color: '#475569' }}>{emp.mobile}</td>
                <td style={{ padding: '10px 15px', color: '#475569' }}>{emp.branch?.name || 'N/A'}</td>
                <td style={{ padding: '10px 15px', color: '#475569' }}>{emp.role}</td>
                <td style={{ padding: '10px 15px', color: '#475569' }}>{new Date(emp.joiningDate).toLocaleDateString()}</td>
                <td style={{ padding: '10px 15px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    background: emp.status === 'Active' ? '#d1fae5' : '#fee2e2',
                    color: emp.status === 'Active' ? '#065f46' : '#b91c1c',
                    fontWeight: 'bold'
                  }}>
                    {emp.status}
                  </span>
                </td>
                <td style={{ padding: '10px 15px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => handleToggleStatus(emp)}
                    style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Toggle Status
                  </button>
                  <button 
                    onClick={() => handleDelete(emp._id)}
                    style={{ padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Employee Delivery Performance Report */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>🚚 Staff Performance</h3>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input type="date" value={perfStart} onChange={(e) => setPerfStart(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
            <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
            <input type="date" value={perfEnd} onChange={(e) => setPerfEnd(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
            <button 
              onClick={fetchPerformance}
              style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
            >
              Filter
            </button>
          </div>
        </div>

        {perfLoading ? (
          <div>Loading performance...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Driver Name</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Branch</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Deliveries Completed</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Avg Delivery Time</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>On-Time</th>
                <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Delayed</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#334155' }}>{p.name}</td>
                  <td style={{ padding: '10px 15px', color: '#475569' }}>{p.branchName}</td>
                  <td style={{ padding: '10px 15px', fontWeight: 'bold', color: '#166534' }}>{p.deliveriesCompleted} Runs</td>
                  <td style={{ padding: '10px 15px', color: '#3b82f6', fontWeight: 'bold' }}>{p.averageDeliveryTimeInMinutes} Mins</td>
                  <td style={{ padding: '10px 15px', color: '#166534', fontWeight: '600' }}>{p.onTimeDeliveries}</td>
                  <td style={{ padding: '10px 15px', color: '#b91c1c', fontWeight: '600' }}>{p.delayedDeliveries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Register Employee Profile</h3>
            
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                  Employee Name<span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onBlur={() => handleBlur('name')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.name && formErrors.name ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
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
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: touched.mobile && formErrors.mobile ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                />
                {touched.mobile && formErrors.mobile && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{formErrors.mobile}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Role Profile<span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={formData.role} 
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="Delivery Staff">Delivery Staff</option>
                    <option value="Packer">Packer</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
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
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Date of Joining</label>
                <input 
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <strong style={{ fontSize: '12px', color: '#334155', display: 'block', marginBottom: '8px' }}>Create Portal Login (Optional)</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Login Email</label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={() => handleBlur('email')}
                      placeholder="email@example.com"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: touched.email && formErrors.email ? '1px solid #ef4444' : '1px solid #cbd5e1', background: '#fff' }}
                    />
                    {touched.email && formErrors.email && (
                      <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{formErrors.email}</div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Password</label>
                    <input 
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onBlur={() => handleBlur('password')}
                      placeholder="Min 8 characters"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: touched.password && formErrors.password ? '1px solid #ef4444' : '1px solid #cbd5e1', background: '#fff' }}
                    />
                    {touched.password && formErrors.password && (
                      <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{formErrors.password}</div>
                    )}
                  </div>
                </div>
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
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
