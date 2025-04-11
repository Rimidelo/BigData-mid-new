import React, { useRef } from 'react';
import SLABreachByZone from './SLABreachByZone';
import LiveOrderFeed from './LiveOrderFeed';
import './Dashboard.css';

const Dashboard = () => {
  // References to component instances for accessing their methods
  const slaBreachRef = useRef();

  return (
    <div className="dashboard">
      <h1>Food Delivery Performance Dashboard</h1>
      <div className="dashboard-description">
        <p>This dashboard analyzes delivery performance with a focus on identifying factors contributing to SLA breaches.</p>
      </div>
      
      <div className="dashboard-content">
        <SLABreachByZone ref={slaBreachRef} />
        
        <LiveOrderFeed updateRate={500} slaBreachRef={slaBreachRef} />
        
        {/* Additional components will be added here */}
        <div className="placeholder-metrics">
          <h3>Key Questions to Explore:</h3>
          <ul>
            <li>Which delivery zones experience the most late deliveries (SLA breaches)?</li>
            <li>What factors contribute to these delays?</li>
            <li>How do weather conditions affect delivery times?</li>
            <li>Is there a correlation between delivery distance and SLA breaches?</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 