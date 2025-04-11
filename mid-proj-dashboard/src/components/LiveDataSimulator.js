import React, { useState } from 'react';
import { fetchLiveUpdate } from '../utils/dataUtils';
import './LiveDataSimulator.css';

const LiveDataSimulator = ({ onDataUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const simulateLiveData = async () => {
    try {
      setLoading(true);
      setError(null);
      const newData = await fetchLiveUpdate();
      onDataUpdate(newData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching live data update:', error);
      setError('Failed to fetch latest data');
      setLoading(false);
    }
  };

  return (
    <div className="live-data-simulator">
      <h3>Live Data Simulator</h3>
      <p>Click the button to simulate new data arriving to the dashboard</p>
      <button 
        className="simulate-button"
        onClick={simulateLiveData}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Simulate New Data'}
      </button>
      {error && <div className="simulator-error">{error}</div>}
    </div>
  );
};

export default LiveDataSimulator; 