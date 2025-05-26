import React, { useState, useEffect } from 'react';
import './Home.css'; // Import your CSS for styling
import ParkingComparison from './ParkingComparison';
import LastCancellations from './LastCancellations'

function Home() {

  // The map ref is no longer required in React-Leaflet
  return (
    <div className="Home">
        <ParkingComparison/>
        <LastCancellations/>
    </div>
  );
}

export default Home;
