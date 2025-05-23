
// Track which data has been used for initial load vs simulation
let initialDataLoaded = false;
let initialDataEndDate = null;
let simulationData = [];

// Helper function to read a local CSV file
export const readLocalCSV = async (filePath) => {
  try {
    const fs = window.require('fs');
    const path = window.require('path');
    
    // Get absolute path
    const fullPath = path.resolve(filePath);
    console.log('Reading CSV from:', fullPath);
    
    return new Promise((resolve, reject) => {
      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  } catch (error) {
    console.error('Error using Node.js modules in browser:', error);
    throw new Error('Cannot read local files in this environment');
  }
};

// Create hard-coded fallback data that matches our KPI format
const FALLBACK_DATA = [
  { order_date: '2024-04-01', zone: 'Z1', orders: 1398, avg_delivery_min: 44.95, sla_breach_pct: 0.48 },
  { order_date: '2024-04-01', zone: 'Z2', orders: 1313, avg_delivery_min: 44.90, sla_breach_pct: 0.47 },
  { order_date: '2024-04-02', zone: 'Z1', orders: 1370, avg_delivery_min: 45.08, sla_breach_pct: 0.49 },
  { order_date: '2024-04-02', zone: 'Z2', orders: 1295, avg_delivery_min: 43.67, sla_breach_pct: 0.45 },
  { order_date: '2024-04-03', zone: 'Z1', orders: 1410, avg_delivery_min: 45.32, sla_breach_pct: 0.51 },
  { order_date: '2024-04-03', zone: 'Z2', orders: 1325, avg_delivery_min: 44.12, sla_breach_pct: 0.46 },
  { order_date: '2024-04-04', zone: 'Z1', orders: 1385, avg_delivery_min: 46.01, sla_breach_pct: 0.52 },
  { order_date: '2024-04-04', zone: 'Z2', orders: 1340, avg_delivery_min: 43.89, sla_breach_pct: 0.44 },
  { order_date: '2024-04-05', zone: 'Z1', orders: 1450, avg_delivery_min: 45.75, sla_breach_pct: 0.50 },
  { order_date: '2024-04-05', zone: 'Z2', orders: 1380, avg_delivery_min: 44.32, sla_breach_pct: 0.48 }
];

// Function to fetch actual data from the CSV file in public folder
export const fetchSLABreachData = async () => {
  try {
    console.log('Fetching CSV data from public folder...');
    // Fetch the CSV file from public folder
    const response = await fetch('/data/kpi/kpi_delivery_daily.csv');
    if (!response.ok) {
      throw new Error('Failed to fetch KPI data');
    }
    
    const csvText = await response.text();
    console.log('Raw CSV data received:', csvText.substring(0, 300) + '...');
    
    // Parse CSV data
    const parsedData = parseCSV(csvText);
    console.log('Parsed data (first 2 items):', parsedData.slice(0, 2));
    
    // Split data into initial load and simulation parts
    if (!initialDataLoaded) {
      // First time loading - use only the first half of the data
      initialDataLoaded = true;
      
      // Sort data by date 
      parsedData.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
      
      // Find the midpoint date
      const allDates = [...new Set(parsedData.map(item => item.order_date))];
      const midpointIndex = Math.floor(allDates.length / 2);
      initialDataEndDate = allDates[midpointIndex];
      
      // Filter data for initial load (first half)
      const initialData = parsedData.filter(
        item => new Date(item.order_date) <= new Date(initialDataEndDate)
      );
      
      // Store the remaining data for simulation
      simulationData = parsedData.filter(
        item => new Date(item.order_date) > new Date(initialDataEndDate)
      );
      
      console.log(`Data split at date: ${initialDataEndDate}`);
      console.log(`Initial data: ${initialData.length} rows, Simulation data: ${simulationData.length} rows`);
      
      return initialData;
    } else {
      // Subsequent calls - return the already loaded initial data
      const initialData = parsedData.filter(
        item => new Date(item.order_date) <= new Date(initialDataEndDate)
      );
      return initialData;
    }
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    // Fallback to simple data in case of error
    return FALLBACK_DATA;
  }
};

// Function to fetch cuisine performance data
export const fetchCuisineData = async () => {
  try {
    const response = await fetch('/data/kpi/kpi_cuisine_performance.csv');
    if (!response.ok) {
      throw new Error('Failed to fetch cuisine data');
    }
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching cuisine data:', error);
    return []; 
  }
};

// Function to fetch menu item sales data
export const fetchMenuItemData = async () => {
  try {
    const response = await fetch('/data/kpi/kpi_menu_item_sales.csv');
    if (!response.ok) {
      throw new Error('Failed to fetch menu item data');
    }
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching menu item data:', error);
    return [];
  }
};

// Helper function to parse CSV string into array of objects
const parseCSV = (csvString) => {
  if (!csvString || typeof csvString !== 'string') {
    console.error('Invalid CSV string:', csvString);
    return [];
  }

  try {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) {
      console.error('CSV has insufficient lines:', lines.length);
      return [];
    }

    // Clean headers (remove any \r characters)
    const headers = lines[0].split(',').map(header => header.trim().replace(/\r/g, ''));
    console.log('CSV Headers:', headers);
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',');
      if (values.length !== headers.length) {
        console.warn(`Line ${index + 1} has mismatched values:`, values);
      }
      
      const obj = {};
      
      headers.forEach((header, index) => {
        // Clean up value and remove any \r characters
        const value = values[index] ? values[index].trim().replace(/\r/g, '') : '';
        
        // Convert numeric values
        if (['sla_breach_pct', 'avg_delivery_min', 'orders', 'revenue', 'total_items_sold', 'total_sales'].includes(header)) {
          obj[header] = parseFloat(value || '0');
        } else {
          obj[header] = value || '';
        }
      });
      
      return obj;
    });
  } catch (err) {
    console.error('Error parsing CSV:', err);
    return [];
  }
};

// Get the next batch of simulation data
let simulationDataIndex = 0;
const SIMULATION_BATCH_SIZE = 5;

export const fetchLiveUpdate = async () => {
  // Return a batch from the reserved simulation data
  if (simulationData.length === 0) {
    console.log('No simulation data available, fetching new data');
    
    try {
      // If we don't have simulation data yet, fetch it from the file
      const response = await fetch('/data/kpi/kpi_delivery_daily.csv');
      if (!response.ok) {
        throw new Error('Failed to fetch simulation data');
      }
      
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      // Only use second half of the data for simulation
      if (initialDataEndDate) {
        simulationData = parsedData.filter(
          item => new Date(item.order_date) > new Date(initialDataEndDate)
        );
      } else {
        // If no initialDataEndDate is set, use the latter half of the data
        const allDates = [...new Set(parsedData.map(item => item.order_date))].sort();
        const midpointIndex = Math.floor(allDates.length / 2);
        
        simulationData = parsedData.filter(
          item => allDates.indexOf(item.order_date) >= midpointIndex
        );
      }
      
      if (simulationData.length === 0) {
        // Fallback if we still couldn't get simulation data
        return [];
      }
    } catch (error) {
      console.error('Error fetching simulation data:', error);
      return [];
    }
  }
  
  const startIndex = simulationDataIndex;
  const endIndex = Math.min(startIndex + SIMULATION_BATCH_SIZE, simulationData.length);
  
  const batch = simulationData.slice(startIndex, endIndex);
  simulationDataIndex = (simulationDataIndex + SIMULATION_BATCH_SIZE) % simulationData.length; // Loop back to start if we reach the end
  
  console.log(`Live update data: ${batch.length} rows (${startIndex}-${endIndex})`);
  return batch;
};

// Generate a realistic order for the live feed simulation
// Also returns a zone for SLA breach simulation
export const generateLiveOrder = () => {
  // If we have simulation data, use a random row to base the order on
  let baseZone = 'Z1';
  let baseSLABreachPct = 0.48;
  
  if (simulationData.length > 0) {
    const randomIndex = Math.floor(Math.random() * simulationData.length);
    const randomItem = simulationData[randomIndex];
    baseZone = randomItem.zone;
    baseSLABreachPct = parseFloat(randomItem.sla_breach_pct);
  }
  
  // Generate a random order ID
  const orderId = `ORD-${Math.floor(Math.random() * 10000)}`;
  
  // Random cuisines and their associated items
  const cuisines = ['Italian', 'Japanese', 'Mexican', 'Vegan', 'Burgers'];
  const cuisine = cuisines[Math.floor(Math.random() * cuisines.length)];
  
  // Generate a random timestamp within the last few minutes
  const now = new Date();
  const minutesAgo = Math.floor(Math.random() * 10);
  const timestamp = new Date(now.getTime() - (minutesAgo * 60000)).toISOString();
  
  // Generate random delivery time (30-55 minutes)
  // Higher chance of SLA breach based on the zone's historical data
  let deliveryMinutes;
  if (Math.random() < baseSLABreachPct) {
    // Generate a value likely above SLA (45+ minutes)
    deliveryMinutes = Math.floor(45 + Math.random() * 10);
  } else {
    // Generate a value likely below SLA (30-45 minutes)
    deliveryMinutes = Math.floor(30 + Math.random() * 15);
  }
  
  // Random order status
  const statuses = ['preparing', 'in_transit', 'delivered'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  // Random order amount ($15-60)
  const totalAmount = (15 + Math.random() * 45).toFixed(2);
  
  return {
    order_id: orderId,
    cuisine_type: cuisine,
    timestamp: timestamp,
    zone: baseZone,
    total_amount: totalAmount,
    status: status,
    delivery_minutes: deliveryMinutes
  };
};

// Function to aggregate SLA breach data by zone for visualization
export const aggregateSLABreachByZone = (data) => {
  try {
    if (!data || data.length === 0) {
      console.error('No data to aggregate');
      return [];
    }
    
    console.log('Aggregating data:', data.slice(0, 2));
    
    // Check if this is simulation data
    const isSimulationData = initialDataLoaded && data.some(item => 
      item.order_date && new Date(item.order_date) > new Date(initialDataEndDate)
    );
    
    // Group data by zone
    const zoneGroups = {};
    
    data.forEach(row => {
      if (!row.zone) return;
      
      const zone = row.zone;
      if (!zoneGroups[zone]) {
        zoneGroups[zone] = {
          slaBreachSum: 0,
          count: 0,
          orderSum: 0,
          deliveryTimeSum: 0
        };
      }
      
      // Convert to number if it's a string
      const breachPct = typeof row.sla_breach_pct === 'string' 
        ? parseFloat(row.sla_breach_pct) 
        : row.sla_breach_pct || 0;
      
      const orders = row.orders ? (typeof row.orders === 'string' ? parseInt(row.orders) : row.orders) : 0;
      const deliveryTime = row.avg_delivery_min ? 
        (typeof row.avg_delivery_min === 'string' ? parseFloat(row.avg_delivery_min) : row.avg_delivery_min) 
        : 0;
      
      zoneGroups[zone].slaBreachSum += breachPct;
      zoneGroups[zone].count += 1;
      zoneGroups[zone].orderSum += orders;
      zoneGroups[zone].deliveryTimeSum += deliveryTime;
    });
    
    // Calculate averages and format for visualization
    const result = Object.keys(zoneGroups).map(zone => {
      const group = zoneGroups[zone];
      const avgBreachPct = (group.slaBreachSum / group.count) * 100;
      const avgDeliveryTime = group.deliveryTimeSum / group.count;
      
      // Use different colors for historical vs simulation data
      const fillColor = isSimulationData 
        ? getSimulationColor(zone)
        : getHistoricalColor(zone);
      
      return {
        zone: zone,
        averageSLABreachPct: avgBreachPct,
        averageDeliveryTime: avgDeliveryTime,
        totalOrders: group.orderSum,
        fill: fillColor
      };
    });
    
    console.log('Aggregated result:', result);
    return result;
  } catch (error) {
    console.error('Error aggregating SLA breach data:', error);
    return [];
  }
};

// Different color schemes for historical vs. simulation data
function getHistoricalColor(zone) {
  const colors = {
    'Z1': '#8884d8', // Purple
    'Z2': '#82ca9d', // Green
    'Z3': '#ffc658', // Yellow
    'Z4': '#ff8042', // Orange
    'Z5': '#0088fe'  // Blue
  };
  return colors[zone] || '#8884d8';
}

function getSimulationColor(zone) {
  const colors = {
    'Z1': '#ff6b8b', // Pink
    'Z2': '#5fb580', // Dark green
    'Z3': '#ffa726', // Orange
    'Z4': '#ef5350', // Red
    'Z5': '#42a5f5'  // Light blue
  };
  return colors[zone] || '#ff6b8b';
}

// Function to aggregate cuisine performance data
export const aggregateCuisineData = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  try {
    // Group by cuisine type
    const aggregatedData = data.reduce((acc, curr) => {
      if (!curr.cuisine_type) return acc;
      
      const cuisineData = acc.find(item => item.cuisine_type === curr.cuisine_type);
      if (cuisineData) {
        cuisineData.totalOrders += curr.orders;
        cuisineData.totalRevenue += curr.revenue;
        cuisineData.avgDeliveryMin = 
          (cuisineData.avgDeliveryMin * cuisineData.count + curr.avg_delivery_min) / (cuisineData.count + 1);
        cuisineData.count += 1;
      } else {
        acc.push({
          cuisine_type: curr.cuisine_type,
          totalOrders: curr.orders,
          totalRevenue: curr.revenue,
          avgDeliveryMin: curr.avg_delivery_min,
          count: 1
        });
      }
      return acc;
    }, []);
    
    // Sort by total orders
    return aggregatedData
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .map(item => ({
        name: item.cuisine_type,
        orders: item.totalOrders,
        revenue: Math.round(item.totalRevenue),
        avgDeliveryMin: Math.round(item.avgDeliveryMin * 10) / 10
      }));
  } catch (err) {
    console.error('Error aggregating cuisine data:', err);
    return [];
  }
};

// Function to aggregate menu item sales data
export const aggregateMenuItemData = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  try {
    // Group by category
    const aggregatedData = data.reduce((acc, curr) => {
      if (!curr.category) return acc;
      
      const categoryData = acc.find(item => item.category === curr.category);
      if (categoryData) {
        categoryData.totalItems += curr.total_items_sold;
        categoryData.totalSales += curr.total_sales;
        categoryData.count += 1;
      } else {
        acc.push({
          category: curr.category,
          totalItems: curr.total_items_sold,
          totalSales: curr.total_sales,
          count: 1
        });
      }
      return acc;
    }, []);
    
    // Calculate average price per item and sort by total items
    return aggregatedData
      .map(item => ({
        name: item.category,
        totalItems: item.totalItems,
        totalSales: Math.round(item.totalSales),
        avgPricePerItem: Math.round((item.totalSales / item.totalItems) * 100) / 100
      }))
      .sort((a, b) => b.totalItems - a.totalItems);
  } catch (err) {
    console.error('Error aggregating menu item data:', err);
    return [];
  }
};

// Function to aggregate SLA breach data by weather condition
export const aggregateSLABreachByWeather = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  try {
    // Group by weather condition
    const weatherMap = {};
    
    data.forEach(item => {
      if (!item.weather_condition) return;
      
      if (!weatherMap[item.weather_condition]) {
        weatherMap[item.weather_condition] = {
          totalOrders: 0,
          totalTime: 0,
          slaBreaches: 0
        };
      }
      
      const orders = typeof item.orders === 'string' 
        ? parseInt(item.orders) 
        : item.orders || 0;
      
      const avgDeliveryMin = typeof item.avg_delivery_min === 'string'
        ? parseFloat(item.avg_delivery_min)
        : item.avg_delivery_min || 0;
      
      // Consider delivery times over 45 minutes as SLA breaches
      const slaThreshold = 45;
      const isBreached = avgDeliveryMin > slaThreshold;
      
      weatherMap[item.weather_condition].totalOrders += orders;
      weatherMap[item.weather_condition].totalTime += avgDeliveryMin * orders;
      if (isBreached) {
        weatherMap[item.weather_condition].slaBreaches += orders;
      }
    });
    
    // Calculate percentages and format data for chart
    return Object.keys(weatherMap).map(weather => {
      const weatherData = weatherMap[weather];
      const avgTime = weatherData.totalOrders > 0 
        ? weatherData.totalTime / weatherData.totalOrders 
        : 0;
      const breachPct = weatherData.totalOrders > 0 
        ? (weatherData.slaBreaches / weatherData.totalOrders) * 100 
        : 0;
        
      return {
        name: weather,
        breachPct: Math.round(breachPct * 10) / 10,
        avgTime: Math.round(avgTime * 10) / 10,
        totalOrders: weatherData.totalOrders
      };
    }).sort((a, b) => b.breachPct - a.breachPct);
  } catch (err) {
    console.error('Error aggregating weather condition data:', err);
    return [];
  }
};

// Function to aggregate SLA breach data by time of day (Morning, Afternoon, Evening, Night)
export const aggregateSLABreachByTimeOfDay = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  try {
    // Define the time periods in order for consistent display
    const timePeriods = ['Morning', 'Afternoon', 'Evening', 'Night'];
    
    // Group by time period
    const timeMap = {};
    
    // Initialize time periods
    timePeriods.forEach(period => {
      timeMap[period] = {
        totalOrders: 0,
        totalTime: 0,
        slaBreaches: 0,
        avgTimes: [] // Store all avg_delivery_min values for boxplot/distribution
      };
    });
    
    data.forEach(item => {
      if (!item.time_period) return;
      
      const timePeriod = item.time_period;
      if (!timeMap[timePeriod]) return; // Skip invalid time periods
      
      const orders = typeof item.orders === 'string' 
        ? parseInt(item.orders) 
        : item.orders || 0;
      
      const avgDeliveryMin = typeof item.avg_delivery_min === 'string'
        ? parseFloat(item.avg_delivery_min)
        : item.avg_delivery_min || 0;
      
      // Consider delivery times over 45 minutes as SLA breaches
      const slaThreshold = 45;
      const isBreached = avgDeliveryMin > slaThreshold;
      
      timeMap[timePeriod].totalOrders += orders;
      timeMap[timePeriod].totalTime += avgDeliveryMin * orders;
      timeMap[timePeriod].avgTimes.push(avgDeliveryMin);
      
      if (isBreached) {
        timeMap[timePeriod].slaBreaches += orders;
      }
    });
    
    // Calculate stats and format data for chart
    return timePeriods.map(period => {
      const periodData = timeMap[period];
      const avgTime = periodData.totalOrders > 0 
        ? periodData.totalTime / periodData.totalOrders 
        : 0;
      const breachPct = periodData.totalOrders > 0 
        ? (periodData.slaBreaches / periodData.totalOrders) * 100 
        : 0;
      
      // Calculate quartiles for boxplot
      const sortedTimes = [...periodData.avgTimes].sort((a, b) => a - b);
      const q1 = sortedTimes[Math.floor(sortedTimes.length * 0.25)] || 0;
      const q2 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;  // median
      const q3 = sortedTimes[Math.floor(sortedTimes.length * 0.75)] || 0;
      const min = sortedTimes[0] || 0;
      const max = sortedTimes[sortedTimes.length - 1] || 0;
        
      return {
        name: period,
        breachPct: Math.round(breachPct * 10) / 10,
        avgTime: Math.round(avgTime * 10) / 10,
        totalOrders: periodData.totalOrders,
        // Boxplot data
        min,
        q1,
        median: q2,
        q3,
        max
      };
    });
  } catch (err) {
    console.error('Error aggregating time period data:', err);
    return [];
  }
};

// Function to aggregate driver zone performance data
export const aggregateDriverZonePerformance = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  try {
    // Group by zone
    const zoneMap = {};
    
    data.forEach(item => {
      if (!item.zone) return;
      
      if (!zoneMap[item.zone]) {
        zoneMap[item.zone] = {
          totalOrders: 0,
          totalTime: 0,
          slaBreaches: 0,
          avgDelay: 0,
          // Track count separately to calculate proper averages
          dataPoints: 0
        };
      }
      
      const orders = typeof item.orders === 'string' 
        ? parseInt(item.orders) 
        : item.orders || 0;
      
      const avgDeliveryMin = typeof item.avg_delivery_min === 'string'
        ? parseFloat(item.avg_delivery_min)
        : item.avg_delivery_min || 0;
      
      // Calculate delay as delivery time - SLA threshold (45 min)
      const slaThreshold = 45;
      const delay = Math.max(0, avgDeliveryMin - slaThreshold);
      
      zoneMap[item.zone].totalOrders += orders;
      zoneMap[item.zone].totalTime += avgDeliveryMin * orders;
      zoneMap[item.zone].avgDelay = (zoneMap[item.zone].avgDelay * zoneMap[item.zone].dataPoints + delay) / (zoneMap[item.zone].dataPoints + 1);
      zoneMap[item.zone].dataPoints += 1;
      
      if (avgDeliveryMin > slaThreshold) {
        zoneMap[item.zone].slaBreaches += orders;
      }
    });
    
    // Format data for chart and sort by total orders
    return Object.keys(zoneMap).map(zone => {
      const zoneData = zoneMap[zone];
      const avgTime = zoneData.totalOrders > 0 
        ? zoneData.totalTime / zoneData.totalOrders 
        : 0;
      const breachPct = zoneData.totalOrders > 0 
        ? (zoneData.slaBreaches / zoneData.totalOrders) * 100 
        : 0;
        
      return {
        name: zone,
        totalOrders: zoneData.totalOrders,
        avgTime: Math.round(avgTime * 10) / 10,
        avgDelay: Math.round(zoneData.avgDelay * 10) / 10,
        breachPct: Math.round(breachPct * 10) / 10
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders);
  } catch (err) {
    console.error('Error aggregating driver zone performance data:', err);
    return [];
  }
}; 