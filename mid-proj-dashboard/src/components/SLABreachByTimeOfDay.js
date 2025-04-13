import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { fetchCuisineData, aggregateSLABreachByTimeOfDay } from '../utils/dataUtils';
import './SLABreachByTimeOfDay.css';

// Fallback data in case everything else fails
const FALLBACK_DATA = [
  { name: 'Morning', breachPct: 32.5, avgTime: 42.1, totalOrders: 2800, min: 38, q1: 40, median: 42, q3: 45, max: 52 },
  { name: 'Afternoon', breachPct: 27.8, avgTime: 40.3, totalOrders: 3500, min: 35, q1: 38, median: 40, q3: 43, max: 50 },
  { name: 'Evening', breachPct: 41.2, avgTime: 44.9, totalOrders: 4200, min: 39, q1: 42, median: 45, q3: 48, max: 55 },
  { name: 'Night', breachPct: 37.6, avgTime: 43.2, totalOrders: 3100, min: 36, q1: 40, median: 43, q3: 47, max: 53 }
];

const SLABreachByTimeOfDay = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Colors for different time periods
  const getBarColor = (timePeriod) => {
    const timeColors = {
      'Morning': '#FFD700',  // Gold
      'Afternoon': '#FF8C00', // Dark Orange
      'Evening': '#6A5ACD',  // Slate Blue
      'Night': '#483D8B'     // Dark Slate Blue
    };
    return timeColors[timePeriod] || '#8884D8';
  };

  // Expose the updateWithLiveData method to parent components
  useImperativeHandle(ref, () => ({
    updateWithLiveData: (newData) => {
      if (!newData || newData.length === 0) return;
      
      console.log('SLABreachByTimeOfDay received new data:', newData);
      setIsUpdating(true);
      
      // Process new data
      const processedData = aggregateSLABreachByTimeOfDay(newData);
      
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
          
          // Combine boxplot data (simplified approach - real boxplot would need all data points)
          const combinedMin = Math.min(existingItem.min, newItem.min);
          const combinedMax = Math.max(existingItem.max, newItem.max);
          // Simple weighted average for quartiles
          const combinedQ1 = (existingItem.q1 * existingItem.totalOrders + newItem.q1 * newItem.totalOrders) / totalOrders;
          const combinedMedian = (existingItem.median * existingItem.totalOrders + newItem.median * newItem.totalOrders) / totalOrders;
          const combinedQ3 = (existingItem.q3 * existingItem.totalOrders + newItem.q3 * newItem.totalOrders) / totalOrders;
          
          combinedData[existingItemIndex] = {
            ...existingItem,
            breachPct: Math.round(newBreachPct * 10) / 10,
            avgTime: Math.round(newAvgTime * 10) / 10,
            totalOrders: totalOrders,
            min: combinedMin,
            q1: Math.round(combinedQ1 * 10) / 10,
            median: Math.round(combinedMedian * 10) / 10,
            q3: Math.round(combinedQ3 * 10) / 10,
            max: combinedMax
          };
        } else {
          // Add new item
          combinedData.push(newItem);
        }
      });
      
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
          console.warn('No time period data received, using fallback data');
          setData(FALLBACK_DATA);
          setError('Using fallback data for visualization.');
          setLoading(false);
          return;
        }
        
        // Process the data
        const processedData = aggregateSLABreachByTimeOfDay(responseData);
        console.log('Processed time of day data:', processedData);
        
        if (processedData && processedData.length > 0) {
          setData(processedData);
        } else {
          console.warn('Using fallback data as chart data was empty');
          setError('Using fallback data for visualization.');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching time period data:', err);
        setError('Failed to load data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Loading time of day data...</div>;
  }

  return (
    <div className="time-container">
      <h2>SLA Breach by Time of Day</h2>
      
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      
      <div className={`time-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              label={{ value: 'Time of Day', position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              yAxisId="left"
              label={{ 
                value: 'SLA Breach %', 
                angle: -90, 
                position: 'insideLeft',
                offset: 0,
                dy: 80 // Move the SLA Breach % label down
              }}
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
                dy: 80 // Move label down
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
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="custom-tooltip">
                      <p className="time-period">{data.name}</p>
                      <p>SLA Breach: <strong>{data.breachPct.toFixed(1)}%</strong></p>
                      <p>Avg Delivery: <strong>{data.avgTime.toFixed(1)} min</strong></p>
                      <p>Orders: <strong>{data.totalOrders.toLocaleString()}</strong></p>
                      <p className="boxplot-data">
                        Min: {data.min.toFixed(1)} | Q1: {data.q1.toFixed(1)} | 
                        Med: {data.median.toFixed(1)} | Q3: {data.q3.toFixed(1)} | 
                        Max: {data.max.toFixed(1)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              payload={[
                { value: 'SLA Breach %', type: 'square', color: '#8884d8' },
                { value: 'Avg Delivery Time', type: 'line', color: '#ff7300', strokeWidth: 3 }
              ]}
              formatter={(value, entry) => {
                if (value === 'Avg Delivery Time') {
                  return <span style={{ fontWeight: 'normal', color: '#ff7300' }}>{value}</span>;
                }
                return <span style={{ fontWeight: 'bold' }}>{value}</span>;
              }}
              iconSize={20}
              wrapperStyle={{ paddingTop: 15 }}
            />
            <ReferenceLine 
              yAxisId="right" 
              y={45} 
              stroke="red" 
              strokeDasharray="3 3" 
              label={{
                value: "Threshold",
                position: "left",
                fill: "red",
                fontSize: 14,
                fontWeight: "bold",
                offset: -10,
                dx: -15
              }}
            />
            <Bar 
              yAxisId="left"
              dataKey="breachPct" 
              name="SLA Breach %" 
              animationDuration={500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgTime"
              stroke="#ff7300"
              name="Avg Delivery Time"
              strokeWidth={2}
              dot={{ r: 6 }}
              activeDot={{ r: 8 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="time-insights">
        <h3>Time of Day Insights</h3>
        <ul className="insights-list">
          {data.sort((a, b) => b.breachPct - a.breachPct)[0] && (
            <li>
              <strong>{data.sort((a, b) => b.breachPct - a.breachPct)[0].name}</strong> has the highest SLA breach rate at 
              <strong> {data.sort((a, b) => b.breachPct - a.breachPct)[0].breachPct.toFixed(1)}%</strong>
            </li>
          )}
          {data.sort((a, b) => b.avgTime - a.avgTime)[0] && (
            <li>
              <strong>{data.sort((a, b) => b.avgTime - a.avgTime)[0].name}</strong> has the longest average delivery time at 
              <strong> {data.sort((a, b) => b.avgTime - a.avgTime)[0].avgTime.toFixed(1)} minutes</strong>
            </li>
          )}
          {data.find(item => item.name === 'Evening') && data.find(item => item.name === 'Morning') && (
            <li>
              Rush hour impact: <strong>Evening</strong> deliveries are 
              <strong> {Math.abs(data.find(item => item.name === 'Evening').avgTime - data.find(item => item.name === 'Morning').avgTime).toFixed(1)} minutes</strong> 
              {data.find(item => item.name === 'Evening').avgTime > data.find(item => item.name === 'Morning').avgTime ? 'slower' : 'faster'} than 
              <strong> Morning</strong> deliveries
            </li>
          )}
          <li>
            Total of <strong>{data.reduce((sum, item) => sum + item.totalOrders, 0).toLocaleString()}</strong> orders analyzed across all time periods
          </li>
        </ul>
      </div>
    </div>
  );
});

export default SLABreachByTimeOfDay; 