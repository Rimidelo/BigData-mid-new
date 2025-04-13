import React, { useState, useEffect } from 'react';
import { fetchLiveUpdate, generateLiveOrder } from '../utils/dataUtils';
import './LiveOrderFeed.css';

const MAX_FEED_ITEMS = 9; // Maximum number of items to display in the feed

const LiveOrderFeed = ({ updateRate = 2000, slaBreachRef, slaTrendRef, avgDeliveryRef, weatherRef, timeOfDayRef, driverZoneRef }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [feedItems, setFeedItems] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    avgDeliveryTime: 0,
    ordersByZone: {},
    slaBreaches: 0
  });

  // Start or stop the simulation
  const toggleSimulation = () => {
    // If stopping the simulation, clear the feed
    if (isRunning) {
      setFeedItems([]);
    }
    setIsRunning(!isRunning);
  };

  // Adjust simulation speed
  const changeSpeed = (multiplier) => {
    setSpeedMultiplier(multiplier);
  };

  // Run the simulation loop
  useEffect(() => {
    if (!isRunning) return;

    let intervalId;
    
    const runSimulation = async () => {
      // Generate a new order
      const newOrder = generateLiveOrder();
      
      // Update feed items, keeping only the most recent MAX_FEED_ITEMS
      setFeedItems(prev => [newOrder, ...prev].slice(0, MAX_FEED_ITEMS));
      
      // Update stats
      setStats(prev => {
        const newTotal = prev.totalOrders + 1;
        const newAvgTime = ((prev.avgDeliveryTime * prev.totalOrders) + newOrder.delivery_minutes) / newTotal;
        
        // Track orders by zone
        const ordersByZone = {...prev.ordersByZone};
        ordersByZone[newOrder.zone] = (ordersByZone[newOrder.zone] || 0) + 1;
        
        // Count SLA breaches (delivery times > 45 minutes)
        const newSLABreaches = prev.slaBreaches + (newOrder.delivery_minutes > 45 ? 1 : 0);
        
        return {
          totalOrders: newTotal,
          avgDeliveryTime: newAvgTime,
          ordersByZone,
          slaBreaches: newSLABreaches
        };
      });
      
      // Periodically pull actual batches of data to update charts
      if (stats.totalOrders % 5 === 0) {
        // Get the next batch of simulation data
        const dataBatch = await fetchLiveUpdate();
        
        // Update charts with the new data batch
        if (dataBatch && dataBatch.length > 0) {
          console.log('Sending simulation batch to charts:', dataBatch);
          
          // Update SLA breach by zone chart
          if (slaBreachRef && slaBreachRef.current) {
            slaBreachRef.current.updateWithLiveData(dataBatch);
          }
          
          // Update the trend component if available
          if (slaTrendRef && slaTrendRef.current) {
            slaTrendRef.current.updateWithLiveData(dataBatch);
          }
          
          // Update the average delivery time component
          if (avgDeliveryRef && avgDeliveryRef.current) {
            avgDeliveryRef.current.updateWithLiveData(dataBatch);
          }
          
          // Update the weather condition component
          if (weatherRef && weatherRef.current) {
            weatherRef.current.updateWithLiveData(dataBatch);
          }
          
          // Update the time of day component
          if (timeOfDayRef && timeOfDayRef.current) {
            timeOfDayRef.current.updateWithLiveData(dataBatch);
          }
          
          // Update the driver zone performance component
          if (driverZoneRef && driverZoneRef.current) {
            driverZoneRef.current.updateWithLiveData(dataBatch);
          }
        }
      }
    };
    
    // Set interval based on speed multiplier
    intervalId = setInterval(runSimulation, updateRate / speedMultiplier);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isRunning, updateRate, speedMultiplier, stats.totalOrders, slaBreachRef, slaTrendRef, avgDeliveryRef, weatherRef, timeOfDayRef, driverZoneRef]);

  // Format the timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Get appropriate status icon based on order status
  const getStatusIcon = (status) => {
    switch(status) {
      case 'preparing':
        return '🍳';
      case 'in_transit':
        return '🚚';
      case 'delivered':
        return '✅';
      default:
        return '🔄';
    }
  };

  // Determine if an order is breaching SLA (delivery time > 45 minutes)
  const isSLABreach = (deliveryMinutes) => {
    return deliveryMinutes > 45;
  };

  return (
    <div className="live-feed-container">
      <h2>Live Order Feed Simulation</h2>
      <div className="controls">
        <button 
          className={`toggle-btn ${isRunning ? 'running' : ''}`} 
          onClick={toggleSimulation}
        >
          {isRunning ? 'Pause Simulation' : 'Start Simulation'}
        </button>
        
        <div className="speed-controls">
          <span>Speed:</span>
          <button 
            className={speedMultiplier === 0.5 ? 'active' : ''} 
            onClick={() => changeSpeed(0.5)}
          >
            0.5x
          </button>
          <button 
            className={speedMultiplier === 1 ? 'active' : ''} 
            onClick={() => changeSpeed(1)}
          >
            1x
          </button>
          <button 
            className={speedMultiplier === 2 ? 'active' : ''} 
            onClick={() => changeSpeed(2)}
          >
            2x
          </button>
        </div>
      </div>
      
      <div className="stats">
        <div className="stat-item">
          <span className="stat-value">{stats.totalOrders}</span>
          <span className="stat-label">Total Orders</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.avgDeliveryTime.toFixed(1)}</span>
          <span className="stat-label">Avg. Delivery (min)</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.slaBreaches}</span>
          <span className="stat-label">SLA Breaches</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {stats.totalOrders > 0 ? ((stats.slaBreaches / stats.totalOrders) * 100).toFixed(1) : '0.0'}%
          </span>
          <span className="stat-label">Breach Rate</span>
        </div>
      </div>
      
      <div className="feed-list">
        {feedItems.length > 0 ? (
          feedItems.map((item, index) => (
            <div 
              key={index} 
              className={`feed-item ${isSLABreach(item.delivery_minutes) ? 'sla-breach' : ''}`}
            >
              <div className="order-status">
                <span className="emoji">{getStatusIcon(item.status)}</span>
                <span className="order-time">{formatTimestamp(item.timestamp)}</span>
              </div>
              <div className="order-details">
                <span className="order-id">{item.order_id}</span>
                <span className="order-type">{item.cuisine_type}</span>
                <span className="order-zone">Zone: {item.zone}</span>
              </div>
              <div className="delivery-info">
                <span className="delivery-time">
                  {item.delivery_minutes} min
                  {isSLABreach(item.delivery_minutes) && <span className="sla-tag">SLA BREACH</span>}
                </span>
                <span className="order-amount">${item.total_amount}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-feed">
            <p>Start the simulation to see live orders</p>
          </div>
        )}
      </div>
      
      <div className="feed-instructions">
        <p>This simulation generates random orders and periodically updates the charts with new KPI data.</p>
        <p>Start the simulation to see how the dashboard responds to new data.</p>
      </div>
    </div>
  );
};

export default LiveOrderFeed; 