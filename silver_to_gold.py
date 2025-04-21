# silver_to_gold.py
import os, pandas as pd, numpy as np
from datetime import datetime, timedelta

SILVER = "woeat_demo/silver"
import os

GOLD = "woeat_demo/gold"
KPI = "woeat_demo/kpi"

os.makedirs(GOLD, exist_ok=True)
os.makedirs(KPI, exist_ok=True)



# 1. load silver CSVs
orders   = pd.read_csv(f"{SILVER}/silver_orders.csv", parse_dates=["order_time","delivery_time"])
drivers  = pd.read_csv(f"{SILVER}/silver_drivers.csv")
menus    = pd.read_csv(f"{SILVER}/silver_menu_items.csv")
rest_perf= pd.read_csv(f"{SILVER}/silver_restaurant_performance.csv", parse_dates=["report_date"])

# 2. generate surrogate keys helpers
def make_surrogate(df, natural_col, key_name):
    """Return df with new surrogate key column and a dict natural->surrogate"""
    uniq = df[natural_col].drop_duplicates().reset_index(drop=True)
    mapping = {nat:i+1 for i, nat in uniq.items()}      # simple 1..N
    df[key_name] = df[natural_col].map(mapping)
    return mapping

rest_map  = make_surrogate(rest_perf[["restaurant_id"]].drop_duplicates(),
                           "restaurant_id","restaurant_key")
driver_map= make_surrogate(drivers,"driver_id","driver_key")
menu_map  = make_surrogate(menus,"item_id","menu_item_key")

# 3. build dim_restaurants (SCD‑2 with single current row)
dim_restaurants = rest_perf.groupby("restaurant_id").agg({
    "avg_prep_time":"last"
}).reset_index()
dim_restaurants["restaurant_key"] = dim_restaurants["restaurant_id"].map(rest_map)
dim_restaurants["cuisine_type"]   = dim_restaurants["restaurant_id"].apply(
    lambda rid: np.random.choice(["Italian","Japanese","Mexican","Vegan","Burgers"]))
dim_restaurants["active_flag"]    = True
dim_restaurants["record_start_date"] = "2024-04-01"
dim_restaurants["record_end_date"]   = "9999-12-31"
dim_restaurants["is_current"]        = True
dim_restaurants.to_csv(f"{GOLD}/dim_restaurants.csv", index=False)

# 4. dim_menu_items (static)
dim_menu_items = menus.copy()
dim_menu_items["menu_item_key"] = dim_menu_items["item_id"].map(menu_map)
dim_menu_items["restaurant_key"]= dim_menu_items["restaurant_id"].map(rest_map)
dim_menu_items.to_csv(f"{GOLD}/dim_menu_items.csv", index=False)

# 5. dim_drivers (single current row)
dim_drivers = drivers.copy()
dim_drivers["driver_key"] = dim_drivers["driver_id"].map(driver_map)
dim_drivers["record_start_date"] = "2024-04-01"
dim_drivers["record_end_date"]   = "9999-12-31"
dim_drivers["is_current"]        = True
dim_drivers.to_csv(f"{GOLD}/dim_drivers.csv", index=False)

# 6. fact_order_items  (explode items list correctly)
orders_exp = orders.copy()
orders_exp["items"] = orders_exp["items"].str.split(",")

# explode and keep the item_id column
order_items = (
    orders_exp
    .explode("items")
    .rename(columns={"items": "item_id"})      # keep as item_id
)

# add keys and prices BEFORE dropping columns
order_items["menu_item_key"] = order_items["item_id"].map(menu_map)
order_items["quantity"] = 1

# surrogate order_key
order_key_map = {oid: i + 1 for i, oid in enumerate(orders["order_id"])}
order_items["order_key"] = order_items["order_id"].map(order_key_map)

# price lookup
price_lookup = menus.set_index("item_id")["base_price"].to_dict()
order_items["extended_price"] = order_items["item_id"].map(price_lookup)

# final column order
order_items["order_item_key"] = range(1, len(order_items) + 1)
order_items = order_items[["order_item_key", "order_key",
                           "menu_item_key", "quantity", "extended_price"]]

order_items.to_csv(f"{GOLD}/fact_order_items.csv", index=False)


# 7. fact_orders
orders["order_key"] = orders["order_id"].map(order_key_map)
orders["driver_key"]= orders["driver_id"].map(driver_map)
orders["restaurant_key"]= orders["restaurant_id"].map(rest_map)

# total_amount per order (sum from order_items)
totals = order_items.groupby("order_key")["extended_price"].sum()
orders["total_amount"] = orders["order_key"].map(totals)

# delivery_minutes & SLA flag
orders["delivery_minutes"] = (orders["delivery_time"] - orders["order_time"]).dt.total_seconds()/60
orders["sla_breached"] = orders["delivery_minutes"] > 45
orders["inserted_at"] = datetime.utcnow()

fact_orders = orders[["order_key","order_id","driver_key","restaurant_key",
                      "order_time","delivery_time","status","total_amount",
                      "delivery_minutes","sla_breached","inserted_at"]]
fact_orders.to_csv(f"{GOLD}/fact_orders.csv", index=False)

print("✅ Gold CSVs created in", GOLD)

# 8. ML feature table
features = fact_orders[["order_key", "delivery_minutes"]].copy()

# --- synthetic distance (demo) ---
np.random.seed(42)
features["distance_km"] = np.random.uniform(1, 7, len(features)).round(1)

# --- driver rating ---
rating_lookup = dim_drivers.set_index("driver_key")["rating"].to_dict()
features["driver_rating"] = fact_orders["driver_key"].map(rating_lookup)

# --- weather condition (nearest hour) ---
weather = pd.read_csv(f"{SILVER}/silver_weather.csv", parse_dates=["weather_time"])
weather["hour"] = weather["weather_time"].dt.floor("H")
fact_orders["hour"] = pd.to_datetime(fact_orders["order_time"]).dt.floor("H")
weather_lookup = weather.set_index("hour")["condition"].to_dict()
features["weather_condition"] = fact_orders["hour"].map(weather_lookup)

# --- time-of-day bucket ---
features["time_of_day"] = (
    pd.to_datetime(fact_orders["order_time"]).dt.hour
    .apply(lambda h: "Morning" if 6 <= h < 12
           else "Afternoon" if 12 <= h < 18
           else "Evening")
)

# save
features.to_csv(f"{GOLD}/ml_delivery_features.csv", index=False)
print("✅ ml_delivery_features.csv written")

# Generate synthetic order dates for a 90-day period - MUCH more data
start_date = datetime(2024, 1, 1)  # Start from January for more history
dates = [start_date + timedelta(days=i) for i in range(90)]  # Generate 90 days of data
date_strs = [d.strftime("%Y-%m-%d") for d in dates]

# Expand zones to add more granularity
original_zones = dim_drivers["zone"].unique()
zones = ["Z1", "Z2", "Z3", "Z4", "Z5"]  # Add more zones

# Time periods within a day to add more granularity
time_periods = ["Morning", "Afternoon", "Evening", "Night"]

# 9. Generate MUCH more KPI data for dashboards
# Create highly detailed delivery KPI data with many more rows
print("Generating massive amounts of KPI data...")
kpi_data = []

# Set random seed for reproducibility
np.random.seed(123)

for date_str in date_strs:
    for zone in zones:
        for period in time_periods:
            # Base values with some randomness
            base_orders = np.random.randint(200, 500)
            
            # Make delivery times vary by zone, time period, and have trend over time
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            day_of_week = date_obj.weekday()
            day_of_year = date_obj.timetuple().tm_yday
            
            # Zone factors - higher numbers = worse performance
            zone_factor = {
                "Z1": 1.08, 
                "Z2": 1.02,
                "Z3": 0.95,
                "Z4": 0.90,
                "Z5": 1.05
            }.get(zone, 1.0)
            
            # Time of day factors - evening rush hour is worse
            period_factor = {
                "Morning": 0.92,
                "Afternoon": 1.0,
                "Evening": 1.15,
                "Night": 0.88
            }.get(period, 1.0)
            
            # Seasonal trend (getting better as months progress)
            seasonal_improvement = max(0, 1.0 - (day_of_year / 365 * 0.15))
            
            # Weekend factor
            weekend_factor = 1.12 if day_of_week >= 5 else 1.0
            
            # Apply all factors to base delivery time
            base_avg_time = 38 * zone_factor * period_factor * seasonal_improvement * weekend_factor
            base_avg_time += np.random.normal(0, 2)  # Add some noise
            
            # Breach percentage calculation
            # Higher when delivery time is higher
            breach_likelihood = max(0, min(0.8, (base_avg_time - 35) / 20))
            # Add some randomness
            breach_pct = max(0.1, min(0.9, breach_likelihood + np.random.normal(0, 0.05)))
            
            kpi_data.append({
                'order_date': date_str,
                'time_period': period,
                'zone': zone,
                'orders': base_orders,
                'avg_delivery_min': round(base_avg_time, 2),
                'sla_breach_pct': round(breach_pct, 4)
            })

kpi_delivery = pd.DataFrame(kpi_data)
kpi_delivery.to_csv(f"{KPI}/kpi_delivery_daily.csv", index=False)
print(f"✅ kpi_delivery_daily.csv written with {len(kpi_delivery)} rows")

# 10. Driver Performance KPI with more data
# Similar to delivery KPI but with driver-specific metrics
kpi_driver = kpi_delivery.copy()
kpi_driver.rename(columns={
    'orders': 'total_deliveries',
    'avg_delivery_min': 'avg_delivery_minutes'
}, inplace=True)
kpi_driver.to_csv(f"{KPI}/kpi_driver_performance_daily.csv", index=False)
print(f"✅ kpi_driver_performance_daily.csv written with {len(kpi_driver)} rows")

# 11. Menu Item Sales with MUCH more data
# Expand categories for more granularity
categories = [
    "Main Course", "Appetizer", "Dessert", "Beverage", "Side Dish", 
    "Breakfast", "Lunch Special", "Dinner Special", "Healthy Option", "Combo Meal"
]
kpi_items_data = []

for date_str in date_strs:
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    day_of_week = date_obj.weekday()
    month = date_obj.month
    
    for category in categories:
        for period in time_periods:
            # Different patterns by category, time period, and seasonality
            # Apply multiple factors to create realistic patterns
            
            # Base demand varies by category
            if category == "Main Course":
                base_items = np.random.randint(250, 400)
                avg_price = np.random.uniform(15, 25)
            elif category == "Appetizer":
                base_items = np.random.randint(180, 300)
                avg_price = np.random.uniform(8, 12)
            elif category == "Dessert":
                base_items = np.random.randint(80, 150)
                avg_price = np.random.uniform(6, 10)
            elif category == "Beverage":
                base_items = np.random.randint(200, 350)
                avg_price = np.random.uniform(3, 7)
            elif category == "Side Dish":
                base_items = np.random.randint(120, 250)
                avg_price = np.random.uniform(5, 9)
            elif category == "Breakfast":
                base_items = np.random.randint(100, 200) if period == "Morning" else np.random.randint(10, 30)
                avg_price = np.random.uniform(10, 18)
            elif category == "Lunch Special":
                base_items = np.random.randint(150, 300) if period == "Afternoon" else np.random.randint(20, 50)
                avg_price = np.random.uniform(12, 20)
            elif category == "Dinner Special":
                base_items = np.random.randint(180, 350) if period == "Evening" else np.random.randint(30, 70)
                avg_price = np.random.uniform(18, 30)
            elif category == "Healthy Option":
                # Healthy options trending up in January (new year resolutions)
                resolution_boost = 1.3 if month == 1 else 1.0
                base_items = int(np.random.randint(50, 120) * resolution_boost)
                avg_price = np.random.uniform(12, 22)
            else:  # Combo Meal
                base_items = np.random.randint(100, 200)
                avg_price = np.random.uniform(20, 35)
            
            # Apply time period effects
            period_multiplier = {
                "Morning": 1.0 if category == "Breakfast" else 0.7,
                "Afternoon": 1.2 if category == "Lunch Special" else 0.9,
                "Evening": 1.3 if category == "Dinner Special" else 1.1,
                "Night": 0.8 if category in ["Beverage", "Dessert"] else 0.5
            }.get(period, 1.0)
            
            # Weekend effects
            weekend_multiplier = 1.4 if day_of_week >= 5 else 1.0
            
            # Calculate final quantity with all factors
            final_quantity = int(base_items * period_multiplier * weekend_multiplier)
            
            # Add random price fluctuations (sales, promotions)
            if np.random.random() < 0.1:  # 10% chance of promotion
                avg_price *= 0.85  # 15% discount
            
            # Calculate total sales
            total_sales = final_quantity * avg_price
            
            kpi_items_data.append({
                'order_date': date_str,
                'time_period': period,
                'category': category,
                'total_items_sold': final_quantity,
                'total_sales': round(total_sales, 2)
            })

kpi_items = pd.DataFrame(kpi_items_data)
kpi_items.to_csv(f"{KPI}/kpi_menu_item_sales.csv", index=False)
print(f"✅ kpi_menu_item_sales.csv written with {len(kpi_items)} rows")

# 12. Cuisine Performance with much more data
# Expand cuisines for more variety
cuisines = [
    "Italian", "Japanese", "Mexican", "Vegan", "Burgers", 
    "Chinese", "Thai", "Indian", "American", "Mediterranean"
]
kpi_cuisine_data = []

for date_str in date_strs:
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    day_of_week = date_obj.weekday()
    day_of_year = date_obj.timetuple().tm_yday
    month = date_obj.month
    
    for cuisine in cuisines:
        for period in time_periods:
            # Different patterns by cuisine, time period, etc.
            
            # Cuisine-specific base values
            if cuisine == "Mexican":
                weekend_boost = 1.4 if day_of_week >= 5 else 1.0
                base_orders = int(np.random.randint(60, 110) * weekend_boost)
                revenue_per_order = np.random.uniform(20, 30)
                delivery_min = np.random.normal(48, 5)  # Slightly above SLA
            elif cuisine == "Italian":
                base_orders = np.random.randint(80, 140)
                revenue_per_order = np.random.uniform(25, 35)
                delivery_min = np.random.normal(40, 4)
            elif cuisine == "Japanese":
                base_orders = np.random.randint(50, 90)
                revenue_per_order = np.random.uniform(30, 45)
                delivery_min = np.random.normal(42, 3)
            elif cuisine == "Vegan":
                # Trending up over time (healthier choices)
                trend_factor = 1 + (day_of_year / 365 * 0.5)  # 50% increase over year
                base_orders = int(np.random.randint(30, 60) * trend_factor)
                revenue_per_order = np.random.uniform(18, 28)
                delivery_min = np.random.normal(38, 4)
            elif cuisine == "Burgers":
                base_orders = np.random.randint(70, 120)
                revenue_per_order = np.random.uniform(15, 25)
                delivery_min = np.random.normal(35, 3)
            elif cuisine == "Chinese":
                # Popular for dinner and weekends
                dinner_boost = 1.3 if period == "Evening" else 1.0
                base_orders = int(np.random.randint(60, 100) * dinner_boost)
                revenue_per_order = np.random.uniform(20, 30)
                delivery_min = np.random.normal(37, 4)
            elif cuisine == "Thai":
                base_orders = np.random.randint(40, 80)
                revenue_per_order = np.random.uniform(22, 32)
                delivery_min = np.random.normal(43, 3)
            elif cuisine == "Indian":
                # More popular for dinner
                evening_boost = 1.4 if period == "Evening" else 1.0
                base_orders = int(np.random.randint(35, 75) * evening_boost)
                revenue_per_order = np.random.uniform(25, 40)
                delivery_min = np.random.normal(45, 4)
            elif cuisine == "American":
                # Popular for lunch
                lunch_boost = 1.3 if period == "Afternoon" else 1.0
                base_orders = int(np.random.randint(65, 110) * lunch_boost)
                revenue_per_order = np.random.uniform(18, 28)
                delivery_min = np.random.normal(36, 3)
            else:  # Mediterranean
                # Healthy option, more popular in summer
                summer_boost = 1.2 if month in [6, 7, 8] else 1.0
                base_orders = int(np.random.randint(30, 70) * summer_boost)
                revenue_per_order = np.random.uniform(23, 33)
                delivery_min = np.random.normal(41, 3)
            
            # Time period effects
            period_factor = {
                "Morning": 0.6,  # Fewer orders in morning
                "Afternoon": 1.1,  # Good lunch business
                "Evening": 1.4,  # Dinner peak
                "Night": 0.9   # Late night
            }.get(period, 1.0)
            
            # Weather effects (simulate some days with bad weather)
            weather_factor = 1.0
            # Simulate bad weather days randomly
            if np.random.random() < 0.15:  # 15% of days have bad weather
                weather_factor = 1.3  # Delivery takes longer in bad weather
                delivery_min *= weather_factor
            
            # Weekend factor for delivery time
            weekend_delivery_factor = 1.08 if day_of_week >= 5 else 1.0
            
            # Apply all factors
            final_orders = int(base_orders * period_factor)
            final_delivery_min = delivery_min * weekend_delivery_factor
            
            # Total revenue
            revenue = final_orders * revenue_per_order
            
            kpi_cuisine_data.append({
                'order_date': date_str,
                'time_period': period,
                'cuisine_type': cuisine,
                'orders': final_orders,
                'avg_delivery_min': round(final_delivery_min, 2),
                'revenue': round(revenue, 2)
            })

kpi_cuisine = pd.DataFrame(kpi_cuisine_data)
kpi_cuisine.to_csv(f"{KPI}/kpi_cuisine_performance.csv", index=False)
print(f"✅ kpi_cuisine_performance.csv written with {len(kpi_cuisine)} rows")

print("\n✅ MASSIVELY enhanced KPI generation complete!")
print(f"Total rows generated across all KPI files: {len(kpi_delivery) + len(kpi_driver) + len(kpi_items) + len(kpi_cuisine)}")


