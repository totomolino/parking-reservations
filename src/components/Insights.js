import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import './Insights.css';

const VERDICT_META = {
  Good:     { cls: 'ins-good' },
  Bad:      { cls: 'ins-bad' },
  Horrible: { cls: 'ins-horrible' },
};

export default function Insights() {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows]           = useState(null);
  const [error, setError]         = useState(null);
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [fetching, setFetching]   = useState(false);
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Parse xlsx client-side — send JSON to avoid Zscaler file upload block
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', raw: false });
      if (!wb.SheetNames.includes('Daily_ZS_Summary')) {
        setError('Sheet "Daily_ZS_Summary" not found. Upload merged_all_time.xlsx.');
        return;
      }
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Daily_ZS_Summary'], { raw: false });
      const attendance = rows
        .map(row => ({
          zs_id:      String(row.zs_id || '').trim(),
          day:        String(row.Day || '').split('T')[0].trim(),
          entry_time: row.entry_time || null,
          leave_time: row.leave_time || null,
          stay_hours: row.stay_hours ?? null,
        }))
        .filter(r => r.zs_id && r.day);

      if (attendance.length === 0) {
        setError('No valid rows found in Daily_ZS_Summary sheet.');
        return;
      }

      const r = await api.post('/admin/parking-insights', { attendance });
      setRows(r.data.rows);
      setFromDate(r.data.from);
      setToDate(r.data.to);
    } catch (err) {
      setError(err.response?.data?.message || 'Processing failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleFetch = async () => {
    if (!fromDate || !toDate) return;
    setFetching(true);
    setError(null);
    try {
      const r = await api.get('/admin/parking-insights', { params: { from: fromDate, to: toDate } });
      setRows(r.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Fetch failed.');
    } finally {
      setFetching(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!rows) return;
    const headers = ['zs_id', 'name', 'parking_date', 'entry_time', 'leave_time', 'stay_hours', 'verdict'];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parking_insights_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = rows ? {
    total:    rows.length,
    good:     rows.filter(r => r.verdict === 'Good').length,
    bad:      rows.filter(r => r.verdict === 'Bad').length,
    horrible: rows.filter(r => r.verdict === 'Horrible').length,
  } : null;

  return (
    <div className="insights-page">

      {/* Upload Panel */}
      <div className="ins-card">
        <h2 className="ins-card-title">Upload Attendance File</h2>
        <p className="ins-hint">
          Upload <code>merged_all_time.xlsx</code> from the normalization script.
          The file is parsed locally in your browser — no binary upload to the server.
        </p>
        <div className="ins-upload-row">
          <input
            type="file"
            accept=".xlsx"
            ref={fileRef}
            onChange={e => setFile(e.target.files[0])}
            className="ins-file-input"
          />
          <button className="ins-btn ins-btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Processing…' : '📊 Run Insights'}
          </button>
        </div>
        {file && <p className="ins-file-name">Selected: {file.name}</p>}
      </div>

      {/* Date Range Fetch Panel */}
      <div className="ins-card">
        <h2 className="ins-card-title">Load Stored Insights</h2>
        <div className="ins-date-row">
          <label className="ins-label">From</label>
          <input type="date" className="ins-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <label className="ins-label">To</label>
          <input type="date" className="ins-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          <button className="ins-btn ins-btn-ghost" onClick={handleFetch} disabled={!fromDate || !toDate || fetching}>
            {fetching ? 'Loading…' : '↺ Load'}
          </button>
        </div>
      </div>

      {error && <div className="ins-error">{error}</div>}

      {/* Results Table */}
      {rows && (
        <div className="ins-card">
          <div className="ins-results-header">
            <h2 className="ins-card-title" style={{ margin: 0 }}>
              Results — {fromDate} to {toDate}
            </h2>
            <button className="ins-btn ins-btn-ghost" onClick={handleDownloadCSV}>⬇ Download CSV</button>
          </div>

          <div className="ins-stats">
            <div className="ins-stat ins-stat-total">Total: {stats.total}</div>
            <div className="ins-stat ins-stat-good">Good: {stats.good}</div>
            <div className="ins-stat ins-stat-bad">Bad: {stats.bad}</div>
            <div className="ins-stat ins-stat-horrible">Horrible: {stats.horrible}</div>
          </div>

          {rows.length === 0
            ? <p className="ins-empty">No data found for this date range.</p>
            : (
              <table className="ins-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ZS ID</th>
                    <th>Date</th>
                    <th>Entry</th>
                    <th>Leave</th>
                    <th>Hours</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const meta = VERDICT_META[row.verdict] || VERDICT_META.Horrible;
                    return (
                      <tr key={i} className={meta.cls}>
                        <td>{row.name}</td>
                        <td className="ins-td-muted">{row.zs_id}</td>
                        <td className="ins-td-muted">{row.parking_date}</td>
                        <td className="ins-td-muted">{row.entry_time || '—'}</td>
                        <td className="ins-td-muted">{row.leave_time || '—'}</td>
                        <td className="ins-td-muted">
                          {row.stay_hours != null ? Number(row.stay_hours).toFixed(2) : '—'}
                        </td>
                        <td>
                          <span className={`ins-badge ins-badge-${(row.verdict || '').toLowerCase()}`}>
                            {row.verdict}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  );
}
