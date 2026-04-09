import React, { useState, useEffect, useCallback } from 'react';
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
  const [slots, setSlots]           = useState([]);
  const [waitingList, setWaitingList] = useState([]);
  const [parkingDate, setParkingDate] = useState('');
  const [loading, setLoading]       = useState(true);
  const [assignTarget, setAssignTarget] = useState(null); // slot to assign
  const [showSwap, setShowSwap]     = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(null); // slot number being released
  const [wlLoading, setWlLoading]   = useState(null); // phone being removed from WL
  const [notify, setNotify]         = useState(true);

  const fetchLive = useCallback(() => {
    api.get('/admin/live-slots')
      .then(r => {
        setSlots(r.data.slots);
        setWaitingList(r.data.waitingList);
        setParkingDate(r.data.parkingDate);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  // ── Release a slot ───────────────────────────────────
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

  // ── Remove from waiting list ─────────────────────────
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

      {/* ── Slot groups ──────────────────────────────── */}
      {GROUPS.map(group => (
        <div key={group.label} className="manage-group">
          <h2 className="manage-group-title">{group.label}</h2>
          <div className="slots-grid">
            {group.numbers.map(num => {
              const slot = slotMap[num];
              if (!slot) return null;
              return (
                <div key={num} className={`slot-card slot-card--${slot.status}`}>
                  <div className="slot-card-header">
                    <span className="slot-card-number">#{slot.number}</span>
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
