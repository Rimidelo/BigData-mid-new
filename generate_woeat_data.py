# generate_woeat_data.py
import json, csv, os, random
from datetime import datetime, timedelta
from faker import Faker
import pandas as pd
fake = Faker()

BASE = "woeat_demo"
START_DATE = datetime(2024, 4, 1)
DAYS = 7

# 1. helpers
def ensure(path):
    os.makedirs(path, exist_ok=True)

def daterange():
    for d in range(DAYS):
        yield START_DATE + timedelta(days=d)

# 2. seed dimension lists
restaurants = [
    {"restaurant_id": f"R{300+i}",
     "name": fake.company() + " Kitchen",
     "cuisine": random.choice(["Italian","Japanese","Mexican","Vegan","Burgers"]),
     "zone": random.choice(["Z1","Z2"])}
    for i in range(50)
]

drivers = [
    {"driver_id": f"D{200+i}",
     "name": fake.first_name(),
     "rating": round(random.uniform(4.0,4.9),2),
     "zone": random.choice(["Z1","Z2"])}
    for i in range(200)
]

menu_items = []
for r in restaurants:
    for i in range(10):
        idx = len(menu_items)+400
        menu_items.append({
            "item_id": f"M{idx}",
            "restaurant_id": r["restaurant_id"],
            "item_name": fake.word().capitalize()+" "+random.choice(["Bowl","Pizza","Roll","Salad","Burger"]),
            "category": r["cuisine"],
            "base_price": round(random.uniform(5,20),2)
        })

customers = [f"C{100+i}" for i in range(1000)]

# 3. generate Bronze files
orders = []
bronze_root = os.path.join(BASE,"bronze")
ensure(bronze_root)

for day in daterange():
    day_path = os.path.join(bronze_root,"orders_stream",day.strftime("%Y-%m-%d"))
    ensure(day_path)
    for _ in range(3000):                         # 3k orders per day
        order_time = day + timedelta(
            seconds=random.randint(0,86399))
        restaurant = random.choice(restaurants)
        items = random.sample(
            [m["item_id"] for m in menu_items if m["restaurant_id"]==restaurant["restaurant_id"]],
            random.randint(1,2))
        order = {
            "order_id": f"O-{len(orders)+1000}",
            "customer_id": random.choice(customers),
            "restaurant_id": restaurant["restaurant_id"],
            "driver_id": None,   # will assign later
            "items": items,
            "order_time": order_time.isoformat()+"Z",
            "status": "PLACED"
        }
        # save json
        with open(os.path.join(day_path, order["order_id"]+".json"),"w") as f:
            json.dump(order,f)
        orders.append(order)

# 4. drivers assignment & delivery updates
for o in orders:
    if random.random()<0.9:  # 90% delivered
        drv = random.choice(drivers)
        o["driver_id"]=drv["driver_id"]
        deliver_time = datetime.fromisoformat(o["order_time"][:-1])+timedelta(minutes=random.randint(20,70))
        o["delivery_time"]=deliver_time.isoformat()+"Z"
        o["status"]="DELIVERED"

# overwrite jsons with updated status
for o in orders:
    day = o["order_time"][:10]
    path = os.path.join(bronze_root,"orders_stream",day,o["order_id"]+".json")
    with open(path,"w") as f:
        json.dump(o,f)

# 5. restaurant performance CSVs (late)
perf_path = os.path.join(bronze_root,"restaurant_reports")
ensure(perf_path)
rows=[]
for day in daterange():
    for r in restaurants:
        row = {
            "report_date": day.strftime("%Y-%m-%d"),
            "restaurant_id": r["restaurant_id"],
            "avg_prep_time": random.randint(15,30),
            "avg_rating": round(random.uniform(3.5,4.8),1),
            "orders_count": random.randint(50,300),
            "cancel_rate": round(random.uniform(0.0,0.15),2),
            "avg_tip": round(random.uniform(0.0,3.0),2)
        }
        rows.append(row)
# write one big CSV (easier)
with open(os.path.join(perf_path,"restaurant_perf.csv"),"w",newline="") as f:
    writer=csv.DictWriter(f,fieldnames=rows[0].keys())
    writer.writeheader(); writer.writerows(rows)

# 6. menu dump files
menu_path=os.path.join(bronze_root,"menu_items"); ensure(menu_path)
for r in restaurants:
    dump=[m for m in menu_items if m["restaurant_id"]==r["restaurant_id"]]
    with open(os.path.join(menu_path,f"menu_{r['restaurant_id']}.json"),"w") as f:
        json.dump(dump,f)

# 7. driver roster
driver_path=os.path.join(bronze_root,"drivers"); ensure(driver_path)
pd.DataFrame(drivers).to_csv(os.path.join(driver_path,"drivers_2024-04-01.csv"),index=False)

# 8. weather API
weather_path=os.path.join(bronze_root,"weather_api"); ensure(weather_path)
for day in daterange():
    for hour in range(24):
        for zone in ["Z1","Z2"]:
            resp={
              "weather_time": (day+timedelta(hours=hour)).isoformat()+"Z",
              "temperature": round(random.uniform(15,32),1),
              "condition": random.choice(["Sunny","Clouds","Rain","Wind"])
            }
            fname=f"weather_{zone}_{day.strftime('%Y%m%d')}_{hour:02}.json"
            with open(os.path.join(weather_path,fname),"w") as f:
                json.dump(resp,f)

print("✅ Fake Bronze data generated in", bronze_root)
