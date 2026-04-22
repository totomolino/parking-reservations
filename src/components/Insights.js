import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import './Insights.css';

const VERDICT_META = { Good: { cls: 'ins-good' }, Bad: { cls: 'ins-bad' }, Horrible: { cls: 'ins-horrible' } };
const PAGE_SIZE = 25;
const VERDICTS = ['All', 'Good', 'Bad', 'Horrible'];
const DEFAULT_HORRIBLE_THRESHOLD = 3;

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

// ── Compute risk per person (one row per person) ─────────────────────────────
function computePersonRisk(rows, threshold = 0) {
  if (!rows || rows.length === 0) return [];
  const map = {};
  rows.forEach(r => {
    if (!map[r.zs_id]) map[r.zs_id] = { zs_id: r.zs_id, name: r.name, good: 0, bad: 0, horrible: 0, total: 0 };
    map[r.zs_id].total++;
    if (r.verdict === 'Good') map[r.zs_id].good++;
    else if (r.verdict === 'Bad') map[r.zs_id].bad++;
    else if (r.verdict === 'Horrible') map[r.zs_id].horrible++;
  });
  return Object.values(map)
    .filter(r => r.horrible >= threshold)
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
  const [page, setPage]                   = useState(1);
  const [riskMonth, setRiskMonth]           = useState('All');
  const [riskThreshold, setRiskThreshold]   = useState(DEFAULT_HORRIBLE_THRESHOLD);

  // Loaner state
  const [loanerActivity, setLoanerActivity]       = useState([]);
  const [loanerAssignments, setLoanerAssignments] = useState([]);
  const [pendingLoaner, setPendingLoaner]         = useState({}); // {zs_id|day: loaner_name}

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

  const handleAssignLoaner = async (zs_id, day) => {
    const key = `${zs_id}|${day}`;
    const loaner_name = pendingLoaner[key];
    if (!loaner_name) return;
    try {
      const res = await api.post('/admin/loaner-assignments', { day, loaner_name, actual_zs_id: zs_id });
      const loaner = loanerActivity.find(l => l.loaner_name === loaner_name && l.day === day);
      const person = rows?.find(r => r.zs_id === zs_id);
      setLoanerAssignments(prev => [
        ...prev.filter(a => !(a.day === day && a.actual_zs_id === zs_id)),
        { id: res.data.id, day, loaner_name, actual_zs_id: zs_id, actual_name: person?.name || zs_id, loaner_stay_hours: loaner?.stay_hours }
      ]);
      setPendingLoaner(prev => { const n = {...prev}; delete n[key]; return n; });
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

  // Build loaner lookup: day → [loaner records]
  const loanerByDay = {};
  loanerActivity.forEach(l => {
    if (!loanerByDay[l.day]) loanerByDay[l.day] = [];
    loanerByDay[l.day].push(l);
  });
  // assignment lookup: "zs_id|day" → assignment record (must be before effectiveRows)
  const assignmentByKey = {};
  loanerAssignments.forEach(a => { assignmentByKey[`${a.actual_zs_id}|${a.day}`] = a; });

  // Apply loaner corrections: Horrible rows with an assignment become Good/Bad
  const effectiveRows = rows ? rows.map(r => {
    const a = assignmentByKey[`${r.zs_id}|${r.parking_date}`];
    if (r.verdict === 'Horrible' && a) {
      const corrected = (a.loaner_stay_hours != null && a.loaner_stay_hours >= 6.0) ? 'Good' : 'Bad';
      return { ...r, verdict: corrected, stay_hours: a.loaner_stay_hours };
    }
    return r;
  }) : null;

  const insights    = effectiveRows ? computeInsights(effectiveRows) : null;
  const effectiveStats = effectiveRows ? {
    total:    effectiveRows.length,
    good:     effectiveRows.filter(r => r.verdict === 'Good').length,
    bad:      effectiveRows.filter(r => r.verdict === 'Bad').length,
    horrible: effectiveRows.filter(r => r.verdict === 'Horrible').length,
  } : null;

  const availableMonths = rows ? [...new Set(rows.map(r => r.parking_date?.slice(0, 7)).filter(Boolean))].sort() : [];
  const riskRows = effectiveRows
    ? (riskMonth === 'All' ? effectiveRows : effectiveRows.filter(r => r.parking_date?.startsWith(riskMonth)))
    : [];
  const personRisk = computePersonRisk(riskRows, riskThreshold);

  const filteredRows = rows
    ? rows.filter(r => (verdictFilter === 'All' || r.verdict === verdictFilter) && r.name.toLowerCase().includes(nameSearch.toLowerCase()))
    : [];
  const totalPages  = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(page * PAGE_SIZE, filteredRows.length);

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
        <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <button
            className="ins-btn ins-btn-danger"
            onClick={async () => {
              if (!window.confirm('This will delete ALL stored insights, loaner activity and assignments. Are you sure?')) return;
              try {
                await api.delete('/admin/insights-data');
                setRows(null); setLoanerActivity([]); setLoanerAssignments([]);
                setFromDate(''); setToDate('');
                localStorage.removeItem('insights_range');
              } catch (err) {
                alert(err.response?.data?.message || 'Failed to clear data.');
              }
            }}
          >
            🗑 Clear All Data
          </button>
        </div>
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
                <div className="ins-insight-sub">{effectiveStats.good} Good out of {effectiveStats.total}</div>
              </div>
              <div className="ins-insight-card ins-insight-card--wide">
                <div className="ins-insight-label">Top No-Shows (all time total)</div>
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

          {/* ── Risk Panel ───────────────────────────────────── */}
          <div className="ins-card">
            <div className="ins-results-header">
              <h2 className="ins-card-title" style={{ margin: 0 }}>⚠️ At Risk of Ban</h2>
              <div className="ins-date-row">
                <label className="ins-label">Min Horrible</label>
                <input
                  type="number" min="0" max="20" className="ins-input" style={{ width: '60px' }}
                  value={riskThreshold}
                  onChange={e => setRiskThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <label className="ins-label">Month</label>
                <select className="ins-input" value={riskMonth} onChange={e => setRiskMonth(e.target.value)}>
                  <option value="All">All months</option>
                  {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {personRisk.length === 0
              ? <p className="ins-empty">No users match the current filters.</p>
              : <table className="ins-table">
                  <thead>
                    <tr><th>Name</th><th>ZS ID</th><th>Horrible</th><th>Bad</th><th>Good</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {personRisk.map((r, i) => (
                      <tr key={i} className="ins-horrible">
                        <td>{r.name}</td>
                        <td className="ins-td-muted">{r.zs_id}</td>
                        <td><span className="ins-badge ins-badge-horrible">{r.horrible}</span></td>
                        <td className="ins-td-muted">{r.bad}</td>
                        <td className="ins-td-muted">{r.good}</td>
                        <td className="ins-td-muted">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

          {/* ── Results Table ─────────────────────────────────── */}
          <div className="ins-card">
            <div className="ins-results-header">
              <h2 className="ins-card-title" style={{ margin: 0 }}>Results — {fromDate} to {toDate}</h2>
              <button className="ins-btn ins-btn-ghost" onClick={handleDownloadCSV}>⬇ Download CSV</button>
            </div>
            <div className="ins-stats">
              <div className="ins-stat ins-stat-total">Total: {effectiveStats.total}</div>
              <div className="ins-stat ins-stat-good">Good: {effectiveStats.good}</div>
              <div className="ins-stat ins-stat-bad">Bad: {effectiveStats.bad}</div>
              <div className="ins-stat ins-stat-horrible">Horrible: {effectiveStats.horrible}</div>
              {loanerAssignments.length > 0 && (
                <div className="ins-stat" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  🔑 {loanerAssignments.length} loaner{loanerAssignments.length > 1 ? 's' : ''} assigned
                </div>
              )}
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
                      <tr><th>Name</th><th>ZS ID</th><th>Date</th><th>Entry</th><th>Leave</th><th>Hours</th><th>Verdict</th><th>Loaner</th></tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, i) => {
                        const meta = VERDICT_META[row.verdict] || VERDICT_META.Horrible;
                        const isHorrible = row.verdict === 'Horrible';
                        const dayLoaners = loanerByDay[row.parking_date] || [];
                        const assignKey = `${row.zs_id}|${row.parking_date}`;
                        const existingAssign = assignmentByKey[assignKey];
                        return (
                          <tr key={i} className={meta.cls}>
                            <td>{row.name}</td>
                            <td className="ins-td-muted">{row.zs_id}</td>
                            <td className="ins-td-muted">{row.parking_date}</td>
                            <td className="ins-td-muted">{row.entry_time || '—'}</td>
                            <td className="ins-td-muted">{row.leave_time || '—'}</td>
                            <td className="ins-td-muted">{row.stay_hours != null ? Number(row.stay_hours).toFixed(2) : '—'}</td>
                            <td><span className={`ins-badge ins-badge-${(row.verdict || '').toLowerCase()}`}>{row.verdict}</span></td>
                            <td className="ins-td-loaner">
                              {isHorrible && existingAssign ? (
                                <div className="ins-loaner-inline-assigned">
                                  <span>🔑 {existingAssign.loaner_name}</span>
                                  <button className="ins-action-btn ins-action-remove" title="Remove loaner assignment" onClick={() => handleRemoveAssignment(existingAssign.id)}>✕ undo</button>
                                </div>
                              ) : isHorrible && dayLoaners.length > 0 ? (
                                <div className="ins-loaner-inline">
                                  <div className="ins-loaner-select-wrap">
                                    <select
                                      className="ins-loaner-dropdown"
                                      value={pendingLoaner[assignKey] || ''}
                                      onChange={e => setPendingLoaner(prev => ({ ...prev, [assignKey]: e.target.value }))}
                                    >
                                      <option value="">🔑 Assign loaner…</option>
                                      {dayLoaners.map(l => (
                                        <option key={l.loaner_name} value={l.loaner_name}>
                                          {l.loaner_name} · {Number(l.stay_hours).toFixed(1)}h
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {pendingLoaner[assignKey] && (
                                    <button className="ins-action-btn ins-action-save" onClick={() => handleAssignLoaner(row.zs_id, row.parking_date)}>✓</button>
                                  )}
                                </div>
                              ) : isHorrible ? (
                                <span className="ins-no-loaner">No loaner requested this day</span>
                              ) : null}
                            </td>
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
