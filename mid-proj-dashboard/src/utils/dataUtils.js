// Data utility functions for the dashboard
import axios from 'axios';

// Function to fetch actual data from the CSV file in public folder
export const fetchSLABreachData = async () => {
  try {
    console.log('Fetching CSV data from public folder...');
    const response = await axios.get('/data/kpi_delivery_daily.csv');
    console.log('Raw CSV data received:', response.data.substring(0, 200) + '...');
    const parsedData = parseCSV(response.data);
    console.log('Parsed data (first 2 items):', parsedData.slice(0, 2));
    return parsedData;
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    // Fallback to sample data if CSV loading fails
    console.log('Using fallback data');
    return [
      { order_date: '2024-04-01', zone: 'Z1', sla_breach_pct: 0.4842 },
      { order_date: '2024-04-01', zone: 'Z2', sla_breach_pct: 0.4775 },
      { order_date: '2024-04-02', zone: 'Z1', sla_breach_pct: 0.4992 },
      { order_date: '2024-04-02', zone: 'Z2', sla_breach_pct: 0.4525 },
    ];
  }
};

// Function to fetch cuisine performance data
export const fetchCuisineData = async () => {
  try {
    const response = await axios.get('/data/kpi_cuisine_performance.csv');
    return parseCSV(response.data);
  } catch (error) {
    console.error('Error fetching cuisine data:', error);
    return []; 
  }
};

// Function to fetch menu item sales data
export const fetchMenuItemData = async () => {
  try {
    const response = await axios.get('/data/kpi_menu_item_sales.csv');
    return parseCSV(response.data);
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

// Function to simulate live data updates - now uses actual data from days 6-7
export const fetchLiveUpdate = async () => {
  try {
    const response = await axios.get('/data/kpi_delivery_daily.csv');
    const allData = parseCSV(response.data);
    
    // Get the last 4 days of data (simulating new data coming in)
    const latestData = allData.slice(-4);
    console.log('Live update data:', latestData);
    return latestData;
  } catch (error) {
    console.error('Error fetching live update data:', error);
    // Fallback sample data
    return [
      { order_date: '2024-04-06', zone: 'Z1', sla_breach_pct: 0.4861 },
      { order_date: '2024-04-06', zone: 'Z2', sla_breach_pct: 0.5071 },
      { order_date: '2024-04-07', zone: 'Z1', sla_breach_pct: 0.5118 },
      { order_date: '2024-04-07', zone: 'Z2', sla_breach_pct: 0.4926 },
    ];
  }
};

// Function to simulate real-time order data
export const generateLiveOrder = () => {
  const zones = ['Z1', 'Z2'];
  const cuisines = ['Burgers', 'Italian', 'Japanese', 'Mexican', 'Vegan'];
  const statuses = ['completed', 'delivered', 'in_progress'];
  
  // Generate random order
  return {
    order_id: `ORD-${Math.floor(Math.random() * 100000)}`,
    timestamp: new Date().toISOString(),
    zone: zones[Math.floor(Math.random() * zones.length)],
    cuisine_type: cuisines[Math.floor(Math.random() * cuisines.length)],
    total_amount: Math.floor(Math.random() * 100) + 10,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    delivery_minutes: Math.floor(Math.random() * 60) + 15
  };
};

// Function to aggregate SLA breach data by zone
export const aggregateSLABreachByZone = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('Invalid data for aggregation:', data);
    return [];
  }

  try {
    const aggregatedData = data.reduce((acc, curr) => {
      if (!curr.zone || typeof curr.sla_breach_pct !== 'number') {
        console.warn('Skipping invalid data point:', curr);
        return acc;
      }
      
      const zoneData = acc.find(item => item.zone === curr.zone);
      if (zoneData) {
        zoneData.records.push(curr);
        zoneData.totalBreachPct += curr.sla_breach_pct;
        zoneData.count += 1;
      } else {
        acc.push({
          zone: curr.zone,
          records: [curr],
          totalBreachPct: curr.sla_breach_pct,
          count: 1
        });
      }
      return acc;
    }, []);
    
    return aggregatedData.map(item => ({
      zone: item.zone,
      averageSLABreachPct: (item.totalBreachPct / item.count) * 100,
      fill: item.zone === 'Z1' ? '#8884d8' : '#82ca9d'
    }));
  } catch (err) {
    console.error('Error aggregating data:', err);
    return [];
  }
};

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