import React, { useState } from 'react';
import api from '../services/api';

export default function BulkImportModal({ moduleName, title, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importReport, setImportReport] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        setFile(null);
        return;
      }
      setError('');
      setFile(selectedFile);
    }
  };

  const handleDownloadSample = async () => {
    try {
      setError('');
      const res = await api.get(`/import/sample/${moduleName}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Sample_${title.replace(/\s+/g, '_')}_Import.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      setError('Failed to download sample template');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel file to upload');
      return;
    }

    setLoading(true);
    setError('');
    setImportReport(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result;
          const res = await api.post(`/import/${moduleName}`, {
            fileData: base64Data
          });
          setImportReport(res.data);
          if (res.data.successCount > 0 && onSuccess) {
            onSuccess();
          }
        } catch (err) {
          console.error(err);
          setError(err.response?.data?.error || 'Failed to process Excel import');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError('Error reading Excel file');
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '15px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              📥 Bulk Excel Import — {title}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
              Upload .xlsx / .xls spreadsheet to import multiple {title.toLowerCase()} records into system.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        {/* Step 1: Download Template */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Need formatted Excel template?</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Download sample file with required columns.</div>
          </div>
          <button
            type="button"
            onClick={handleDownloadSample}
            style={{ padding: '8px 14px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
          >
            📄 Sample Template
          </button>
        </div>

        {/* Step 2: Select File */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>
            Select Excel Spreadsheet (.xlsx, .xls)<span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            style={{ width: '100%', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#fafafa', cursor: 'pointer', fontSize: '13px' }}
          />
        </div>

        {/* Import Report Section */}
        {importReport && (
          <div style={{ marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', padding: '12px 16px', fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>
              📊 Import Validation Summary
            </div>
            <div style={{ padding: '16px', display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1, background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Total Rows</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{importReport.totalRows}</div>
              </div>
              <div style={{ flex: 1, background: '#d1fae5', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#065f46' }}>Imported</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46' }}>{importReport.successCount}</div>
              </div>
              <div style={{ flex: 1, background: importReport.failedCount > 0 ? '#fee2e2' : '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: importReport.failedCount > 0 ? '#b91c1c' : '#64748b' }}>Skipped / Errors</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: importReport.failedCount > 0 ? '#b91c1c' : '#0f172a' }}>{importReport.failedCount}</div>
              </div>
            </div>

            {/* Skipped Rows Table */}
            {importReport.skippedRows && importReport.skippedRows.length > 0 && (
              <div style={{ padding: '0 16px 16px 16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#b91c1c', marginBottom: '8px' }}>
                  ⚠️ Skipped Rows Breakdown ({importReport.skippedRows.length} rows):
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #fee2e2', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#fef2f2', color: '#991b1b' }}>
                        <th style={{ padding: '6px 8px' }}>Row #</th>
                        <th style={{ padding: '6px 8px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importReport.skippedRows.map((sk, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #fee2e2' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>Row {sk.row}</td>
                          <td style={{ padding: '6px 8px', color: '#b91c1c' }}>{sk.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '10px 18px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
          >
            {importReport ? 'Close' : 'Cancel'}
          </button>
          {!importReport && (
            <button
              type="button"
              disabled={loading || !file}
              onClick={handleUpload}
              style={{
                padding: '10px 20px',
                background: file && !loading ? '#2563eb' : '#94a3b8',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: file && !loading ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? 'Processing Excel...' : 'Upload & Import'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
