import React, { useRef } from 'react';
import SLABreachByZone from './SLABreachByZone';
import SLABreachTrend from './SLABreachTrend';
import AvgDeliveryTimeByType from './AvgDeliveryTimeByType';
import SLABreachByWeather from './SLABreachByWeather';
import LiveOrderFeed from './LiveOrderFeed';
import './Dashboard.css';

const Dashboard = () => {
  // References to component instances for accessing their methods
  const slaBreachRef = useRef();
  const slaTrendRef = useRef();
  const avgDeliveryRef = useRef();
  const weatherRef = useRef();

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
        
        <div className="dashboard-grid">
          <AvgDeliveryTimeByType ref={avgDeliveryRef} />
          <SLABreachByWeather ref={weatherRef} />
        </div>
        
        <LiveOrderFeed 
          updateRate={500} 
          slaBreachRef={slaBreachRef}
          slaTrendRef={slaTrendRef}
          avgDeliveryRef={avgDeliveryRef}
          weatherRef={weatherRef}
        />
      </div>
    </div>
  );
};

export default Dashboard; 