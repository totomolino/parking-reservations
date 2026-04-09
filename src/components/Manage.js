import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import Loader from './Loader';
import AssignModal from './AssignModal';
import SwapModal from './SwapModal';
import './Manage.css';

const GROUPS = [
  { label: '4º SUB', numbers: [60, 814, 815, 816, 817, 839, 840, 841, 832, 834, 835, 836, 837, 838] },
  { label: '3º SUB', numbers: [616, 585, 586, 587, 588, 589, 590, 591, 592, 593, 594, 596, 597, 598, 569, 570, 571, 572, 573, 574, 575, 576, 579, 580, 581, 582] },
];

export default function Manage() {
  const [slots, setSlots]               = useState([]);
  const [waitingList, setWaitingList]   = useState([]);
  const [parkingDate, setParkingDate]   = useState('');
  const [loading, setLoading]           = useState(true);
  const [assignTarget, setAssignTarget] = useState(null);
  const [showSwap, setShowSwap]         = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(null);
  const [wlLoading, setWlLoading]       = useState(null);
  const [notify, setNotify]             = useState(true);

  // ── Permanent slots state ──────────────────────────────
  const [permanents, setPermanents]         = useState([]);
  const [permLoading, setPermLoading]       = useState(true);
  const [permQuery, setPermQuery]           = useState('');
  const [permRoster, setPermRoster]         = useState([]);
  const [permFiltered, setPermFiltered]     = useState([]);
  const [permSelected, setPermSelected]     = useState(null);
  const [permSlotInput, setPermSlotInput]   = useState('');
  const [permSaving, setPermSaving]         = useState(false);
  const [permRemoveLoading, setPermRemoveLoading] = useState(null);
  const permInputRef = useRef(null);

  // ── Fetch live slot state ──────────────────────────────
  const fetchLive = useCallback(() => {
    api.get('/admin/live-slots')
      .then(r => {
        setSlots(r.data.slots);
        setWaitingList(r.data.waitingList);
        setParkingDate(r.data.parkingDate);
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  // ── Fetch permanent assignments ────────────────────────
  const fetchPermanents = useCallback(() => {
    setPermLoading(true);
    api.get('/admin/permanent-slots')
      .then(r => { setPermanents(r.data); setPermLoading(false); })
      .catch(err => { console.error(err); setPermLoading(false); });
  }, []);

  useEffect(() => {
    fetchLive();
    fetchPermanents();
    api.get('/roster').then(r => setPermRoster(r.data)).catch(console.error);
  }, [fetchLive, fetchPermanents]);

  // Filter roster as user types in permanent-assign search
  useEffect(() => {
    if (!permQuery.trim()) { setPermFiltered([]); return; }
    const q = permQuery.toLowerCase();
    setPermFiltered(permRoster.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6));
  }, [permQuery, permRoster]);

  // ── Release a slot ─────────────────────────────────────
  const handleRelease = async (slot) => {
    if (!window.confirm(`Release slot ${slot.number} from ${slot.assignedTo}?`)) return;
    setReleaseLoading(slot.number);
    try {
      await api.post('/admin/release', { slotNumber: slot.number, notify });
      fetchLive();
    } catch (err) {
      alert(err.response?.data?.message || 'Release failed');
    } finally {
      setReleaseLoading(null);
    }
  };

  // ── Remove from waiting list ───────────────────────────
  const handleWlRemove = async (person) => {
    if (!window.confirm(`Remove ${person.name} from the waiting list?`)) return;
    setWlLoading(person.phone);
    try {
      await api.post('/admin/wl-remove', { phone: person.phone });
      fetchLive();
    } catch (err) {
      alert(err.response?.data?.message || 'Remove failed');
    } finally {
      setWlLoading(null);
    }
  };

  // ── Add permanent assignment ───────────────────────────
  const handlePermAdd = async () => {
    if (!permSelected || !permSlotInput) return;
    setPermSaving(true);
    try {
      await api.post('/admin/permanent-slots', {
        slotNumber: Number(permSlotInput),
        userId: permSelected.id,
      });
      setPermQuery('');
      setPermSelected(null);
      setPermSlotInput('');
      setPermFiltered([]);
      fetchPermanents();
      fetchLive();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save permanent assignment');
    } finally {
      setPermSaving(false);
    }
  };

  // ── Remove permanent assignment ────────────────────────
  const handlePermRemove = async (slotNumber) => {
    if (!window.confirm(`Remove permanent assignment for slot ${slotNumber}?\nThe slot stays assigned today but will be released on next daily reset.`)) return;
    setPermRemoveLoading(slotNumber);
    try {
      await api.delete(`/admin/permanent-slots/${slotNumber}`);
      fetchPermanents();
    } catch (err) {
      alert(err.response?.data?.message || 'Remove failed');
    } finally {
      setPermRemoveLoading(null);
    }
  };

  if (loading) return <Loader text="Loading live slot data…" />;

  const slotMap = Object.fromEntries(slots.map(s => [s.number, s]));

  return (
    <div className="manage-page">

      {/* ── Toolbar ──────────────────────────────────── */}
      <div className="manage-toolbar">
        <div className="manage-toolbar-left">
          <h1 className="page-title" style={{ margin: 0 }}>Slot Manager</h1>
          <span className="manage-date">{parkingDate}</span>
        </div>
        <div className="manage-toolbar-right">
          <label className="notify-toggle">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
            Notify via WhatsApp
          </label>
          <button className="btn-secondary" onClick={() => setShowSwap(true)}>⇄ Swap Slots</button>
          <button className="btn-refresh" onClick={fetchLive}>↺ Refresh</button>
        </div>
      </div>

      {/* ── Permanent Assignments ─────────────────────── */}
      <div className="manage-group">
        <h2 className="manage-group-title">
          Permanent Assignments
          <span className="wl-count">{permanents.length}</span>
        </h2>

        {/* Add form */}
        <div className="perm-add-form">
          <div className="perm-search-wrap">
            <input
              ref={permInputRef}
              className="perm-input"
              placeholder="Search person…"
              value={permQuery}
              onChange={e => { setPermQuery(e.target.value); setPermSelected(null); }}
            />
            {permFiltered.length > 0 && (
              <ul className="modal-suggestions perm-suggestions">
                {permFiltered.map(u => (
                  <li
                    key={u.id}
                    className={`modal-suggestion-item ${permSelected?.id === u.id ? 'selected' : ''}`}
                    onClick={() => { setPermSelected(u); setPermQuery(u.name); setPermFiltered([]); }}
                  >
                    <span className="sug-name">{u.name}</span>
                    <span className="sug-meta">P{u.priority}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            className="perm-input perm-slot-input"
            type="number"
            placeholder="Slot #"
            value={permSlotInput}
            onChange={e => setPermSlotInput(e.target.value)}
          />
          <button
            className="btn-refresh"
            onClick={handlePermAdd}
            disabled={!permSelected || !permSlotInput || permSaving}
          >
            {permSaving ? 'Saving…' : '+ Add'}
          </button>
        </div>

        {/* Current list */}
        {permLoading
          ? <Loader text="Loading…" />
          : permanents.length === 0
            ? <p className="wl-empty">No permanent assignments yet.</p>
            : (
              <div className="perm-list">
                {permanents.map(p => (
                  <div key={p.slot_number} className="perm-item">
                    <span className="perm-slot">Slot {p.slot_number}</span>
                    <span className="perm-name">{p.name}</span>
                    <span className="perm-phone">{p.phone}</span>
                    <button
                      className="slot-btn slot-btn--release"
                      style={{ flex: 'none', padding: '0.28rem 0.75rem' }}
                      onClick={() => handlePermRemove(p.slot_number)}
                      disabled={permRemoveLoading === p.slot_number}
                    >
                      {permRemoveLoading === p.slot_number ? '…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )
        }
      </div>

      {/* ── Slot groups ──────────────────────────────── */}
      {GROUPS.map(group => (
        <div key={group.label} className="manage-group">
          <h2 className="manage-group-title">{group.label}</h2>
          <div className="slots-grid">
            {group.numbers.map(num => {
              const slot = slotMap[num];
              if (!slot) return null;
              const isPermanent = permanents.some(p => p.slot_number === num);
              return (
                <div key={num} className={`slot-card slot-card--${slot.status}${isPermanent ? ' slot-card--permanent' : ''}`}>
                  <div className="slot-card-header">
                    <span className="slot-card-number">
                      #{slot.number}
                      {isPermanent && <span className="perm-pin" title="Permanent assignment">📌</span>}
                    </span>
                    <span className={`slot-card-badge badge-${slot.status}`}>
                      {slot.status}
                    </span>
                  </div>

                  <div className="slot-card-name">
                    {slot.assignedTo
                      ? slot.assignedTo.replace(' (Pending)', '')
                      : <span className="slot-card-empty">Available</span>
                    }
                  </div>

                  {slot.timeoutDate && (
                    <div className="slot-card-timeout">
                      ⏱ expires {new Date(slot.timeoutDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                  )}

                  <div className="slot-card-actions">
                    <button
                      className="slot-btn slot-btn--assign"
                      onClick={() => setAssignTarget(slot)}
                    >
                      {slot.status === 'available' ? 'Assign' : 'Reassign'}
                    </button>
                    {slot.status !== 'available' && (
                      <button
                        className="slot-btn slot-btn--release"
                        onClick={() => handleRelease(slot)}
                        disabled={releaseLoading === slot.number}
                      >
                        {releaseLoading === slot.number ? '…' : 'Release'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Waiting List ─────────────────────────────── */}
      <div className="manage-wl">
        <h2 className="manage-group-title">
          Waiting List
          <span className="wl-count">{waitingList.length}</span>
        </h2>
        {waitingList.length === 0
          ? <p className="wl-empty">No one on the waiting list.</p>
          : (
            <div className="wl-list">
              {waitingList.map((person, i) => (
                <div key={person.phone} className="wl-item">
                  <span className="wl-pos">{i + 1}</span>
                  <span className="wl-name">{person.name}</span>
                  <span className="wl-phone">{person.phone.replace('whatsapp:', '')}</span>
                  <button
                    className="slot-btn slot-btn--release"
                    onClick={() => handleWlRemove(person)}
                    disabled={wlLoading === person.phone}
                  >
                    {wlLoading === person.phone ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* ── Modals ───────────────────────────────────── */}
      {assignTarget && (
        <AssignModal
          slot={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={fetchLive}
        />
      )}

      {showSwap && (
        <SwapModal
          slots={slots}
          onClose={() => setShowSwap(false)}
          onSwapped={fetchLive}
        />
      )}
    </div>
  );
}
