import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Backup & Restore State
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Add Branch Form State
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', address: '', contact: '' });
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [modalError, setModalError] = useState('');

  const normalizeBranchName = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
  };

  const normalizedBranchInput = normalizeBranchName(branchForm.name);
  const isBranchDuplicate = normalizedBranchInput !== '' && branches.some(b => normalizeBranchName(b.name) === normalizedBranchInput);

  const fetchBackups = async () => {
    try {
      const res = await api.get('/data/backups/history');
      setBackupHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch backup history:', err);
    }
  };

  const fetchData = async () => {
    try {
      const [settRes, branchRes, backupRes] = await Promise.all([
        api.get('/settings'),
        api.get('/branches'),
        api.get('/data/backups/history').catch(() => ({ data: [] }))
      ]);
      setSettings(settRes.data);
      setBranches(branchRes.data);
      setBackupHistory(backupRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch settings parameters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateManualBackup = async () => {
    try {
      setBackupLoading(true);
      setError('');
      setSuccess('');
      const res = await api.post('/data/backup/create');
      setSuccess(res.data.message || 'System backup snapshot created successfully! 💾');
      fetchBackups();
    } catch (err) {
      console.error(err);
      setError('Failed to create manual system backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadFullBackup = async () => {
    try {
      setBackupLoading(true);
      const res = await api.get('/data/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `medical_stock_system_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      setError('Failed to download system backup file');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackupSubmit = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      alert('Please select a JSON backup file to restore.');
      return;
    }
    if (!window.confirm('⚠️ WARNING: Restoring from a backup will overwrite and replace current application state with the data from the file. Are you sure you want to proceed?')) {
      return;
    }

    try {
      setRestoring(true);
      setError('');
      setSuccess('');

      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const parsedJSON = JSON.parse(event.target.result);
          await api.post('/data/restore', parsedJSON);
          setSuccess('System state restored successfully! ✅ All records recovered.');
          setRestoreFile(null);
          fetchData();
        } catch (parseErr) {
          console.error(parseErr);
          setError('Invalid backup JSON file format: ' + parseErr.message);
        } finally {
          setRestoring(false);
        }
      };
      fileReader.readAsText(restoreFile);
    } catch (err) {
      console.error(err);
      setError('Failed to restore backup: ' + (err.response?.data?.error || err.message));
      setRestoring(false);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      await api.put('/settings', settings);
      setSuccess('Business configuration parameters updated successfully! ✅');
    } catch (err) {
      console.error(err);
      setError('Failed to update settings');
    }
  };

  const handleAddBranchSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setModalError('');

    if (isBranchDuplicate) {
      setModalError("Branch already exists.");
      return;
    }

    setSubmittingBranch(true);
    try {
      await api.post('/branches', branchForm);
      setSuccess('New branch registered successfully! ✅');
      setShowAddBranch(false);
      setBranchForm({ name: '', address: '', contact: '' });
      setModalError('');
      fetchData();
    } catch (err) {
      console.error(err);
      const backendMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to register branch';
      setModalError(backendMsg);
    } finally {
      setSubmittingBranch(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading settings panel...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
        
        {/* Shop profile settings */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>🏢 Shop Details</h3>
          
          <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Shop Name</label>
              <input 
                type="text"
                value={settings?.companyName || ''}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>GSTIN Number</label>
                <input 
                  type="text"
                  value={settings?.gstNumber || ''}
                  onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>State</label>
                <input 
                  type="text"
                  value={settings?.state || 'Maharashtra'}
                  onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Contact Details</label>
              <input 
                type="text"
                value={settings?.contact || ''}
                onChange={(e) => setSettings({ ...settings, contact: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Email Address</label>
              <input 
                type="email"
                value={settings?.email || ''}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Shop Address</label>
              <textarea 
                value={settings?.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                rows="3"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <button type="submit" style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              Save Details
            </button>
          </form>
        </div>

        {/* Bank details and SMS templates settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Bank details settings */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>🏦 Bank Details</h3>
            
            <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Bank Name</label>
                <input 
                  type="text"
                  value={settings?.bankDetails?.bankName || ''}
                  onChange={(e) => setSettings({ ...settings, bankDetails: { ...settings.bankDetails, bankName: e.target.value } })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Account Number</label>
                  <input 
                    type="text"
                    value={settings?.bankDetails?.accountNo || ''}
                    onChange={(e) => setSettings({ ...settings, bankDetails: { ...settings.bankDetails, accountNo: e.target.value } })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>IFSC Code</label>
                  <input 
                    type="text"
                    value={settings?.bankDetails?.ifscCode || ''}
                    onChange={(e) => setSettings({ ...settings, bankDetails: { ...settings.bankDetails, ifscCode: e.target.value } })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <button type="submit" style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Save Bank Details
              </button>
            </form>
          </div>

          {/* Dues SMS Templates */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>💬 Payment Messages</h3>
            
            <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>English Message</label>
                <textarea 
                  value={settings?.smsTemplates?.english || ''}
                  onChange={(e) => setSettings({ ...settings, smsTemplates: { ...settings.smsTemplates, english: e.target.value } })}
                  rows="2"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', lineHeight: '1.4' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Marathi Message (मराठी)</label>
                <textarea 
                  value={settings?.smsTemplates?.marathi || ''}
                  onChange={(e) => setSettings({ ...settings, smsTemplates: { ...settings.smsTemplates, marathi: e.target.value } })}
                  rows="2"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', lineHeight: '1.4' }}
                />
              </div>

              <span style={{ fontSize: '10px', color: '#64748b' }}>Variables: {"{customer_name}"}, {"{amount}"}, {"{company_name}"}</span>

              <button type="submit" style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Save Messages
              </button>
            </form>
          </div>

          {/* Backup & System Restore Section */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💾 Complete System Backup & Restore
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCreateManualBackup}
                  disabled={backupLoading}
                  style={{ flex: 1, padding: '10px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: backupLoading ? 'not-allowed' : 'pointer' }}
                >
                  ⚡ {backupLoading ? 'Creating Backup...' : 'Create Backup Snapshot'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFullBackup}
                  disabled={backupLoading}
                  style={{ flex: 1, padding: '10px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: backupLoading ? 'not-allowed' : 'pointer' }}
                >
                  📥 Download Backup (.json)
                </button>
              </div>

              {/* Restore System State */}
              <form onSubmit={handleRestoreBackupSubmit} style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>
                  ♻️ Restore Database State from Backup File
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setRestoreFile(e.target.files[0] || null)}
                    style={{ fontSize: '12px', flex: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={!restoreFile || restoring}
                    style={{ padding: '8px 16px', background: (!restoreFile || restoring) ? '#cbd5e1' : '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: (!restoreFile || restoring) ? 'not-allowed' : 'pointer' }}
                  >
                    {restoring ? 'Restoring...' : 'Restore State'}
                  </button>
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Restores full application state including Users, Settings, Masters, Products, Orders, Purchases, and Logs.</span>
              </form>

              {/* Backup History Table */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>
                  📜 Backup History & Snapshots ({backupHistory.length})
                </h4>
                {backupHistory.length > 0 ? (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Filename</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Size</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Date</th>
                          <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backupHistory.map((b, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: '600', color: '#1e293b' }}>{b.filename}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{b.sizeKB} KB ({b.sizeMB} MB)</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(b.createdAt).toLocaleString()}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <a
                                href={`${import.meta.env.VITE_API_BASE_URL || ''}/data/backups/download/${b.filename}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}
                              >
                                ⬇️ Download
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                    No automated or manual backups saved yet.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Multi-Branch Registry */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>🏢 Branches</h3>
          <button 
            onClick={() => { setModalError(''); setBranchForm({ name: '', address: '', contact: '' }); setShowAddBranch(true); }}
            style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
          >
            ➕ Add Branch
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Branch Name</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Contact Number</th>
              <th style={{ padding: '10px 15px', color: '#475569', fontWeight: 'bold' }}>Address</th>
            </tr>
          </thead>
          <tbody>
            {branches.map(br => (
              <tr key={br._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 15px', fontWeight: '600', color: '#334155' }}>{br.name}</td>
                <td style={{ padding: '10px 15px', color: '#475569' }}>{br.contact}</td>
                <td style={{ padding: '10px 15px', color: '#475569' }}>{br.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Branch Modal */}
      {showAddBranch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Add Branch</h3>
            
            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '6px', fontSize: '12px', marginBottom: '15px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddBranchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Branch Name*</label>
                <input 
                  type="text"
                  value={branchForm.name}
                  onChange={(e) => {
                    setBranchForm({ ...branchForm, name: e.target.value });
                    if (modalError) setModalError('');
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: isBranchDuplicate ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                  required
                />
                {isBranchDuplicate && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    Branch already exists.
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Contact Number*</label>
                <input 
                  type="text"
                  value={branchForm.contact}
                  onChange={(e) => setBranchForm({ ...branchForm, contact: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '5px' }}>Address*</label>
                <textarea 
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  rows="3"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddBranch(false)}
                  disabled={submittingBranch}
                  style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: submittingBranch ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isBranchDuplicate || submittingBranch}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    background: (isBranchDuplicate || submittingBranch) ? '#94a3b8' : '#3b82f6', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: '600', 
                    cursor: (isBranchDuplicate || submittingBranch) ? 'not-allowed' : 'pointer' 
                  }}
                >
                  {submittingBranch ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
