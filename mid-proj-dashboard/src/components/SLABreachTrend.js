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
            margin={{ top: 20, right: 30, left: 75, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis} 
              padding={{ left: 30, right: 30 }}
            />
            <YAxis 
              yAxisId="left"
              domain={[0, 100]}
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
                  return [`${Math.round(value)}%`, name];
                } else if (name === 'Total Orders') {
                  return [value, name];
                }
                return [value, name];
              }}
              labelFormatter={(value) => `Date: ${new Date(value).toLocaleDateString()}`}
            />
            <Legend 
              iconType="line"
              iconSize={20}
              payload={[
                { value: 'SLA Breach %', type: 'line', color: '#8884d8' },
                { value: 'Total Orders', type: 'line', color: '#82ca9d', strokeDasharray: '4 4' }
              ]}
              formatter={(value, entry) => {
                const color = entry.color;
                return <span style={{ color: color, fontWeight: 'bold', fontSize: value === 'Total Orders' ? '16px' : '14px' }}>{value}</span>;
              }}
              wrapperStyle={{ paddingTop: 15 }}
            />
            <ReferenceLine 
              y={calculateSLATarget()} 
              yAxisId="left"
              label={{ 
                value: "Target", 
                position: "left", 
                fill: "red",
                fontSize: 15,
                fontWeight: "bold",
                offset: -10,
                dy: 0,
                dx: -15,
                className: "target-label",
                background: {
                  fill: 'white',
                  strokeWidth: 1,
                  r: 4,
                  padding: [2, 4]
                }
              }} 
              stroke="red" 
              strokeDasharray="3 3"
              strokeWidth={2}
              ifOverflow="visible"
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
        <h3>SLA Breach Trend Insights</h3>
        <ul className="insights-list">
          {data.length > 0 && (
            <>
              <li>
                <strong>{new Date(data.reduce((prev, current) => 
                  current.averageSLABreachPct > prev.averageSLABreachPct ? current : prev, data[0]).date).toLocaleDateString()}</strong> had the highest SLA breach rate at 
                <strong> {data.reduce((prev, current) => 
                  current.averageSLABreachPct > prev.averageSLABreachPct ? current : prev, data[0]).averageSLABreachPct.toFixed(1)}%</strong>
              </li>
              <li>
                <strong>{new Date(data.reduce((prev, current) => 
                  current.orders > prev.orders ? current : prev, data[0]).date).toLocaleDateString()}</strong> had the highest order volume with 
                <strong> {data.reduce((prev, current) => 
                  current.orders > prev.orders ? current : prev, data[0]).orders.toLocaleString()}</strong> orders
              </li>
              <li>
                <strong>{data.filter(day => day.averageSLABreachPct > calculateSLATarget()).length}</strong> days exceeded the SLA breach target of <strong>{calculateSLATarget().toFixed(1)}%</strong>
              </li>
              <li>
                <strong>Trend analysis:</strong> {
                  (() => {
                    // Calculate if the trend is improving or worsening
                    if (data.length < 3) return "Insufficient data for trend analysis";
                    
                    // Get first and last 3 days (or less if not enough data)
                    const firstDays = data.slice(0, Math.min(3, Math.floor(data.length/2)));
                    const lastDays = data.slice(-Math.min(3, Math.ceil(data.length/2)));
                    
                    // Calculate averages
                    const firstAvg = firstDays.reduce((sum, day) => sum + day.averageSLABreachPct, 0) / firstDays.length;
                    const lastAvg = lastDays.reduce((sum, day) => sum + day.averageSLABreachPct, 0) / lastDays.length;
                    
                    // Calculate percentage change
                    const percentChange = ((lastAvg - firstAvg) / firstAvg) * 100;
                    
                    // Check if there's a linear trend
                    const xValues = Array.from({length: data.length}, (_, i) => i); // 0, 1, 2, ...
                    const yValues = data.map(d => d.averageSLABreachPct);
                    
                    // Calculate linear regression
                    const n = data.length;
                    const sumX = xValues.reduce((a, b) => a + b, 0);
                    const sumY = yValues.reduce((a, b) => a + b, 0);
                    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
                    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
                    
                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const averageSLA = sumY / n;
                    
                    // Determine strength of trend
                    const normalizedSlope = (slope * n) / averageSLA * 100; // Slope as percentage of average per period
                    
                    if (Math.abs(normalizedSlope) < 3) {
                      return `SLA breach rate is stable around ${averageSLA.toFixed(1)}%`;
                    } else if (percentChange < -5) {
                      return `SLA breach rate has improved by ${Math.abs(percentChange).toFixed(1)}% from ${firstAvg.toFixed(1)}% to ${lastAvg.toFixed(1)}%`;
                    } else if (percentChange > 5) {
                      return `SLA breach rate has worsened by ${percentChange.toFixed(1)}% from ${firstAvg.toFixed(1)}% to ${lastAvg.toFixed(1)}%`;
                    } else {
                      return `SLA breach rate has remained relatively stable from ${firstAvg.toFixed(1)}% to ${lastAvg.toFixed(1)}%`;
                    }
                  })()
                }
              </li>
              <li>
                Total of <strong>{data.reduce((sum, day) => sum + day.orders, 0).toLocaleString()}</strong> orders processed over <strong>{data.length}</strong> days
              </li>
              <li>
                Daily average of <strong>{Math.round(data.reduce((sum, day) => sum + day.orders, 0) / data.length).toLocaleString()}</strong> orders and <strong>{(data.reduce((sum, day) => sum + day.averageSLABreachPct, 0) / data.length).toFixed(1)}%</strong> SLA breach rate
              </li>
              <li>
                <strong>Correlation analysis:</strong> {
                  (() => {
                    if (data.length < 5) return "Insufficient data for correlation analysis";
                    
                    // Calculate correlation between order volume and SLA breach rate
                    const n = data.length;
                    const sumX = data.reduce((sum, day) => sum + day.orders, 0);
                    const sumY = data.reduce((sum, day) => sum + day.averageSLABreachPct, 0);
                    const sumXY = data.reduce((sum, day) => sum + (day.orders * day.averageSLABreachPct), 0);
                    const sumXX = data.reduce((sum, day) => sum + (day.orders * day.orders), 0);
                    const sumYY = data.reduce((sum, day) => sum + (day.averageSLABreachPct * day.averageSLABreachPct), 0);
                    
                    const numerator = (n * sumXY) - (sumX * sumY);
                    const denominator = Math.sqrt(((n * sumXX) - (sumX * sumX)) * ((n * sumYY) - (sumY * sumY)));
                    
                    if (denominator === 0) return "No clear correlation between order volume and SLA breach rate";
                    
                    const correlation = numerator / denominator;
                    
                    if (correlation > 0.5) {
                      return "Strong positive correlation: Higher order volumes tend to increase SLA breach rates";
                    } else if (correlation > 0.3) {
                      return "Moderate positive correlation: Higher order volumes may increase SLA breach rates";
                    } else if (correlation > -0.3) {
                      return "No significant correlation between order volumes and SLA breach rates";
                    } else if (correlation > -0.5) {
                      return "Moderate negative correlation: Higher order volumes may reduce SLA breach rates";
                    } else {
                      return "Strong negative correlation: Higher order volumes tend to reduce SLA breach rates";
                    }
                  })()
                }
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
});

export default SLABreachTrend; 