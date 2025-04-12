import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ReferenceLine, Brush 
} from 'recharts';
import { fetchSLABreachData } from '../utils/dataUtils';
import './SLABreachTrend.css';

// Fallback data for the component
const FALLBACK_DATA = [
  { date: '2024-04-01', averageSLABreachPct: 0.382, orders: 687 },
  { date: '2024-04-02', averageSLABreachPct: 0.401, orders: 712 },
  { date: '2024-04-03', averageSLABreachPct: 0.375, orders: 745 },
  { date: '2024-04-04', averageSLABreachPct: 0.352, orders: 803 },
  { date: '2024-04-05', averageSLABreachPct: 0.418, orders: 768 },
  { date: '2024-04-06', averageSLABreachPct: 0.427, orders: 692 },
  { date: '2024-04-07', averageSLABreachPct: 0.391, orders: 673 }
];

const SLABreachTrend = forwardRef((props, ref) => {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Expose the updateWithLiveData method to parent components
  useImperativeHandle(ref, () => ({
    updateWithLiveData: (newData) => {
      if (!newData || newData.length === 0) return;
      
      console.log('SLABreachTrend received new data:', newData);
      setIsUpdating(true);
      
      // Process new data
      const newDataByDate = processDataByDate(newData);
      
      // Append new data to existing data and sort by date
      const combinedData = [...data, ...newDataByDate]
        .reduce((acc, item) => {
          // Check if this date already exists
          const existingItem = acc.find(i => i.date === item.date);
          if (existingItem) {
            // If exists, update with weighted average to create smooth transitions
            existingItem.averageSLABreachPct = 
              (existingItem.averageSLABreachPct * 0.7) + (item.averageSLABreachPct * 0.3);
            existingItem.orders += item.orders;
            return acc;
          } else {
            // If new date, add to array
            acc.push(item);
            return acc;
          }
        }, [])
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log('Combined trend data:', combinedData);
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
          console.warn('No trend data received, using fallback data');
          setData(FALLBACK_DATA);
          setError('Using fallback data for trend visualization.');
          setLoading(false);
          return;
        }
        
        // Process the data by date
        const trendData = processDataByDate(responseData);
        console.log('Processed trend data:', trendData);
        
        if (trendData && trendData.length > 0) {
          setData(trendData);
        } else {
          console.warn('Using fallback data as trend data was empty');
          setError('Using fallback data for trend visualization.');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching SLA trend data:', err);
        setError('Failed to load trend data. Using fallback data.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Process the data to get daily averages across all zones
  const processDataByDate = (data) => {
    if (!data || data.length === 0) return [];
    
    // Group data by date
    const dateGroups = data.reduce((acc, item) => {
      const date = item.order_date;
      if (!date) return acc;
      
      if (!acc[date]) {
        acc[date] = {
          slaBreachSum: 0,
          ordersSum: 0,
          count: 0
        };
      }
      
      // Handle different data formats
      const breachPct = typeof item.sla_breach_pct === 'string' 
        ? parseFloat(item.sla_breach_pct) 
        : item.sla_breach_pct || 0;
      
      const orders = item.orders 
        ? (typeof item.orders === 'string' ? parseInt(item.orders) : item.orders) 
        : 0;
      
      acc[date].slaBreachSum += breachPct;
      acc[date].ordersSum += orders;
      acc[date].count += 1;
      
      return acc;
    }, {});
    
    // Calculate daily averages and format for visualization
    return Object.keys(dateGroups)
      .map(date => {
        const group = dateGroups[date];
        return {
          date,
          averageSLABreachPct: (group.slaBreachSum / group.count) * 100, // Convert to percentage
          orders: group.ordersSum
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Helper to format dates on x-axis
  const formatXAxis = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate SLA target line based on data
  const calculateSLATarget = () => {
    // Target is typically considered 20% below average performance
    const avgPerformance = data.reduce((sum, item) => sum + item.averageSLABreachPct, 0) / data.length;
    return Math.max(25, avgPerformance * 0.8); // Floor at 25%
  };

  if (loading) {
    return <div className="loading">Loading SLA trend data...</div>;
  }

  return (
    <div className="sla-trend-container">
      <h2>SLA Breach Trend Over Time</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="live-data-indicator">Updates in real-time with the Live Order Feed</div>
      <div className={`sla-trend-chart ${isUpdating ? 'updating' : ''}`}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis} 
              padding={{ left: 30, right: 30 }}
            />
            <YAxis 
              yAxisId="left"
              domain={[0, 60]}
              label={{ value: 'SLA Breach %', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={['auto', 'auto']}
              label={{ value: 'Total Orders', angle: 90, position: 'insideRight' }}
            />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'SLA Breach %') {
                  return [`${value.toFixed(2)}%`, name];
                } else if (name === 'Total Orders') {
                  return [value, name];
                }
                return [value, name];
              }}
              labelFormatter={(value) => `Date: ${new Date(value).toLocaleDateString()}`}
            />
            <Legend />
            <ReferenceLine 
              y={calculateSLATarget()} 
              yAxisId="left"
              label="Target" 
              stroke="red" 
              strokeDasharray="3 3" 
            />
            <Line 
              type="monotone" 
              dataKey="averageSLABreachPct" 
              name="SLA Breach %" 
              yAxisId="left"
              stroke="#8884d8" 
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 8 }}
              animationDuration={500}
            />
            <Line 
              type="monotone" 
              dataKey="orders" 
              name="Total Orders" 
              yAxisId="right"
              stroke="#82ca9d" 
              strokeDasharray="4 4"
              animationDuration={500}
            />
            <Brush dataKey="date" height={30} stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="sla-trend-insights">
        <h3>Insights:</h3>
        <ul>
          <li>Chart shows SLA breach percentage trend over time</li>
          <li>Includes daily order volume to correlate with SLA breaches</li>
          <li>Red dotted line indicates the target SLA breach rate</li>
          <li>Use the brush at the bottom to zoom into specific time periods</li>
          {data.length > 0 && (
            <>
              <li>
                Highest SLA breach rate: {Math.max(...data.map(d => d.averageSLABreachPct)).toFixed(2)}% on {
                  new Date(data.sort((a, b) => b.averageSLABreachPct - a.averageSLABreachPct)[0].date)
                    .toLocaleDateString()
                }
              </li>
              <li>
                {data[data.length - 1].averageSLABreachPct > data[0].averageSLABreachPct 
                  ? 'SLA breach rate is trending upward' 
                  : 'SLA breach rate is trending downward'}
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
});

export default SLABreachTrend; 