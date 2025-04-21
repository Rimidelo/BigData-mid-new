import React, { useState, useEffect } from 'react';
import { fetchLiveUpdate, generateLiveOrder } from '../utils/dataUtils';
import './LiveOrderFeed.css';

const LiveOrderFeed = ({ updateRate = 2000, slaBreachRef, slaTrendRef, avgDeliveryRef, weatherRef, timeOfDayRef, driverZoneRef }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalBatchedOrders: 0, // Track the total number of orders in all batches
    avgDeliveryTime: 0,
    ordersByZone: {},
    slaBreaches: 0,
    lastBatchSize: 0 // Track the size of the last batch
  });

  // Start or stop the simulation
  const toggleSimulation = () => {
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
      
      // Update stats for the individual simulated order
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
          totalBatchedOrders: prev.totalBatchedOrders,
          lastBatchSize: prev.lastBatchSize,
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
          
          // Count the actual number of orders in this batch
          // Each item in dataBatch typically represents multiple orders
          let actualOrderCount = 0;
          dataBatch.forEach(item => {
            // Use the 'orders' field if it exists, or default to a random number between 100-500
            actualOrderCount += (item.orders ? 
              (typeof item.orders === 'string' ? parseInt(item.orders) : item.orders) : 
              Math.floor(Math.random() * 400) + 100);
          });
          
          // Update the stats to include the actual order count
          setStats(prev => ({
            ...prev,
            totalBatchedOrders: prev.totalBatchedOrders + actualOrderCount,
            lastBatchSize: actualOrderCount
          }));
          
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

  return (
    <div className="live-feed-container">
      <h2>Live Data Simulation</h2>
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
      
      <div className="stats-container">
        <div className="stats">
          <div className="stat-item">
            <span className="stat-value">{stats.totalBatchedOrders.toLocaleString()}</span>
            <span className="stat-label">Total Orders Added</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.lastBatchSize.toLocaleString()}</span>
            <span className="stat-label">Last Batch Size</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.avgDeliveryTime.toFixed(1)}</span>
            <span className="stat-label">Avg. Time (min)</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {stats.totalOrders > 0 ? ((stats.slaBreaches / stats.totalOrders) * 100).toFixed(1) : '0.0'}%
            </span>
            <span className="stat-label">Breach Rate</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveOrderFeed; 