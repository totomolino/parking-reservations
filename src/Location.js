import React, { useState, useEffect } from 'react';
import L from 'leaflet'; // Leaflet library for displaying the map
import './Location.css'; // Import CSS file for styling

function Location() {
  const [locationSent, setLocationSent] = useState(false);
  const [error, setError] = useState(null);
  const [distanceMessage, setDistanceMessage] = useState("");

  // Target coordinates
  const targetLatitude = -34.546860404019675;
  const targetLongitude = -58.45813954034876;

  // Haversine formula to calculate distance between two coordinates (in km)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  // Function to handle sending location
  const sendLocation = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    if (userId) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords;

          // Calculate distance to the target coordinates
          const distance = calculateDistance(latitude, longitude, targetLatitude, targetLongitude);
          if (distance < 1) { // 1 km radius for proximity
            setDistanceMessage("You are near the target location!");
          } else {
            setDistanceMessage(`You are ${distance.toFixed(2)} km away from the target location.`);
          }

          // Send location data to the API
          fetch(`https://brief-stable-penguin.ngrok-free.app/save_location?user_id=${userId}&latitude=${latitude}&longitude=${longitude}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
          })
          .then(response => response.json())
          .then(data => {
            console.log('Location saved:', data);
            setLocationSent(true); // Update UI once location is sent
          })
          .catch(error => {
            console.error('Error saving location:', error);
            setError('Error saving location. Please try again.');
          });
        });
      } else {
        setError('Geolocation is not supported by this browser.');
      }
    }
  };

  useEffect(() => {
    // Initialize the map after the component has mounted
    const map = L.map('map').setView([targetLatitude, targetLongitude], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add marker for target location
    L.marker([targetLatitude, targetLongitude]).addTo(map).bindPopup('Target Location');

    // Add marker for the user's current location
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      L.marker([latitude, longitude]).addTo(map).bindPopup('Your Location').openPopup();
      map.setView([latitude, longitude], 13); // Center map on user's location
    });

    return () => {
      // Clean up the map when the component unmounts
      map.remove();
    };
  }, []); // Empty dependency array to run only once when the component mounts

  return (
    <div className="App">
      <h1>Location Check-in</h1>

      {!locationSent ? (
        <>
          <button onClick={sendLocation}>Send My Location</button>
          {error && <p className="error">{error}</p>}
          {distanceMessage && <p>{distanceMessage}</p>}
        </>
      ) : (
        <p>Your location has been sent to the system.</p>
      )}

      {/* Display Map */}
      <div id="map" className="map-container"></div> {/* Add the class for styling */}
    </div>
  );
}

export default Location;
