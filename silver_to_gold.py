# silver_to_gold.py
import os, pandas as pd, numpy as np
from datetime import datetime

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

# 9. Daily KPI aggregate for dashboards
zone_lookup = dim_drivers.set_index("driver_key")["zone"].to_dict()
fact_orders["zone"] = fact_orders["driver_key"].map(zone_lookup)
fact_orders["order_date"] = pd.to_datetime(fact_orders["order_time"]).dt.date

kpi = (
    fact_orders.groupby(["order_date", "zone"])
    .agg(
        orders=("order_key", "count"),
        avg_delivery_min=("delivery_minutes", "mean"),
        sla_breach_pct=("sla_breached", "mean")
    )
    .reset_index()
)
kpi.to_csv(f"{KPI}/kpi_delivery_daily.csv", index=False)
print("✅  kpi_delivery_daily.csv written")

# 10. 📦 KPI: Driver Performance by Zone and Date
kpi_driver = (
    fact_orders.groupby(["order_date", "zone"])
    .agg(
        total_deliveries=("order_key", "count"),
        avg_delivery_minutes=("delivery_minutes", "mean"),
        sla_breach_pct=("sla_breached", "mean")
    )
    .reset_index()
)
kpi_driver.to_csv(f"{KPI}/kpi_driver_performance_daily.csv", index=False)
print("✅  kpi_driver_performance_daily.csv written")

# 11. 🍽️ KPI: Menu Item Sales by Category and Day
fact_order_items = pd.read_csv(f"{GOLD}/fact_order_items.csv")
order_items = fact_order_items.merge(
    dim_menu_items[["menu_item_key", "category"]],
    on="menu_item_key", how="left"
).merge(
    fact_orders[["order_key", "order_date"]],
    on="order_key", how="left"
)
kpi_items = (
    order_items.groupby(["order_date", "category"])
    .agg(
        total_items_sold=("quantity", "sum"),
        total_sales=("extended_price", "sum")
    )
    .reset_index()
)
kpi_items.to_csv(f"{KPI}/kpi_menu_item_sales.csv", index=False)
print("✅  kpi_menu_item_sales.csv written")

# 12. 🍱 KPI: Cuisine Performance by Day
fact_orders["cuisine_type"] = fact_orders["restaurant_key"].map(
    dim_restaurants.set_index("restaurant_key")["cuisine_type"]
)
kpi_cuisine = (
    fact_orders.groupby(["order_date", "cuisine_type"])
    .agg(
        orders=("order_key", "count"),
        avg_delivery_min=("delivery_minutes", "mean"),
        revenue=("total_amount", "sum")
    )
    .reset_index()
)
kpi_cuisine.to_csv(f"{KPI}/kpi_cuisine_performance.csv", index=False)
print("✅  kpi_cuisine_performance.csv written")


