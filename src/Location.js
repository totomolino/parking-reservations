import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'; // React-Leaflet components
import L from 'leaflet'; // Leaflet library for the marker
import { useMap } from 'react-leaflet';
import './Location.css'; // Import your CSS for styling

function Location() {
  const [locationSent, setLocationSent] = useState(false); // Track if location has been sent
  const [error, setError] = useState(null); // Track any errors
  const [distanceMessage, setDistanceMessage] = useState(""); // Track distance message

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

  // The map ref is no longer required in React-Leaflet
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

      {/* React-Leaflet Map */}
      <MapContainer
        center={[targetLatitude, targetLongitude]} // Set the map center
        zoom={13} // Set the zoom level
        style={{ height: '500px', width: '80%', margin: '0 auto' }} // Style the map
        className="map-container"
      >
        {/* Tile Layer from OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Marker for the target location */}
        <Marker position={[targetLatitude, targetLongitude]}>
          <Popup>Target Location</Popup>
        </Marker>

        {/* Marker for the user's location */}
        <UserLocationMarker />
      </MapContainer>
    </div>
  );
}

// Custom component to add the user's current location as a marker
const UserLocationMarker = () => {
  const map = useMap(); // Get map reference from React-Leaflet

  useEffect(() => {
    // Get the user's current location
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;

      // Add a marker for the user's location
      L.marker([latitude, longitude]).addTo(map).bindPopup('Your Location').openPopup();
      map.setView([latitude, longitude], 13); // Center the map on the user's location
    });
  }, [map]);

  return null;
};

export default Location;
