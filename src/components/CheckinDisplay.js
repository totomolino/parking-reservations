import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import './CheckinDisplay.css';

// Bot's Twilio WhatsApp number (raw, no + / whatsapp: prefix) — same as app.js twilioNumber
const BOT_NUMBER = '12023351857';
const WINDOW_SECONDS = 10;

// ── Phase 1: FAKE rotating token (front-only). ─────────────────────────────
// No HMAC on the client — the real signed token will come from the backend
// (GET /checkin-token/:floorId) in phase 2. This just proves rotation + the
// wa.me hand-off end-to-end. The bot will reply "Unknown command" for now.
function makeFakeToken(floorId, windowIndex) {
  // Deterministic-per-window pseudo string so it visibly changes every 10s.
  const rnd = Math.abs(Math.sin(windowIndex * 9301 + Number(floorId) * 49297)) // varies per window+floor
    .toString(36)
    .slice(2, 8)
    .toUpperCase();
  return `F${floorId}-${windowIndex}-${rnd}`;
}

export default function CheckinDisplay() {
  const { floorId } = useParams();
  const [windowIndex, setWindowIndex] = useState(() => Math.floor(Date.now() / (WINDOW_SECONDS * 1000)));
  const [secondsLeft, setSecondsLeft] = useState(WINDOW_SECONDS);

  useEffect(() => {
    // Tick every second: update countdown, and roll the window when it flips.
    const id = setInterval(() => {
      const now = Date.now();
      const wIdx = Math.floor(now / (WINDOW_SECONDS * 1000));
      const left = WINDOW_SECONDS - Math.floor((now % (WINDOW_SECONDS * 1000)) / 1000);
      setWindowIndex(wIdx);
      setSecondsLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const token = makeFakeToken(floorId, windowIndex);
  const waLink = `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(`checkin ${token}`)}`;

  return (
    <div className="cd-page">
      <img src="/zs_logo.png" alt="ZS" className="cd-logo" />
      <h1 className="cd-title">Check-in de Estacionamiento</h1>
      <p className="cd-floor">Piso {floorId}</p>

      <div className="cd-qr-wrap">
        <QRCodeSVG value={waLink} size={340} level="M" includeMargin />
      </div>

      <p className="cd-instructions">
        Escaneá el código con tu celular y enviá el mensaje para confirmar tu lugar.
      </p>

      <div className="cd-timer">
        <div className="cd-timer-bar">
          <div
            className="cd-timer-fill"
            style={{ width: `${(secondsLeft / WINDOW_SECONDS) * 100}%` }}
          />
        </div>
        <span className="cd-timer-text">El código se renueva en {secondsLeft}s</span>
      </div>
    </div>
  );
}
