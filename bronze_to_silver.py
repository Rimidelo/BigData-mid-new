# bronze_to_silver.py
import os, json, glob
import pandas as pd
from datetime import datetime

BRONZE = "woeat_demo/bronze"
SILVER = "woeat_demo/silver"
os.makedirs(SILVER, exist_ok=True)

def load_orders():
    rows=[]
    for f in glob.glob("woeat_demo/bronze*/orders_stream/*/*.json"):
        with open(f) as fp:
            rec=json.load(fp)
        rows.append({
            "order_id":      rec["order_id"],
            "customer_id":   rec["customer_id"],
            "restaurant_id": rec["restaurant_id"],
            "driver_id":     rec["driver_id"],
            "items":         ",".join(rec["items"]),
            "status":        rec["status"],
            "order_time":    pd.to_datetime(rec["order_time"]),
            "delivery_time": pd.to_datetime(rec.get("delivery_time")),
            "ingest_timestamp": datetime.utcfromtimestamp(os.path.getmtime(f))
        })
    df=pd.DataFrame(rows)
    df.to_csv(f"{SILVER}/silver_orders.csv", index=False)
    print("✓ silver_orders.csv written")

def load_restaurant_perf():
    df=pd.read_csv(f"{BRONZE}/restaurant_reports/restaurant_perf.csv",
                   parse_dates=["report_date"])
    df["ingest_timestamp"]=pd.Timestamp.utcnow()
    df.to_csv(f"{SILVER}/silver_restaurant_performance.csv", index=False)
    print("✓ silver_restaurant_performance.csv written")

def load_menu_items():
    frames=[]
    for f in glob.glob(f"{BRONZE}/menu_items/*.json"):
        frames.append(pd.read_json(f))
    df=pd.concat(frames, ignore_index=True)
    df["ingest_timestamp"]=pd.Timestamp.utcnow()
    df.to_csv(f"{SILVER}/silver_menu_items.csv", index=False)
    print("✓ silver_menu_items.csv written")

def load_drivers():
    df=pd.read_csv(f"{BRONZE}/drivers/drivers_2024-04-01.csv")
    df["ingest_timestamp"]=pd.Timestamp.utcnow()
    df.to_csv(f"{SILVER}/silver_drivers.csv", index=False)
    print("✓ silver_drivers.csv written")

def load_weather():
    rows=[]
    for f in glob.glob(f"{BRONZE}/weather_api/*.json"):
        zone=f.split("_")[1]           # weather_Z1_20240401_00.json
        with open(f) as fp:
            rec=json.load(fp)
        rows.append({
            "zone":zone,
            "weather_time":pd.to_datetime(rec["weather_time"]),
            "temperature":rec["temperature"],
            "condition":rec["condition"],
            "ingest_timestamp": datetime.utcfromtimestamp(os.path.getmtime(f))
        })
    pd.DataFrame(rows).to_csv(f"{SILVER}/silver_weather.csv", index=False)
    print("✓ silver_weather.csv written")

if __name__=="__main__":
    load_orders()
    load_restaurant_perf()
    load_menu_items()
    load_drivers()
    load_weather()
