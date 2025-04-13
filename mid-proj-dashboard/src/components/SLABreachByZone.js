import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { fetchSLABreachData, aggregateSLABreachByZone } from '../utils/dataUtils';
import './SLABreachByZone.css';

// Fallback data in case everything else fails
const FALLBACK_DATA = [
  { zone: 'Z1', averageSLABreachPct: 49.2, fill: '#8884d8' },
  { zone: 'Z2', averageSLABreachPct: 48.5, fill: '#82ca9d' },
  { zone: 'Z3', averageSLABreachPct: 46.8, fill: '#ffc658' },
  { zone: 'Z4', averageSLABreachPct: 44.3, fill: '#ff8042' },
  { zone: 'Z5', averageSLABreachPct: 47.9, fill: '#0088fe' }
];

const SLABreachByZone = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
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
  
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Loading initial SLA breach data...');
        const responseData = await fetchSLABreachData();
        
        // Debug logging
        console.log('Data fetched:', responseData);
        
        if (!responseData || responseData.length === 0) {
          console.warn('No data received, using fallback data');
          setData(FALLBACK_DATA);
          setError('Using fallback data for visualization.');
          setLoading(false);
          return;
        }
        
        const chartData = aggregateSLABreachByZone(responseData);
        console.log('Processed chart data:', chartData);
        
        // Only set data if we have chart data
        if (chartData && chartData.length > 0) {
          setData(chartData);
          setInitialDataLoaded(true);
          if (props.onInitialDataLoaded) {
            props.onInitialDataLoaded();
          }
        } else {
          console.warn('Using fallback data as chart data was empty');
          setError('Using fallback data for visualization.');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching SLA breach data:', err);
        setError('Failed to load data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, [props.onInitialDataLoaded]);

  // Update with live data when available
  useEffect(() => {
    if (props.liveData && props.liveData.length > 0 && initialDataLoaded) {
      console.log('Received live data for SLA chart:', props.liveData);
      
      // Visual feedback for updates
      setIsUpdating(true);
      
      // Get current data and merge with new live data
      const allData = [...props.liveData];
      const aggregatedData = aggregateSLABreachByZone(allData);
      
      console.log('Updated aggregated data:', aggregatedData);
      setData(aggregatedData);
      
      // Reset update animation after a short delay
      setTimeout(() => {
        setIsUpdating(false);
      }, 500);
    }
  }, [props.liveData, initialDataLoaded]);

  // Get color based on delivery time
  const getDeliveryTimeColor = (time) => {
    if (time <= 35) return '#4caf50'; // Good - Green
    if (time <= 45) return '#ff9800'; // Warning - Orange
    return '#e74c3c'; // Bad - Red
  };

  // Get color for zone labels
  const getZoneColor = (zone) => {
    const zoneColors = {
      'Z1': '#8884d8', // Purple
      'Z2': '#82ca9d', // Green
      'Z3': '#ffc658', // Yellow
      'Z4': '#ff8042', // Orange
      'Z5': '#0088fe'  // Blue
    };
    return zoneColors[zone] || '#333';
  };

  // Custom tick renderer for XAxis
  const renderCustomAxisTick = (props) => {
    const { x, y, payload } = props;
    const zone = payload.value;
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={16} 
          textAnchor="middle" 
          fill={getZoneColor(zone)}
          fontWeight="bold"
          fontSize="14px"
        >
          {zone}
        </text>
      </g>
    );
  };

  // Custom legend formatter
  const renderColorfulLegendText = (value, entry) => {
    const { color } = entry;
    const style = {
      fontSize: '14px',
      marginLeft: '5px'
    };
    
    if (value === 'Avg Delivery Time') {
      return <span style={{ ...style, color: '#e74c3c', fontWeight: 'normal' }}>{value}</span>;
    }
    
    return <span style={style}>{value}</span>;
  };

  if (loading) {
    return <div className="loading">Loading SLA breach data...</div>;
  }

  return (
    <div className="sla-breach-container">
      <h2>Delivery Performance by Zone</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      <div className={`sla-breach-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 30,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="zone" 
              tick={renderCustomAxisTick}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: 'SLA Breach %', angle: -90, position: 'insideLeft' }}
              domain={[0, 60]}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              label={{ value: 'Minutes', angle: 90, position: 'insideRight' }}
              domain={[0, 60]} 
            />
            <Tooltip 
              formatter={(value, name, props) => {
                if (name === 'SLA Breach %') {
                  return [`${value.toFixed(2)}%`, 'SLA Breach Rate'];
                } else if (name === 'Avg Delivery Time') {
                  return [`${value.toFixed(1)} min`, 'Avg Delivery Time'];
                } else if (name === 'Orders') {
                  return [value, 'Total Orders'];
                }
                return [value, name];
              }}
              labelFormatter={(value) => `Zone ${value}`}
            />
            <Legend 
              formatter={renderColorfulLegendText}
              iconType="square"
              wrapperStyle={{ paddingTop: 10 }}
              payload={[
                { value: 'SLA Breach %', type: 'square', color: '#8884d8' },
                { value: 'Avg Delivery Time', type: 'square', color: '#e74c3c' }
              ]}
            />
            <Bar 
              dataKey="averageSLABreachPct" 
              name="SLA Breach %" 
              yAxisId="left"
              fill="#8884d8"
              animationDuration={500}
              style={{ filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))' }}
            >
              {data.map((entry, index) => (
                <Cell key={`breach-cell-${index}`} fill="#8884d8" />
              ))}
            </Bar>
            <Bar 
              dataKey="averageDeliveryTime" 
              name="Avg Delivery Time" 
              key="avg-delivery-time-bar"
              yAxisId="right"
              animationDuration={500}
            >
              {data.map((entry, index) => (
                <Cell key={`delivery-cell-${index}`} fill="#ff0000" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default SLABreachByZone; 