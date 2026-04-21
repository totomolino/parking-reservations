import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import './Insights.css';

const VERDICT_META = { Good: { cls: 'ins-good' }, Bad: { cls: 'ins-bad' }, Horrible: { cls: 'ins-horrible' } };
const PAGE_SIZE = 25;
const VERDICTS = ['All', 'Good', 'Bad', 'Horrible'];
const HORRIBLE_THRESHOLD = 3;

// ── Compute insight cards from rows ──────────────────────────────────────────
function computeInsights(rows) {
  if (!rows || rows.length === 0) return null;
  const total = rows.length;
  const good  = rows.filter(r => r.verdict === 'Good').length;
  const compliancePct = ((good / total) * 100).toFixed(1);
  const complianceColor = compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#d97706' : '#dc2626';

  const horribleByName = {};
  rows.forEach(r => { if (r.verdict === 'Horrible') horribleByName[r.name] = (horribleByName[r.name] || 0) + 1; });
  const topNoShows = Object.entries(horribleByName).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const failByDay = {}, totalByDay = {};
  rows.forEach(r => {
    totalByDay[r.parking_date] = (totalByDay[r.parking_date] || 0) + 1;
    if (r.verdict === 'Bad' || r.verdict === 'Horrible') failByDay[r.parking_date] = (failByDay[r.parking_date] || 0) + 1;
  });
  const worstDay = Object.entries(failByDay).sort((a, b) => b[1] - a[1])[0];
  const worstDayPct = worstDay ? ((worstDay[1] / totalByDay[worstDay[0]]) * 100).toFixed(0) : null;

  const stayRows = rows.filter(r => r.stay_hours != null && (r.verdict === 'Good' || r.verdict === 'Bad'));
  const avgStay = stayRows.length ? (stayRows.reduce((s, r) => s + Number(r.stay_hours), 0) / stayRows.length).toFixed(2) : null;

  return { compliancePct, complianceColor, topNoShows, worstDay, worstDayPct, avgStay };
}

// ── Compute monthly risk from rows ───────────────────────────────────────────
function computeMonthlyRisk(rows) {
  if (!rows || rows.length === 0) return [];
  const map = {};
  rows.forEach(r => {
    const month = r.parking_date?.slice(0, 7); // YYYY-MM
    if (!month) return;
    const key = `${r.zs_id}|${month}`;
    if (!map[key]) map[key] = { zs_id: r.zs_id, name: r.name, month, good: 0, bad: 0, horrible: 0, total: 0 };
    map[key].total++;
    if (r.verdict === 'Good') map[key].good++;
    else if (r.verdict === 'Bad') map[key].bad++;
    else if (r.verdict === 'Horrible') map[key].horrible++;
  });
  return Object.values(map)
    .filter(r => r.horrible >= HORRIBLE_THRESHOLD)
    .sort((a, b) => b.horrible - a.horrible || a.name.localeCompare(b.name));
}

// ── Parse loaner swipes from Data sheet ─────────────────────────────────────
function parseLoaners(wb) {
  if (!wb.SheetNames.includes('Data')) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Data'], { raw: false });
  const loanerRows = rows.filter(r => String(r.employee_type || '').toLowerCase() === 'loaner');

  // Aggregate by (loaner_name, day)
  const map = {};
  loanerRows.forEach(r => {
    const name = String(r.Nombre_2 || r.Nombre || '').trim();
    const hora = r.Hora || '';
    if (!name || !hora) return;
    const day = hora.split(' ')[0];
    const key = `${name}|${day}`;
    if (!map[key]) map[key] = { loaner_name: name, day, swipes: [] };
    map[key].swipes.push(hora);
  });

  return Object.values(map).map(({ loaner_name, day, swipes }) => {
    swipes.sort();
    const entry_time = swipes[0];
    const leave_time = swipes[swipes.length - 1];
    const diffMs = new Date(leave_time) - new Date(entry_time);
    const stay_hours = diffMs > 0 ? parseFloat((diffMs / 3600000).toFixed(2)) : 0;
    return { loaner_name, day, entry_time, leave_time, stay_hours };
  });
}

export default function Insights() {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows]           = useState(null);
  const [error, setError]         = useState(null);
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [fetching, setFetching]   = useState(false);
  const [verdictFilter, setVerdictFilter] = useState('All');
  const [nameSearch, setNameSearch]       = useState('');
  const [page, setPage]           = useState(1);

  // Loaner state
  const [loanerActivity, setLoanerActivity]     = useState([]);
  const [loanerAssignments, setLoanerAssignments] = useState([]);
  const [pendingAssign, setPendingAssign]         = useState({}); // {day|loaner_name: actual_zs_id}

  const fileRef = useRef();

  useEffect(() => { setPage(1); }, [verdictFilter, nameSearch]);

  // Auto-load on mount
  useEffect(() => {
    api.get('/admin/parking-insights/range')
      .then(({ data }) => {
        if (!data.from_date || !data.to_date) return;
        setFromDate(data.from_date);
        setToDate(data.to_date);
        setFetching(true);
        return Promise.all([
          api.get('/admin/parking-insights', { params: { from: data.from_date, to: data.to_date } }),
          api.get('/admin/loaner-activity', { params: { from: data.from_date, to: data.to_date } }),
          api.get('/admin/loaner-assignments', { params: { from: data.from_date, to: data.to_date } }),
        ]);
      })
      .then(results => {
        if (!results) return;
        setRows(results[0].data);
        setLoanerActivity(results[1].data);
        setLoanerAssignments(results[2].data);
      })
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

      // Parse attendance
      const xlsxRows = XLSX.utils.sheet_to_json(wb.Sheets['Daily_ZS_Summary'], { raw: false });
      const attendance = xlsxRows
        .map(row => ({ zs_id: String(row.zs_id || '').trim(), day: String(row.Day || '').split('T')[0].trim(), entry_time: row.entry_time || null, leave_time: row.leave_time || null, stay_hours: row.stay_hours ?? null }))
        .filter(r => r.zs_id && r.day);

      if (attendance.length === 0) { setError('No valid rows in Daily_ZS_Summary.'); return; }

      // Parse loaners from Data sheet
      const loaners = parseLoaners(wb);

      // Send both in parallel
      const [insightRes] = await Promise.all([
        api.post('/admin/parking-insights', { attendance }),
        loaners.length > 0 ? api.post('/admin/loaner-activity', { loaners }) : Promise.resolve(),
      ]);

      setRows(insightRes.data.rows);
      setFromDate(insightRes.data.from);
      setToDate(insightRes.data.to);
      setVerdictFilter('All');
      setNameSearch('');

      // Reload loaner data
      const [lAct, lAssign] = await Promise.all([
        api.get('/admin/loaner-activity', { params: { from: insightRes.data.from, to: insightRes.data.to } }),
        api.get('/admin/loaner-assignments', { params: { from: insightRes.data.from, to: insightRes.data.to } }),
      ]);
      setLoanerActivity(lAct.data);
      setLoanerAssignments(lAssign.data);
      localStorage.setItem('insights_range', JSON.stringify({ from: insightRes.data.from, to: insightRes.data.to }));
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
      const [iRes, lAct, lAssign] = await Promise.all([
        api.get('/admin/parking-insights', { params: { from: fromDate, to: toDate } }),
        api.get('/admin/loaner-activity', { params: { from: fromDate, to: toDate } }),
        api.get('/admin/loaner-assignments', { params: { from: fromDate, to: toDate } }),
      ]);
      setRows(iRes.data);
      setLoanerActivity(lAct.data);
      setLoanerAssignments(lAssign.data);
      setVerdictFilter('All');
      setNameSearch('');
      localStorage.setItem('insights_range', JSON.stringify({ from: fromDate, to: toDate }));
    } catch (err) {
      setError(err.response?.data?.message || 'Fetch failed.');
    } finally {
      setFetching(false);
    }
  };

  const handleAssignLoaner = async (day, loaner_name) => {
    const key = `${day}|${loaner_name}`;
    const actual_zs_id = pendingAssign[key];
    if (!actual_zs_id) return;
    try {
      const res = await api.post('/admin/loaner-assignments', { day, loaner_name, actual_zs_id });
      const roster = rows ? rows.find(r => r.zs_id === actual_zs_id) : null;
      const loaner = loanerActivity.find(l => l.loaner_name === loaner_name && l.day === day);
      setLoanerAssignments(prev => [
        ...prev.filter(a => !(a.day === day && a.actual_zs_id === actual_zs_id)),
        { id: res.data.id, day, loaner_name, actual_zs_id, actual_name: roster?.name || actual_zs_id, loaner_stay_hours: loaner?.stay_hours }
      ]);
      setPendingAssign(prev => { const n = {...prev}; delete n[key]; return n; });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign.');
    }
  };

  const handleRemoveAssignment = async (id) => {
    try {
      await api.delete(`/admin/loaner-assignments/${id}`);
      setLoanerAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert('Failed to remove assignment.');
    }
  };

  const handleDownloadCSV = () => {
    if (!rows) return;
    const headers = ['zs_id', 'name', 'parking_date', 'entry_time', 'leave_time', 'stay_hours', 'verdict'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
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
    total: rows.length,
    good: rows.filter(r => r.verdict === 'Good').length,
    bad: rows.filter(r => r.verdict === 'Bad').length,
    horrible: rows.filter(r => r.verdict === 'Horrible').length,
  } : null;

  const insights    = rows ? computeInsights(rows) : null;
  const monthlyRisk = rows ? computeMonthlyRisk(rows) : [];

  const filteredRows = rows
    ? rows.filter(r => (verdictFilter === 'All' || r.verdict === verdictFilter) && r.name.toLowerCase().includes(nameSearch.toLowerCase()))
    : [];
  const totalPages  = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(page * PAGE_SIZE, filteredRows.length);

  // Build loaner panel data: days with loaner activity
  const horribleByDay = {};
  if (rows) rows.filter(r => r.verdict === 'Horrible').forEach(r => {
    if (!horribleByDay[r.parking_date]) horribleByDay[r.parking_date] = [];
    horribleByDay[r.parking_date].push(r);
  });
  const loanerByDay = {};
  loanerActivity.forEach(l => {
    if (!loanerByDay[l.day]) loanerByDay[l.day] = [];
    loanerByDay[l.day].push(l);
  });
  const assignedZsIds = new Set(loanerAssignments.map(a => `${a.day}|${a.actual_zs_id}`));
  const daysWithLoaners = Object.keys(loanerByDay).filter(day => horribleByDay[day]?.length > 0).sort();

  return (
    <div className="insights-page">

      {/* Upload Panel */}
      <div className="ins-card">
        <h2 className="ins-card-title">Upload Attendance File</h2>
        <p className="ins-hint">
          Upload <code>merged_all_time.xlsx</code>. Both sheets (Daily_ZS_Summary + Data) are parsed locally — loaner records are extracted automatically.
        </p>
        <div className="ins-upload-row">
          <input type="file" accept=".xlsx" ref={fileRef} onChange={e => setFile(e.target.files[0])} className="ins-file-input" />
          <button className="ins-btn ins-btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Processing…' : '📊 Run Insights'}
          </button>
        </div>
        {file && <p className="ins-file-name">Selected: {file.name}</p>}
      </div>

      {/* Date Range Fetch */}
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
          {/* ── Insight Cards ─────────────────────────────────── */}
          {insights && (
            <div className="ins-insight-grid">
              <div className="ins-insight-card">
                <div className="ins-insight-label">Compliance Rate</div>
                <div className="ins-insight-value" style={{ color: insights.complianceColor }}>{insights.compliancePct}%</div>
                <div className="ins-insight-sub">{stats.good} Good out of {stats.total}</div>
              </div>
              <div className="ins-insight-card ins-insight-card--wide">
                <div className="ins-insight-label">Top No-Shows</div>
                {insights.topNoShows.length === 0
                  ? <div className="ins-insight-sub">No no-shows 🎉</div>
                  : <table className="ins-mini-table"><tbody>
                      {insights.topNoShows.map(([name, count]) => (
                        <tr key={name}><td>{name}</td><td className="ins-mini-count">{count}×</td></tr>
                      ))}
                    </tbody></table>
                }
              </div>
              <div className="ins-insight-card">
                <div className="ins-insight-label">Worst Day</div>
                {insights.worstDay
                  ? <><div className="ins-insight-value ins-insight-value--sm">{insights.worstDay[0]}</div>
                      <div className="ins-insight-sub">{insights.worstDay[1]} failures ({insights.worstDayPct}%)</div></>
                  : <div className="ins-insight-sub">No failures 🎉</div>
                }
              </div>
              <div className="ins-insight-card">
                <div className="ins-insight-label">Avg Stay (present)</div>
                <div className="ins-insight-value">{insights.avgStay ? `${insights.avgStay}h` : '—'}</div>
                <div className="ins-insight-sub">Among those who showed up</div>
              </div>
            </div>
          )}

          {/* ── Monthly Risk Panel ────────────────────────────── */}
          {monthlyRisk.length > 0 && (
            <div className="ins-card">
              <h2 className="ins-card-title">⚠️ At Risk of Ban ({HORRIBLE_THRESHOLD}+ Horrible in a month)</h2>
              <table className="ins-table">
                <thead>
                  <tr><th>Name</th><th>ZS ID</th><th>Month</th><th>Horrible</th><th>Bad</th><th>Good</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {monthlyRisk.map((r, i) => (
                    <tr key={i} className="ins-horrible">
                      <td>{r.name}</td>
                      <td className="ins-td-muted">{r.zs_id}</td>
                      <td className="ins-td-muted">{r.month}</td>
                      <td><span className="ins-badge ins-badge-horrible">{r.horrible}</span></td>
                      <td className="ins-td-muted">{r.bad}</td>
                      <td className="ins-td-muted">{r.good}</td>
                      <td className="ins-td-muted">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Loaner Assignments Panel ──────────────────────── */}
          {(daysWithLoaners.length > 0 || loanerAssignments.length > 0) && (
            <div className="ins-card">
              <h2 className="ins-card-title">🔑 Loaner Card Assignments</h2>
              <p className="ins-hint">
                These days have loaner card activity and people with no attendance match. Assign each loaner to the person who used it.
              </p>

              {/* Existing assignments */}
              {loanerAssignments.length > 0 && (
                <div className="ins-loaner-assigned">
                  <h3 className="ins-loaner-subtitle">Saved Assignments</h3>
                  <table className="ins-table">
                    <thead>
                      <tr><th>Date</th><th>Loaner</th><th>Stay</th><th>Assigned To</th><th></th></tr>
                    </thead>
                    <tbody>
                      {loanerAssignments.map(a => (
                        <tr key={a.id}>
                          <td className="ins-td-muted">{a.day}</td>
                          <td>{a.loaner_name}</td>
                          <td className="ins-td-muted">{a.loaner_stay_hours != null ? `${Number(a.loaner_stay_hours).toFixed(2)}h` : '—'}</td>
                          <td>{a.actual_name}</td>
                          <td>
                            <button className="ins-action-btn ins-action-remove" onClick={() => handleRemoveAssignment(a.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Unassigned days */}
              {daysWithLoaners.map(day => {
                const dayLoaners = loanerByDay[day] || [];
                const dayHorribles = (horribleByDay[day] || []).filter(r => !assignedZsIds.has(`${day}|${r.zs_id}`));
                if (dayHorribles.length === 0) return null;
                return (
                  <div key={day} className="ins-loaner-day">
                    <div className="ins-loaner-day-header">{day}</div>
                    {dayLoaners.map(loaner => {
                      const key = `${day}|${loaner.loaner_name}`;
                      return (
                        <div key={key} className="ins-loaner-row">
                          <div className="ins-loaner-card-name">
                            {loaner.loaner_name}
                            <span className="ins-loaner-hours">{Number(loaner.stay_hours).toFixed(2)}h</span>
                          </div>
                          <span className="ins-loaner-arrow">→</span>
                          <select
                            className="ins-input ins-loaner-select"
                            value={pendingAssign[key] || ''}
                            onChange={e => setPendingAssign(prev => ({ ...prev, [key]: e.target.value }))}
                          >
                            <option value="">— select person —</option>
                            {dayHorribles.map(r => (
                              <option key={r.zs_id} value={r.zs_id}>{r.name}</option>
                            ))}
                          </select>
                          <button
                            className="ins-btn ins-btn-primary ins-loaner-save"
                            onClick={() => handleAssignLoaner(day, loaner.loaner_name)}
                            disabled={!pendingAssign[key]}
                          >Save</button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Results Table ─────────────────────────────────── */}
          <div className="ins-card">
            <div className="ins-results-header">
              <h2 className="ins-card-title" style={{ margin: 0 }}>Results — {fromDate} to {toDate}</h2>
              <button className="ins-btn ins-btn-ghost" onClick={handleDownloadCSV}>⬇ Download CSV</button>
            </div>
            <div className="ins-stats">
              <div className="ins-stat ins-stat-total">Total: {stats.total}</div>
              <div className="ins-stat ins-stat-good">Good: {stats.good}</div>
              <div className="ins-stat ins-stat-bad">Bad: {stats.bad}</div>
              <div className="ins-stat ins-stat-horrible">Horrible: {stats.horrible}</div>
            </div>
            <div className="ins-filter-bar">
              <div className="ins-verdict-pills">
                {VERDICTS.map(v => (
                  <button key={v} className={`ins-pill ins-pill-${v.toLowerCase()} ${verdictFilter === v ? 'ins-pill--active' : ''}`} onClick={() => setVerdictFilter(v)}>{v}</button>
                ))}
              </div>
              <input type="text" className="ins-input ins-search" placeholder="Search by name…" value={nameSearch} onChange={e => setNameSearch(e.target.value)} />
            </div>
            {filteredRows.length === 0
              ? <p className="ins-empty">No rows match the current filters.</p>
              : <>
                  <table className="ins-table">
                    <thead>
                      <tr><th>Name</th><th>ZS ID</th><th>Date</th><th>Entry</th><th>Leave</th><th>Hours</th><th>Verdict</th></tr>
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
                            <td className="ins-td-muted">{row.stay_hours != null ? Number(row.stay_hours).toFixed(2) : '—'}</td>
                            <td><span className={`ins-badge ins-badge-${(row.verdict || '').toLowerCase()}`}>{row.verdict}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="ins-pagination">
                      <span className="ins-page-info">Showing {showingFrom}–{showingTo} of {filteredRows.length}</span>
                      <button className="ins-btn ins-btn-ghost ins-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
                      <span className="ins-page-num">Page {page} of {totalPages}</span>
                      <button className="ins-btn ins-btn-ghost ins-page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next →</button>
                    </div>
                  )}
                </>
            }
          </div>
        </>
      )}
    </div>
  );
}
