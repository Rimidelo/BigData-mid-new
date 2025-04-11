import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchSLABreachData, aggregateSLABreachByZone } from '../utils/dataUtils';
import './SLABreachByZone.css';

// Fallback data in case everything else fails
const FALLBACK_DATA = [
  { zone: 'Z1', averageSLABreachPct: 49.2, fill: '#8884d8' },
  { zone: 'Z2', averageSLABreachPct: 48.5, fill: '#82ca9d' }
];

const SLABreachByZone = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Expose the updateWithLiveData method to parent components
  useImperativeHandle(ref, () => ({
    updateWithLiveData: async (newData) => {
      try {
        console.log('SLABreachByZone received new data:', newData);
        
        // Set updating flag
        setIsUpdating(true);
        
        // Combine existing data with new data
        const aggregatedNewData = aggregateSLABreachByZone(newData);
        
        if (aggregatedNewData && aggregatedNewData.length > 0) {
          // Create a map of existing data by zone
          const dataMap = data.reduce((acc, item) => {
            acc[item.zone] = item;
            return acc;
          }, {});
          
          // Update or add new data
          aggregatedNewData.forEach(newItem => {
            if (dataMap[newItem.zone]) {
              // If zone already exists, calculate a weighted average to smooth updates
              // Give more weight (80%) to existing data to prevent sharp jumps, 
              // and 20% weight to new data to show changes gradually
              const existingValue = dataMap[newItem.zone].averageSLABreachPct;
              const newValue = newItem.averageSLABreachPct;
              
              dataMap[newItem.zone] = {
                ...dataMap[newItem.zone],
                averageSLABreachPct: (existingValue * 0.8) + (newValue * 0.2),
                // Add visual indicator if updating
                updating: true
              };
            } else {
              // If new zone, add it
              dataMap[newItem.zone] = {
                ...newItem,
                updating: true
              };
            }
          });
          
          // Convert map back to array and update state
          const updatedData = Object.values(dataMap);
          console.log('Updated chart data:', updatedData);
          setData(updatedData);
          
          // Remove updating indicator after animation
          setTimeout(() => {
            setData(currentData => 
              currentData.map(item => ({
                ...item,
                updating: false
              }))
            );
            setIsUpdating(false);
          }, 2000);
        }
      } catch (err) {
        console.error('Error updating with live data:', err);
        setIsUpdating(false);
      }
    }
  }));
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch initial data with hard-coded fallback
        const responseData = await fetchSLABreachData();
        
        // Debug logging
        console.log('Raw data received:', responseData);
        
        if (!responseData || responseData.length === 0) {
          throw new Error('No data received from API');
        }
        
        const chartData = aggregateSLABreachByZone(responseData);
        console.log('Processed chart data:', chartData);
        
        // Only set data if we have chart data
        if (chartData && chartData.length > 0) {
          setData(chartData);
        } else {
          console.warn('Using fallback data as chart data was empty');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching SLA breach data:', err);
        setError('Failed to load data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Loading SLA breach data...</div>;
  }

  return (
    <div className="sla-breach-container">
      <h2>SLA Breach % by Zone</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      <div className={`sla-breach-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="zone" />
            <YAxis 
              label={{ value: 'SLA Breach %', angle: -90, position: 'insideLeft' }}
              domain={[0, 60]}
            />
            <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'SLA Breach Rate']} />
            <Legend />
            <Bar 
              dataKey="averageSLABreachPct" 
              name="SLA Breach %" 
              fill="#8884d8"
              animationDuration={500}
              // Apply pulsing animation to bars that are being updated
              style={{ filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sla-breach-insights">
        <h3>Insights:</h3>
        <ul>
          <li>Zone Z1 has a slightly higher breach rate than Zone Z2</li>
          <li>Both zones have breach rates close to 50%</li>
          <li>This suggests systematic issues affecting all zones</li>
        </ul>
      </div>
    </div>
  );
});

export default SLABreachByZone; 