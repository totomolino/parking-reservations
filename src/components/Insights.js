import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import './Insights.css';

const VERDICT_META = {
  Good:     { cls: 'ins-good' },
  Bad:      { cls: 'ins-bad' },
  Horrible: { cls: 'ins-horrible' },
};

const PAGE_SIZE = 25;
const VERDICTS = ['All', 'Good', 'Bad', 'Horrible'];

function computeInsights(rows) {
  if (!rows || rows.length === 0) return null;

  const total = rows.length;
  const good  = rows.filter(r => r.verdict === 'Good').length;
  const compliancePct = ((good / total) * 100).toFixed(1);
  const complianceColor = compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#d97706' : '#dc2626';

  // Top no-shows: count Horrible per person
  const horribleByName = {};
  rows.forEach(r => {
    if (r.verdict === 'Horrible') {
      horribleByName[r.name] = (horribleByName[r.name] || 0) + 1;
    }
  });
  const topNoShows = Object.entries(horribleByName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Worst day: highest Bad+Horrible count
  const failByDay = {};
  const totalByDay = {};
  rows.forEach(r => {
    totalByDay[r.parking_date] = (totalByDay[r.parking_date] || 0) + 1;
    if (r.verdict === 'Bad' || r.verdict === 'Horrible') {
      failByDay[r.parking_date] = (failByDay[r.parking_date] || 0) + 1;
    }
  });
  const worstDay = Object.entries(failByDay).sort((a, b) => b[1] - a[1])[0];
  const worstDayPct = worstDay
    ? ((worstDay[1] / totalByDay[worstDay[0]]) * 100).toFixed(0)
    : null;

  // Avg stay hours for those who showed up (Bad + Good)
  const stayRows = rows.filter(r => r.stay_hours != null && (r.verdict === 'Good' || r.verdict === 'Bad'));
  const avgStay = stayRows.length
    ? (stayRows.reduce((s, r) => s + Number(r.stay_hours), 0) / stayRows.length).toFixed(2)
    : null;

  return { compliancePct, complianceColor, topNoShows, worstDay, worstDayPct, avgStay };
}

export default function Insights() {
  const [file, setFile]                 = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [rows, setRows]                 = useState(null);
  const [error, setError]               = useState(null);
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');
  const [fetching, setFetching]         = useState(false);
  const [verdictFilter, setVerdictFilter] = useState('All');
  const [nameSearch, setNameSearch]     = useState('');
  const [page, setPage]                 = useState(1);
  const fileRef = useRef();

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [verdictFilter, nameSearch]);

  // Auto-load last used date range on mount
  useEffect(() => {
    const saved = localStorage.getItem('insights_range');
    if (!saved) return;
    const { from, to } = JSON.parse(saved);
    if (!from || !to) return;
    setFromDate(from);
    setToDate(to);
    setFetching(true);
    api.get('/admin/parking-insights', { params: { from, to } })
      .then(r => setRows(r.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', raw: false });
      if (!wb.SheetNames.includes('Daily_ZS_Summary')) {
        setError('Sheet "Daily_ZS_Summary" not found. Upload merged_all_time.xlsx.');
        return;
      }
      const xlsxRows = XLSX.utils.sheet_to_json(wb.Sheets['Daily_ZS_Summary'], { raw: false });
      const attendance = xlsxRows
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
      localStorage.setItem('insights_range', JSON.stringify({ from: r.data.from, to: r.data.to }));
      setVerdictFilter('All');
      setNameSearch('');
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
      localStorage.setItem('insights_range', JSON.stringify({ from: fromDate, to: toDate }));
      setVerdictFilter('All');
      setNameSearch('');
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

  // Derived
  const stats = rows ? {
    total:    rows.length,
    good:     rows.filter(r => r.verdict === 'Good').length,
    bad:      rows.filter(r => r.verdict === 'Bad').length,
    horrible: rows.filter(r => r.verdict === 'Horrible').length,
  } : null;

  const insights = rows ? computeInsights(rows) : null;

  const filteredRows = rows
    ? rows.filter(r =>
        (verdictFilter === 'All' || r.verdict === verdictFilter) &&
        r.name.toLowerCase().includes(nameSearch.toLowerCase())
      )
    : [];

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows  = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(page * PAGE_SIZE, filteredRows.length);

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

      {rows && (
        <>
          {/* ── Insight Cards ─────────────────────────────────────── */}
          {insights && (
            <div className="ins-insight-grid">

              {/* Compliance Rate */}
              <div className="ins-insight-card">
                <div className="ins-insight-label">Compliance Rate</div>
                <div className="ins-insight-value" style={{ color: insights.complianceColor }}>
                  {insights.compliancePct}%
                </div>
                <div className="ins-insight-sub">{stats.good} Good out of {stats.total} assignments</div>
              </div>

              {/* Top No-Shows */}
              <div className="ins-insight-card ins-insight-card--wide">
                <div className="ins-insight-label">Top No-Shows</div>
                {insights.topNoShows.length === 0
                  ? <div className="ins-insight-sub">No no-shows 🎉</div>
                  : (
                    <table className="ins-mini-table">
                      <tbody>
                        {insights.topNoShows.map(([name, count]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td className="ins-mini-count">{count}×</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </div>

              {/* Worst Day */}
              <div className="ins-insight-card">
                <div className="ins-insight-label">Worst Day</div>
                {insights.worstDay
                  ? <>
                      <div className="ins-insight-value ins-insight-value--sm">{insights.worstDay[0]}</div>
                      <div className="ins-insight-sub">{insights.worstDay[1]} failures ({insights.worstDayPct}% that day)</div>
                    </>
                  : <div className="ins-insight-sub">No failures 🎉</div>
                }
              </div>

              {/* Avg Stay */}
              <div className="ins-insight-card">
                <div className="ins-insight-label">Avg Stay (present)</div>
                <div className="ins-insight-value">
                  {insights.avgStay ? `${insights.avgStay}h` : '—'}
                </div>
                <div className="ins-insight-sub">Among those who showed up</div>
              </div>

            </div>
          )}

          {/* ── Results Table ─────────────────────────────────────── */}
          <div className="ins-card">
            <div className="ins-results-header">
              <h2 className="ins-card-title" style={{ margin: 0 }}>
                Results — {fromDate} to {toDate}
              </h2>
              <button className="ins-btn ins-btn-ghost" onClick={handleDownloadCSV}>⬇ Download CSV</button>
            </div>

            {/* Stats */}
            <div className="ins-stats">
              <div className="ins-stat ins-stat-total">Total: {stats.total}</div>
              <div className="ins-stat ins-stat-good">Good: {stats.good}</div>
              <div className="ins-stat ins-stat-bad">Bad: {stats.bad}</div>
              <div className="ins-stat ins-stat-horrible">Horrible: {stats.horrible}</div>
            </div>

            {/* Filter Bar */}
            <div className="ins-filter-bar">
              <div className="ins-verdict-pills">
                {VERDICTS.map(v => (
                  <button
                    key={v}
                    className={`ins-pill ins-pill-${v.toLowerCase()} ${verdictFilter === v ? 'ins-pill--active' : ''}`}
                    onClick={() => setVerdictFilter(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="ins-input ins-search"
                placeholder="Search by name…"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
              />
            </div>

            {filteredRows.length === 0
              ? <p className="ins-empty">No rows match the current filters.</p>
              : (
                <>
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
                      {pagedRows.map((row, i) => {
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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="ins-pagination">
                      <span className="ins-page-info">
                        Showing {showingFrom}–{showingTo} of {filteredRows.length}
                      </span>
                      <button
                        className="ins-btn ins-btn-ghost ins-page-btn"
                        onClick={() => setPage(p => p - 1)}
                        disabled={page === 1}
                      >← Prev</button>
                      <span className="ins-page-num">Page {page} of {totalPages}</span>
                      <button
                        className="ins-btn ins-btn-ghost ins-page-btn"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page === totalPages}
                      >Next →</button>
                    </div>
                  )}
                </>
              )
            }
          </div>
        </>
      )}
    </div>
  );
}
