import React, { useRef } from 'react';
import SLABreachByZone from './SLABreachByZone';
import SLABreachTrend from './SLABreachTrend';
import LiveOrderFeed from './LiveOrderFeed';
import './Dashboard.css';

const Dashboard = () => {
  // References to component instances for accessing their methods
  const slaBreachRef = useRef();
  const slaTrendRef = useRef();

  return (
    <div className="dashboard">
      <h1>Food Delivery Performance Dashboard</h1>
      <div className="dashboard-description">
        <p>This dashboard analyzes delivery performance with a focus on identifying factors contributing to SLA breaches.</p>
      </div>
      
      <div className="dashboard-content">
        <div className="dashboard-grid">
          <SLABreachByZone ref={slaBreachRef} />
          <SLABreachTrend ref={slaTrendRef} />
        </div>
        
        <LiveOrderFeed 
          updateRate={500} 
          slaBreachRef={slaBreachRef}
          slaTrendRef={slaTrendRef}
        />
        
        {/* Additional components will be added here */}
        <div className="placeholder-metrics">
          <h3>Key Questions to Explore:</h3>
          <ul>
            <li>Which delivery zones experience the most late deliveries (SLA breaches)?</li>
            <li>What factors contribute to these delays?</li>
            <li>Are there specific days or time periods with higher SLA breach rates?</li>
            <li>How do weather conditions affect delivery times?</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 