import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { fetchSLABreachData, aggregateDriverZonePerformance } from '../utils/dataUtils';
import './DriverZonePerformance.css';

// Fallback data in case everything else fails
const FALLBACK_DATA = [
  { name: 'Z1', totalOrders: 2450, avgTime: 43.5, avgDelay: 2.1, breachPct: 28.4 },
  { name: 'Z2', totalOrders: 2150, avgTime: 42.1, avgDelay: 1.8, breachPct: 25.3 },
  { name: 'Z3', totalOrders: 1880, avgTime: 46.2, avgDelay: 3.5, breachPct: 42.9 },
  { name: 'Z4', totalOrders: 1650, avgTime: 45.7, avgDelay: 3.2, breachPct: 38.6 },
  { name: 'Z5', totalOrders: 1920, avgTime: 44.8, avgDelay: 2.7, breachPct: 35.1 }
];

const DriverZonePerformance = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Colors for different zones
  const getBarColor = (zone) => {
    const zoneColors = {
      'Z1': '#8884d8', // Purple
      'Z2': '#82ca9d', // Green
      'Z3': '#ffc658', // Yellow
      'Z4': '#ff8042', // Orange
      'Z5': '#0088fe'  // Blue
    };
    return zoneColors[zone] || '#8884d8';
  };

  // Get color based on delay time to indicate performance
  const getDelayColor = (delay) => {
    if (delay <= 1) return '#4caf50'; // Good - Green
    if (delay <= 3) return '#ff9800'; // Warning - Orange
    return '#f44336'; // Poor - Red
  };

  // Expose the updateWithLiveData method to parent components
  useImperativeHandle(ref, () => ({
    updateWithLiveData: (newData) => {
      if (!newData || newData.length === 0) return;
      
      console.log('DriverZonePerformance received new data:', newData);
      setIsUpdating(true);
      
      // Process new data
      const processedData = aggregateDriverZonePerformance(newData);
      
      // Merge with existing data
      const combinedData = [...data];
      
      processedData.forEach(newItem => {
        const existingItemIndex = combinedData.findIndex(item => item.name === newItem.name);
        
        if (existingItemIndex >= 0) {
          // Update existing item with recalculated metrics
          const existingItem = combinedData[existingItemIndex];
          const totalOrders = existingItem.totalOrders + newItem.totalOrders;
          
          // Calculate new average time based on total orders
          const newAvgTime = (
            (existingItem.avgTime * existingItem.totalOrders) + 
            (newItem.avgTime * newItem.totalOrders)
          ) / totalOrders;
          
          // Calculate new breach percentage based on total numbers
          const existingBreaches = Math.round(existingItem.breachPct * existingItem.totalOrders / 100);
          const newBreaches = Math.round(newItem.breachPct * newItem.totalOrders / 100);
          const totalBreaches = existingBreaches + newBreaches;
          const newBreachPct = (totalBreaches / totalOrders) * 100;
          
          // Calculate new average delay (weighted by order count)
          const newAvgDelay = (
            (existingItem.avgDelay * existingItem.totalOrders) +
            (newItem.avgDelay * newItem.totalOrders)
          ) / totalOrders;
          
          combinedData[existingItemIndex] = {
            ...existingItem,
            totalOrders: totalOrders,
            avgTime: Math.round(newAvgTime * 10) / 10,
            avgDelay: Math.round(newAvgDelay * 10) / 10,
            breachPct: Math.round(newBreachPct * 10) / 10
          };
        } else {
          // Add new item
          combinedData.push(newItem);
        }
      });
      
      // Sort by total orders (descending)
      combinedData.sort((a, b) => b.totalOrders - a.totalOrders);
      
      setData(combinedData);
      
      // Reset update animation after a short delay
      setTimeout(() => {
        setIsUpdating(false);
      }, 500);
    }
  }));

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const responseData = await fetchSLABreachData();
        
        if (!responseData || responseData.length === 0) {
          console.warn('No zone performance data received, using fallback data');
          setData(FALLBACK_DATA);
          setError('Using fallback data for visualization.');
          setLoading(false);
          return;
        }
        
        // Process the data
        const processedData = aggregateDriverZonePerformance(responseData);
        console.log('Processed driver zone performance data:', processedData);
        
        if (processedData && processedData.length > 0) {
          setData(processedData);
        } else {
          console.warn('Using fallback data as chart data was empty');
          setError('Using fallback data for visualization.');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching driver zone performance data:', err);
        setError('Failed to load data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Loading driver zone performance data...</div>;
  }

  // Calculate some metrics for insights
  const totalDeliveries = data.reduce((sum, zone) => sum + zone.totalOrders, 0);
  const highestWorkloadZone = data.reduce((prev, current) => 
    (current.totalOrders > prev.totalOrders) ? current : prev, data[0]);
  const worstPerformingZone = data.reduce((prev, current) => 
    (current.avgDelay > prev.avgDelay) ? current : prev, data[0]);
  const zoneWorkloadSpread = highestWorkloadZone.totalOrders / (totalDeliveries / data.length);

  return (
    <div className="zone-performance-container">
      <h2>Driver Zone Performance</h2>
      
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      
      <div className={`zone-performance-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              label={{ value: 'Delivery Zone', position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: 'Total Orders', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              label={{ value: 'Avg Delay (min)', angle: 90, position: 'insideRight' }}
              domain={[0, 'dataMax + 1']}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'totalOrders') {
                  return [value.toLocaleString(), 'Total Orders'];
                } else if (name === 'avgDelay') {
                  return [`${value.toFixed(1)} min`, 'Avg Delay Beyond SLA'];
                } else if (name === 'avgTime') {
                  return [`${value.toFixed(1)} min`, 'Avg Delivery Time'];
                } else if (name === 'breachPct') {
                  return [`${value.toFixed(1)}%`, 'SLA Breach %'];
                }
                return [value, name];
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="totalOrders" 
              name="Total Orders" 
              animationDuration={500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
              ))}
              <LabelList dataKey="totalOrders" position="top" fill="#333" fontSize={12} />
            </Bar>
            <Bar 
              yAxisId="right"
              dataKey="avgDelay" 
              name="Avg Delay Beyond SLA" 
              animationDuration={500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-delay-${index}`} fill={getDelayColor(entry.avgDelay)} />
              ))}
              <LabelList dataKey="avgDelay" position="top" fill="#333" fontSize={12} formatter={(value) => `${value} min`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="zone-performance-insights">
        <h3>Driver Performance Insights</h3>
        <ul className="insights-list">
          <li>
            <strong>{highestWorkloadZone.name}</strong> has the highest workload with 
            <strong> {highestWorkloadZone.totalOrders.toLocaleString()}</strong> orders 
            ({zoneWorkloadSpread.toFixed(1)}x average zone)
          </li>
          <li>
            <strong>{worstPerformingZone.name}</strong> has the longest average delay at 
            <strong> {worstPerformingZone.avgDelay.toFixed(1)} minutes</strong> past the SLA threshold
          </li>
          {highestWorkloadZone.name === worstPerformingZone.name ? (
            <li>
              <strong>Resource bottleneck detected:</strong> Zone {highestWorkloadZone.name} has both highest workload and worst performance
            </li>
          ) : (
            <li>
              Performance issues in <strong>{worstPerformingZone.name}</strong> may not be related to order volume
            </li>
          )}
          <li>
            Total of <strong>{totalDeliveries.toLocaleString()}</strong> deliveries analyzed across all zones
          </li>
        </ul>
      </div>
    </div>
  );
});

export default DriverZonePerformance; 