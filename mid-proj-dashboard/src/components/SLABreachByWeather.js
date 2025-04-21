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
  ReferenceLine
} from 'recharts';
import { fetchCuisineData, aggregateSLABreachByWeather } from '../utils/dataUtils';
import './SLABreachByWeather.css';

// Fallback data in case everything else fails
const FALLBACK_DATA = [
  { name: 'Sunny', breachPct: 28.5, avgTime: 39.3, totalOrders: 5800 },
  { name: 'Clouds', breachPct: 34.2, avgTime: 42.8, totalOrders: 3200 },
  { name: 'Rain', breachPct: 51.7, avgTime: 48.4, totalOrders: 2100 },
  { name: 'Snow', breachPct: 62.3, avgTime: 54.6, totalOrders: 980 },
  { name: 'Wind', breachPct: 42.5, avgTime: 46.2, totalOrders: 1450 }
];

const SLABreachByWeather = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Colors for different weather conditions
  const getBarColor = (weather) => {
    const weatherColors = {
      'Sunny': '#FFD700', // Bright yellow for sun
      'Clouds': '#A9A9A9', // Grey for clouds
      'Rain': '#4682B4', // Steel blue for rain
      'Snow': '#FFFFFF', // White for snow
      'Wind': '#87CEEB',  // Sky blue for wind
      'Windy': '#87CEEB'  // Sky blue for wind
    };
    return weatherColors[weather] || '#8884D8';
  };

  // Weather icons for different conditions
  const getWeatherIcon = (weather) => {
    const icons = {
      'Sunny': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Snow': '❄️',
      'Wind': '💨',
      'Windy': '💨'
    };
    return icons[weather] || '';
  };

  // Custom tick renderer for XAxis
  const renderCustomAxisTick = (props) => {
    const { x, y, payload } = props;
    const weather = payload.value;
    
    // Get icon using the function with both Wind and Windy support
    const icon = getWeatherIcon(weather);
    
    console.log(`Weather: ${weather}, Icon: ${icon}`); // Debug log
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={16} 
          textAnchor="middle" 
          fill="#666"
          fontSize="14px"
          style={{ fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', sans-serif" }}
        >
          {icon} {weather}
        </text>
      </g>
    );
  };

  // Expose the updateWithLiveData method to parent components
  useImperativeHandle(ref, () => ({
    updateWithLiveData: (newData) => {
      if (!newData || newData.length === 0) return;
      
      console.log('SLABreachByWeather received new data:', newData);
      setIsUpdating(true);
      
      // Process new data
      const processedData = aggregateSLABreachByWeather(newData);
      
      // Merge with existing data
      const combinedData = [...data];
      
      processedData.forEach(newItem => {
        const existingItemIndex = combinedData.findIndex(item => item.name === newItem.name);
        
        if (existingItemIndex >= 0) {
          // Update existing item with recalculated metrics
          const existingItem = combinedData[existingItemIndex];
          const totalOrders = existingItem.totalOrders + newItem.totalOrders;
          
          // Calculate new breach percentage based on total numbers
          const existingBreaches = Math.round(existingItem.breachPct * existingItem.totalOrders / 100);
          const newBreaches = Math.round(newItem.breachPct * newItem.totalOrders / 100);
          const totalBreaches = existingBreaches + newBreaches;
          const newBreachPct = (totalBreaches / totalOrders) * 100;
          
          // Calculate new average time
          const newAvgTime = (
            (existingItem.avgTime * existingItem.totalOrders) + 
            (newItem.avgTime * newItem.totalOrders)
          ) / totalOrders;
          
          combinedData[existingItemIndex] = {
            ...existingItem,
            breachPct: Math.round(newBreachPct * 10) / 10,
            avgTime: Math.round(newAvgTime * 10) / 10,
            totalOrders: totalOrders
          };
        } else {
          // Add new item
          combinedData.push(newItem);
        }
      });
      
      // Sort by breach percentage (descending)
      combinedData.sort((a, b) => b.breachPct - a.breachPct);
      
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
        const responseData = await fetchCuisineData();
        
        if (!responseData || responseData.length === 0) {
          console.warn('No weather condition data received, using fallback data');
          setData(FALLBACK_DATA);
          setError('Using fallback data for visualization.');
          setLoading(false);
          return;
        }
        
        // Process the data
        const processedData = aggregateSLABreachByWeather(responseData);
        console.log('Processed weather condition data:', processedData);
        
        if (processedData && processedData.length > 0) {
          setData(processedData);
        } else {
          console.warn('Using fallback data as chart data was empty');
          setError('Using fallback data for visualization.');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching weather condition data:', err);
        setError('Failed to load data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Loading weather condition data...</div>;
  }

  return (
    <div className="weather-container">
      <h2>SLA Breach by Weather Condition</h2>
      
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      
      <div className={`weather-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={renderCustomAxisTick}
              label={{ value: 'Weather Condition', position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: 'SLA Breach %', angle: -90, position: 'insideLeft' }}
              domain={[0, 100]}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              label={{ 
                value: 'Avg Delivery Time (min)', 
                angle: 90, 
                position: 'insideRight',
                offset: 15,
                dy: 80
              }}
              domain={[0, 'dataMax + 5']}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'breachPct') {
                  return [`${value.toFixed(1)}%`, 'SLA Breach %'];
                } else if (name === 'avgTime') {
                  return [`${value.toFixed(1)} min`, 'Avg Delivery Time'];
                } else if (name === 'totalOrders') {
                  return [value.toLocaleString(), 'Total Orders'];
                }
                return [value, name];
              }}
              labelFormatter={(value) => {
                const icon = getWeatherIcon(value);
                return `${icon} ${value}`;
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: 30, marginTop: 20 }}
              payload={[
                { value: 'SLA Breach %', type: 'square', color: '#8884d8' },
                { value: 'Avg Delivery Time', type: 'square', color: '#82ca9d' }
              ]}
              formatter={(value, entry) => {
                if (value === 'Avg Delivery Time') {
                  return <span style={{ fontWeight: 'normal', color: '#82ca9d' }}>{value}</span>;
                }
                return <span style={{ fontWeight: 'bold' }}>{value}</span>;
              }}
            />
            <Bar 
              yAxisId="left"
              dataKey="breachPct" 
              name="SLA Breach %" 
              animationDuration={500}
              fill="#8884d8"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#8884d8" stroke="#6b68b2" strokeWidth={1} />
              ))}
            </Bar>
            <Bar 
              yAxisId="right"
              dataKey="avgTime" 
              name="Avg Delivery Time" 
              animationDuration={500}
              fill="#82ca9d"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="weather-insights">
        <h3>Weather Impact Insights</h3>
        <ul className="insights-list">
          <li>
            <strong>{data[0]?.name}</strong> conditions have the highest SLA breach rate at 
            <strong> {data[0]?.breachPct.toFixed(1)}%</strong>
          </li>
          <li>
            Average delivery time during <strong>{data[0]?.name}</strong> weather: 
            <strong> {data[0]?.avgTime.toFixed(1)} minutes</strong>
          </li>
          {data.find(item => item.name === 'Sunny') && data[0]?.name !== 'Sunny' && (
            <li>
              Weather impact: Delivery is <strong>{(data[0]?.avgTime - data.find(item => item.name === 'Sunny')?.avgTime).toFixed(1)} minutes slower</strong> during <strong>{data[0]?.name}</strong> compared to Sunny conditions
            </li>
          )}
          <li>
            Total of <strong>{data.reduce((sum, item) => sum + item.totalOrders, 0).toLocaleString()}</strong> orders analyzed across all weather conditions
          </li>
          {data.find(item => item.name === 'Rain') && (
            <li>
              Rainy conditions affect delivery times by <strong>{(data.find(item => item.name === 'Rain').avgTime - data.find(item => item.name === 'Sunny')?.avgTime).toFixed(1)} minutes</strong> compared to sunny weather
            </li>
          )}
          {data.find(item => item.name === 'Snow') && (
            <li>
              Snow has the most severe impact, increasing SLA breaches by <strong>{(data.find(item => item.name === 'Snow').breachPct - data.find(item => item.name === 'Sunny')?.breachPct).toFixed(1)}%</strong> compared to sunny weather
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});

export default SLABreachByWeather; 