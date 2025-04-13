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
  Cell
} from 'recharts';
import { fetchSLABreachData } from '../utils/dataUtils';
import './AvgDeliveryTimeByType.css';

// Fallback data in case everything else fails
const FALLBACK_DATA = [
  { name: 'Z1', avgTime: 41.2, count: 450 },
  { name: 'Z2', avgTime: 38.7, count: 380 },
  { name: 'Z3', avgTime: 45.1, count: 320 },
  { name: 'Z4', avgTime: 39.4, count: 290 },
  { name: 'Z5', avgTime: 43.2, count: 340 }
];

const AvgDeliveryTimeByType = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Colors for different zones
  const getBarColor = (zoneName) => {
    const zoneColors = {
      'Z1': '#8884d8',
      'Z2': '#82ca9d',
      'Z3': '#ffc658',
      'Z4': '#ff8042',
      'Z5': '#0088fe'
    };
    return zoneColors[zoneName] || '#8884d8';
  };

  // Expose the updateWithLiveData method to parent components
  useImperativeHandle(ref, () => ({
    updateWithLiveData: (newData) => {
      if (!newData || newData.length === 0) return;
      
      console.log('AvgDeliveryTimeByType received new data:', newData);
      setIsUpdating(true);
      
      // Process new data
      const processedData = processData(newData);
      
      // Merge with existing data
      const combinedData = [...data];
      
      processedData.forEach(newItem => {
        const existingItemIndex = combinedData.findIndex(item => item.name === newItem.name);
        
        if (existingItemIndex >= 0) {
          // Update existing item with weighted average
          const existingItem = combinedData[existingItemIndex];
          const totalCount = existingItem.count + newItem.count;
          const weightedAvg = (
            (existingItem.avgTime * existingItem.count) + 
            (newItem.avgTime * newItem.count)
          ) / totalCount;
          
          combinedData[existingItemIndex] = {
            ...existingItem,
            avgTime: weightedAvg,
            count: totalCount
          };
        } else {
          // Add new item
          combinedData.push(newItem);
        }
      });
      
      // Sort by average time (descending)
      combinedData.sort((a, b) => b.avgTime - a.avgTime);
      
      setData(combinedData);
      
      // Reset update animation after a short delay
      setTimeout(() => {
        setIsUpdating(false);
      }, 500);
    }
  }));

  // Process data to get averages by zone
  const processData = (rawData) => {
    if (!rawData || rawData.length === 0) return [];
    
    // Organize by zone
    const zoneMap = {};
    
    rawData.forEach(item => {
      // Process zone data
      if (item.zone) {
        if (!zoneMap[item.zone]) {
          zoneMap[item.zone] = { sum: 0, count: 0 };
        }
        
        const deliveryTime = typeof item.avg_delivery_min === 'string' 
          ? parseFloat(item.avg_delivery_min) 
          : item.avg_delivery_min || 0;
          
        const orderCount = typeof item.orders === 'string'
          ? parseInt(item.orders)
          : item.orders || 0;
        
        zoneMap[item.zone].sum += deliveryTime * orderCount;
        zoneMap[item.zone].count += orderCount;
      }
    });
    
    // Format zone data
    const zoneData = Object.keys(zoneMap).map(zone => ({
      name: zone,
      avgTime: zoneMap[zone].count > 0 ? zoneMap[zone].sum / zoneMap[zone].count : 0,
      count: zoneMap[zone].count
    }));
    
    // Sort by average time (descending)
    zoneData.sort((a, b) => b.avgTime - a.avgTime);
    
    return zoneData;
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const responseData = await fetchSLABreachData();
        
        if (!responseData || responseData.length === 0) {
          console.warn('No delivery time data received, using fallback data');
          setData(FALLBACK_DATA);
          setError('Using fallback data for visualization.');
          setLoading(false);
          return;
        }
        
        // Process the data
        const processedData = processData(responseData);
        console.log('Processed delivery time data:', processedData);
        
        if (processedData && processedData.length > 0) {
          setData(processedData);
        } else {
          console.warn('Using fallback data as chart data was empty');
          setError('Using fallback data for visualization.');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching delivery time data:', err);
        setError('Failed to load data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Loading delivery time data...</div>;
  }

  return (
    <div className="avg-delivery-container">
      <h2>Average Delivery Time by Zone</h2>
      
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      
      <div className={`avg-delivery-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              label={{ value: 'Minutes', position: 'insideBottom', offset: -10 }}
              domain={[0, 60]}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={80}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'avgTime') {
                  return [`${value.toFixed(1)} min`, 'Avg Delivery Time'];
                } else if (name === 'count') {
                  return [value, 'Order Count'];
                }
                return [value, name];
              }}
              labelFormatter={(value) => `Zone ${value}`}
            />
            <Bar 
              dataKey="avgTime" 
              name="Avg Delivery Time" 
              animationDuration={500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="delivery-time-insights">
        <p className="insight-text">
          Zone {data[0]?.name} has the longest average delivery time at {data[0]?.avgTime.toFixed(1)} minutes.
        </p>
      </div>
    </div>
  );
});

export default AvgDeliveryTimeByType; 