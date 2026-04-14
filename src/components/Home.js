import React, { useRef } from 'react';
import './Home.css'; // Import your CSS for styling
import ParkingComparison from './ParkingComparison';
import LastCancellations from './LastCancellations'
import MonthlyCancellations from './MonthlyCancellations';

function Home() {
  const parkingRef = useRef();
  const cancellationsRef = useRef();
  const monthlyRef = useRef();

  const handleRefreshAll = () => {
    parkingRef.current?.refresh();
    cancellationsRef.current?.refresh();
    monthlyRef.current?.refresh();
  };

  return (
    <div className="Home">
      <div className="home-header">
        <button className="refresh-all-btn" onClick={handleRefreshAll}>↺ Refresh All</button>
      </div>
      <div className="home-content">
        <ParkingComparison ref={parkingRef} />
        <LastCancellations ref={cancellationsRef} />
        <MonthlyCancellations ref={monthlyRef} />
      </div>
    </div>
  );
}

export default Home;
