import React from 'react';
import './Loader.css';

export default function Loader({ text = 'Loading…' }) {
  return (
    <div className="loader-wrapper">
      <div className="spinner" />
      <p className="loader-text">{text}</p>
    </div>
  );
}
