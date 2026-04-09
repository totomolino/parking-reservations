import './Home.css'; // Import your CSS for styling
import ParkingComparison from './ParkingComparison';
import LastCancellations from './LastCancellations'
import MonthlyCancellations from './MonthlyCancellations';

function Home() {
  return (
    <div className="Home">
        <ParkingComparison/>
        <LastCancellations/>
        <MonthlyCancellations/>
    </div>
  );
}

export default Home;
