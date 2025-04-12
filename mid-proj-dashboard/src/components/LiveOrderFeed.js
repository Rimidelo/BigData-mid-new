import React, { useState, useEffect } from 'react';
import { generateLiveOrder } from '../utils/dataUtils';
import './LiveOrderFeed.css';

const LiveOrderFeed = ({ updateRate = 1000, slaBreachRef }) => {
  const [orders, setOrders] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    averageDeliveryTime: 0,
    slaBreaches: 0
  });

  useEffect(() => {
    let intervalId;
    
    if (isRunning) {
      // Generate new orders at the specified rate
      intervalId = setInterval(() => {
        const newOrder = generateLiveOrder();
        
        setOrders(prevOrders => {
          // Limit to last 10 orders for display
          const updatedOrders = [newOrder, ...prevOrders].slice(0, 10);
          return updatedOrders;
        });
        
        // Update stats
        setStats(prevStats => {
          const newTotalOrders = prevStats.totalOrders + 1;
          const newTotalTime = prevStats.averageDeliveryTime * prevStats.totalOrders + newOrder.delivery_minutes;
          const newAvgTime = newTotalTime / newTotalOrders;
          const newSlaBreaches = prevStats.slaBreaches + (newOrder.delivery_minutes > 45 ? 1 : 0);
          
          return {
            totalOrders: newTotalOrders,
            averageDeliveryTime: newAvgTime,
            slaBreaches: newSlaBreaches
          };
        });
        
        // Update SLABreachByZone component with the new order data
        if (slaBreachRef && slaBreachRef.current) {
          // Convert the order into a format that SLABreachByZone can use
          const isSLABreach = newOrder.delivery_minutes > 45;
          
          // Create a more realistic breach percentage instead of just 0 or 1
          // This simulates aggregated data over multiple orders
          const zoneTrend = newOrder.zone === 'Z1' ? 0.48 : 0.47; // Base trends from historical data
          const randomVariance = (Math.random() * 0.1) - 0.05; // Add some randomness
          const breachPct = isSLABreach 
            ? zoneTrend + Math.abs(randomVariance) // If breach, trend upward
            : zoneTrend - Math.abs(randomVariance); // If not breach, trend downward
          
          const slaBreachData = [{
            order_date: new Date().toISOString().split('T')[0],
            zone: newOrder.zone,
            sla_breach_pct: breachPct // Use realistic breach percentage
          }];
          
          console.log('Sending live update to SLA chart:', slaBreachData);
          slaBreachRef.current.updateWithLiveData(slaBreachData);
        }
        
      }, updateRate);
    }
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isRunning, updateRate, slaBreachRef]);

  const toggleSimulation = () => {
    setIsRunning(prev => !prev);
  };

  const resetSimulation = () => {
    setOrders([]);
    setStats({
      totalOrders: 0,
      averageDeliveryTime: 0,
      slaBreaches: 0
    });
    setIsRunning(false);
  };

  // Format timestamp for display
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="live-order-feed">
      <div className="feed-header">
        <h2>Live Order Feed</h2>
        <div className="feed-controls">
          <button 
            className={`control-button ${isRunning ? 'stop' : 'start'}`} 
            onClick={toggleSimulation}
          >
            {isRunning ? 'Pause Simulation' : 'Start Simulation'}
          </button>
          <button className="control-button reset" onClick={resetSimulation}>
            Reset
          </button>
        </div>
      </div>
      
      <div className="stats-container">
        <div className="stat-item">
          <h3>Total Orders</h3>
          <p>{stats.totalOrders}</p>
        </div>
        <div className="stat-item">
          <h3>Avg Delivery Time</h3>
          <p>{stats.averageDeliveryTime.toFixed(1)} min</p>
        </div>
        <div className="stat-item">
          <h3>SLA Breaches</h3>
          <p>{stats.slaBreaches} ({stats.totalOrders > 0 
              ? ((stats.slaBreaches / stats.totalOrders) * 100).toFixed(1) 
              : 0}%)</p>
        </div>
      </div>
      
      <div className="orders-container">
        {orders.length === 0 ? (
          <div className="no-orders">Start the simulation to see live orders</div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Order ID</th>
                <th>Zone</th>
                <th>Cuisine</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={index} className={order.delivery_minutes > 45 ? 'sla-breached' : ''}>
                  <td>{formatTime(order.timestamp)}</td>
                  <td>{order.order_id}</td>
                  <td>{order.zone}</td>
                  <td>{order.cuisine_type}</td>
                  <td>${order.total_amount}</td>
                  <td>
                    <span className={`status-badge ${order.status}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {order.delivery_minutes} min
                    {order.delivery_minutes > 45 && (
                      <span className="breach-badge">SLA Breach</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LiveOrderFeed; 