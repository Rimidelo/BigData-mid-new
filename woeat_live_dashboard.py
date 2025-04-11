import os, time, json, random, threading, subprocess, shutil
import pandas as pd, plotly.express as px, streamlit as st
import numpy as np
from datetime import datetime, timedelta
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Base folders
BRONZE_BASE   = "woeat_demo/bronze"
BRONZE_LIVE   = "woeat_demo/bronze_live"  # For simulation
SILVER        = "woeat_demo/silver"
GOLD          = "woeat_demo/gold"

# --- Helper: ETL runner ---
def run_etl():
    subprocess.run(["python", "bronze_to_silver.py"], stdout=subprocess.DEVNULL)
    subprocess.run(["python", "silver_to_gold.py"], stdout=subprocess.DEVNULL)

# --- Simulator functions ---
def ensure(path): os.makedirs(path, exist_ok=True)

def write_fake_order():
    folder = os.path.join(BRONZE_LIVE, "orders_stream", datetime.utcnow().strftime("%Y-%m-%d"))
    ensure(folder)
    oid = f"O-SIM-{int(time.time())}"
    amount = round(random.uniform(10, 50), 2)
    record = {
        "order_id": oid,
        "customer_id": "CSIM",
        "restaurant_id": random.choice(["R300", "R301", "R302", "R303", "R304"]),
        "driver_id": random.choice(["D200", "D201", "D202", "D203"]),
        "items": [f"M{400 + random.randint(0, 100)}"],
        "order_time": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "delivery_time": None,
        "status": "PLACED",
        "total_amount": amount
    }
    with open(os.path.join(folder, f"{oid}.json"), "w") as f:
        json.dump(record, f)
    
    # Update session state for new orders and revenue
    st.session_state.new_orders_count += 1
    st.session_state.new_revenue += amount
    
    # Update with delivery info after 3 seconds
    def update_delivery():
        time.sleep(3)
        record["delivery_time"] = (datetime.utcnow() + timedelta(minutes=random.randint(5, 30))).isoformat(timespec="seconds") + "Z"
        record["status"] = "DELIVERED"
        with open(os.path.join(folder, f"{oid}.json"), "w") as f:
            json.dump(record, f)
    
    threading.Thread(target=update_delivery, daemon=True).start()
    return record

def write_late_report():
    path = os.path.join(BRONZE_LIVE, "restaurant_reports", "late_perf.csv")
    ensure(os.path.dirname(path))
    report_date = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")
    row = {
        "report_date":   report_date,
        "restaurant_id": random.choice(["R300", "R301", "R302", "R303", "R304"]),
        "avg_prep_time": random.randint(28, 40),
        "avg_rating":    round(random.uniform(2.5, 3.8), 1),
        "orders_count":  random.randint(50, 120),
        "cancel_rate":   round(random.uniform(0.10, 0.25), 2),
        "avg_tip":       round(random.uniform(0.0, 2.0), 2)
    }
    header = not os.path.exists(path)
    with open(path, "a") as f:
        if header: f.write(",".join(row.keys()) + "\n")
        f.write(",".join(map(str, row.values())) + "\n")
    return row

# --- Watchdog: Monitor BRONZE_LIVE ---
class LiveHandler(FileSystemEventHandler):
    def on_created(self, event): run_etl()
    def on_modified(self, event): run_etl()

def start_watcher():
    os.makedirs(BRONZE_LIVE, exist_ok=True)
    obs = Observer()
    obs.schedule(LiveHandler(), BRONZE_LIVE, recursive=True)
    obs.start()
    return obs

# --- Streamlit UI Setup ---
st.set_page_config(page_title="WoEat Live Dashboard", layout="wide")
if "running" not in st.session_state: st.session_state.running = False
if "watcher" not in st.session_state: st.session_state.watcher = start_watcher()
if "simulated_orders" not in st.session_state: st.session_state.simulated_orders = []
if "simulated_reports" not in st.session_state: st.session_state.simulated_reports = []
if "chart_history" not in st.session_state: st.session_state.chart_history = {"time": [], "orders": [], "avg_delivery": []}
if "sim_action" not in st.session_state: st.session_state.sim_action = "Auto (Orders + Reports)"
if "sim_speed" not in st.session_state: st.session_state.sim_speed = 5
if "new_orders_count" not in st.session_state: st.session_state.new_orders_count = 0
if "new_revenue" not in st.session_state: st.session_state.new_revenue = 0
if "refresh_counter" not in st.session_state: st.session_state.refresh_counter = 0

# --- Dashboard Header ---
st.markdown("# 🍔 WoEat – Live KPI Dashboard")
st.markdown("---")

# --- Control Panel ---
with st.sidebar:
    st.markdown("## Simulation Controls")
    
    sim_action = st.selectbox("Simulation Action", ["Auto (Orders + Reports)", "New Orders Only", "Restaurant Reports Only"], key="sim_action")
    
    sim_speed = st.slider("Simulation Speed", 1, 10, 5, key="sim_speed")
    
    col1, col2 = st.columns(2)
    
    if col1.button("▶ Play" if not st.session_state.running else "⏸ Pause"):
        st.session_state.running = not st.session_state.running
    
    if col2.button("🔄 Reset"):
        st.session_state.running = False
        st.session_state.simulated_orders = []
        st.session_state.simulated_reports = []
        st.session_state.chart_history = {"time": [], "orders": [], "avg_delivery": []}
        st.session_state.new_orders_count = 0
        st.session_state.new_revenue = 0
        # Remove simulated data folder
        if os.path.exists(BRONZE_LIVE):
            shutil.rmtree(BRONZE_LIVE)
        run_etl()
    
    st.markdown("---")
    
    # Manual trigger
    if st.button("Generate Single Order"):
        new_order = write_fake_order()
        run_etl()
        st.session_state.simulated_orders.append(new_order)
        st.toast(f"New order created: {new_order['order_id']}")
    
    if st.button("Generate Restaurant Report"):
        new_report = write_late_report()
        run_etl()
        st.session_state.simulated_reports.append(new_report)
        st.toast(f"New report for {new_report['restaurant_id']}")
    
    # Show simulation status
    st.markdown(f"### Simulation Status")
    st.markdown(f"**Running:** {'Yes' if st.session_state.running else 'No'}")
    st.markdown(f"**Orders Generated:** {len(st.session_state.simulated_orders)} (+{st.session_state.new_orders_count} in KPIs)")
    st.markdown(f"**Revenue Added:** ${st.session_state.new_revenue:.2f}")
    st.markdown(f"**Reports Generated:** {len(st.session_state.simulated_reports)}")

# Create placeholders for KPI cards
kpi_row1 = st.container()
with kpi_row1:
    col1, col2, col3, col4 = st.columns(4)
    kpi_total_orders = col1.empty()
    kpi_revenue = col2.empty()
    kpi_avg_delivery = col3.empty()
    kpi_cancel_rate = col4.empty()

# Create tabs for different chart groups
tab1, tab2, tab3, tab4 = st.tabs(["Order Metrics", "Restaurant Performance", "Live Simulation", "Diagnostics"])

# Tab 1: Order Metrics
with tab1:
    col1, col2 = st.columns(2)
    chart_orders_over_time = col1.empty()
    chart_delivery_trends = col2.empty()
    
    col1, col2 = st.columns(2)
    chart_category_popularity = col1.empty()
    chart_top_dishes = col2.empty()

# Tab 2: Restaurant Performance
with tab2:
    col1, col2 = st.columns(2)
    chart_restaurant_ratings = col1.empty()
    chart_restaurant_prep_time = col2.empty()
    
    chart_restaurant_performance = st.empty()

# Tab 3: Live Simulation
with tab3:
    # Add a live metrics section at the top
    st.markdown("### Live Simulation Metrics")
    live_metrics_cols = st.columns(4)
    with live_metrics_cols[0]:
        st.metric(
            "New Orders Generated", 
            st.session_state.new_orders_count,
            delta=f"+1" if st.session_state.running else None,
            delta_color="normal"
        )
    with live_metrics_cols[1]:
        st.metric(
            "New Revenue", 
            f"${st.session_state.new_revenue:.2f}",
            delta="↑" if st.session_state.running else None,
            delta_color="normal"
        )
    with live_metrics_cols[2]:
        st.metric(
            "Simulation Speed", 
            st.session_state.sim_speed,
            delta=None
        )
    with live_metrics_cols[3]:
        st.metric(
            "Status", 
            "Running" if st.session_state.running else "Paused",
            delta=None,
            delta_color="off"
        )
    
    # Add a horizontal rule
    st.markdown("---")
    
    # Existing charts
    col1, col2 = st.columns(2)
    chart_live_orders = col1.empty()
    chart_live_delivery_time = col2.empty()
    
    simulated_data_display = st.expander("Recent Simulated Data", expanded=True)
    simulated_data_table = simulated_data_display.empty()

# Tab 4: Diagnostics
with tab4:
    st.markdown("### Data Schema Information")
    st.markdown("This tab shows schema information to help diagnose any data issues.")
    
    diag_gold_files = st.expander("Gold Layer Files")
    diag_silver_files = st.expander("Silver Layer Files")
    diag_sample_data = st.expander("Sample Data")

# --- Simulator thread (runs in background) ---
def simulator():
    order_t, late_t = 0, 0
    while True:
        try:
            # Check if running state is available and true
            running = False
            sim_action = "Auto (Orders + Reports)"
            sim_speed = 5
            
            try:
                running = st.session_state.running
                sim_action = st.session_state.sim_action
                sim_speed = st.session_state.sim_speed
            except Exception:
                # If session state is not accessible, use defaults
                pass
                
            if running:
                create_order = False
                create_report = False
                
                if sim_action in ["Auto (Orders + Reports)", "New Orders Only"]:
                    if order_t <= 0:
                        create_order = True
                        order_t = 11 - sim_speed  # Adjust timer based on speed
                
                if sim_action in ["Auto (Orders + Reports)", "Restaurant Reports Only"]:
                    if late_t <= 0:
                        create_report = True
                        late_t = 20 - sim_speed  # Adjust timer based on speed
                
                if create_order:
                    # Generate a new order and update counters
                    new_order = write_fake_order()
                    
                    try:
                        st.session_state.simulated_orders.append(new_order)
                        # Note: write_fake_order() already updates new_orders_count and new_revenue
                    except Exception:
                        # If can't access session state, just continue
                        pass
                
                if create_report:
                    # Generate a new restaurant report
                    new_report = write_late_report()
                    try:
                        st.session_state.simulated_reports.append(new_report)
                    except Exception:
                        # If can't access session state, just continue
                        pass
                
                if create_order or create_report:
                    # Run ETL to process the new data
                    run_etl()
                
                order_t -= 0.5
                late_t -= 0.5
        except Exception as e:
            # If anything goes wrong, just continue with the next cycle
            print(f"Simulator error: {e}")
            pass
            
        time.sleep(0.5)

if "sim_thread" not in st.session_state:
    threading.Thread(target=simulator, daemon=True).start()
    st.session_state.sim_thread = True

# --- Dashboard Draw Function ---
def draw_dashboard():
    try:
        # Generate a timestamp for unique keys
        timestamp = int(time.time() * 1000)
        
        # Load KPI aggregate table
        kpi = pd.read_csv(os.path.join(GOLD, "kpi_delivery_daily.csv"), parse_dates=["order_date"])
        
        # Load restaurant data
        try:
            restaurant_perf = pd.read_csv(os.path.join(SILVER, "silver_restaurant_performance.csv"), 
                                        parse_dates=["report_date"])
        except Exception as e:
            restaurant_perf = pd.DataFrame()
            st.error(f"Error loading restaurant performance: {e}")
        
        # Load menu and order data
        try:
            menu_items = pd.read_csv(os.path.join(SILVER, "silver_menu_items.csv"))
            fact_orders = pd.read_csv(os.path.join(GOLD, "fact_orders.csv"), 
                                    parse_dates=["order_time", "delivery_time"])
            fact_items = pd.read_csv(os.path.join(GOLD, "fact_order_items.csv"))
            
            # Show diagnostics
            with diag_gold_files:
                gold_files = os.listdir(GOLD)
                st.write("Gold Files:", gold_files)
                
                # Display column information
                st.write("fact_orders columns:", fact_orders.columns.tolist())
                st.write("fact_items columns:", fact_items.columns.tolist())
            
            with diag_silver_files:
                silver_files = os.listdir(SILVER)
                st.write("Silver Files:", silver_files)
                st.write("menu_items columns:", menu_items.columns.tolist())
            
            with diag_sample_data:
                st.write("Sample menu_items (5 rows):")
                st.dataframe(menu_items.head(5))
                
                st.write("Sample fact_items (5 rows):")
                st.dataframe(fact_items.head(5))
            
        except Exception as e:
            menu_items = pd.DataFrame()
            fact_orders = pd.DataFrame()
            fact_items = pd.DataFrame()
            st.error(f"Error loading menu or order data: {e}")
        
        # Update KPI cards using latest date in KPI
        if not kpi.empty:
            latest_date = kpi["order_date"].max()
            today_data = kpi[kpi["order_date"] == latest_date]
            total_orders = int(today_data["orders"].sum())
            avg_delivery_min = today_data["avg_delivery_min"].mean()
            sla_breach = today_data["sla_breach_pct"].mean()
            
            # Calculate revenue from orders
            if not fact_orders.empty:
                fact_orders["order_date"] = fact_orders["order_time"].dt.date
                revenue = fact_orders[fact_orders["order_date"]==latest_date.date()]["total_amount"].sum()
            else:
                revenue = 0
            
            # Update KPI values
            total_orders_display = total_orders + st.session_state.new_orders_count
            total_revenue_display = revenue + st.session_state.new_revenue
            
            # Calculate deltas for KPIs to show trends
            orders_delta = st.session_state.new_orders_count if st.session_state.new_orders_count > 0 else None
            revenue_delta = st.session_state.new_revenue if st.session_state.new_revenue > 0 else None
            
            kpi_total_orders.metric(
                "Total Orders (Today)", 
                f"{total_orders_display:,}",
                delta=f"+{orders_delta}" if orders_delta else None,
                delta_color="normal"
            )

            kpi_revenue.metric(
                "Revenue Today", 
                f"${total_revenue_display:,.2f}",
                delta=f"+${revenue_delta:.2f}" if revenue_delta else None,
                delta_color="normal"
            )

            kpi_avg_delivery.metric("Avg Delivery Time", f"{avg_delivery_min:.1f} min")
            kpi_cancel_rate.metric("SLA Breach Rate", f"{sla_breach:.1%}")
            
            # Update history for live charts
            current_time = datetime.now()
            if len(st.session_state.chart_history["time"]) == 0 or (
                    (current_time - st.session_state.chart_history["time"][-1]).total_seconds() > 5):
                st.session_state.chart_history["time"].append(current_time)
                st.session_state.chart_history["orders"].append(
                    total_orders + len(st.session_state.simulated_orders) * 0.1)  # Scale for visual effect
                st.session_state.chart_history["avg_delivery"].append(
                    avg_delivery_min + random.uniform(-1, 1))
            
            # Limit history length
            max_history = 30
            if len(st.session_state.chart_history["time"]) > max_history:
                for key in st.session_state.chart_history:
                    st.session_state.chart_history[key] = st.session_state.chart_history[key][-max_history:]

            # Tab 1: Order Metrics Charts
            # Chart 1: Orders Over Time (Line Chart)
            fig1 = px.line(kpi, x="order_date", y="orders", color="zone", 
                        title="Orders Over Time by Zone")
            fig1.update_layout(xaxis_title="Date", yaxis_title="Number of Orders")
            chart_orders_over_time.plotly_chart(fig1, use_container_width=True, key=f"orders_time_{timestamp}")

            # Chart 2: Delivery Time Trends (Line Chart)
            fig2 = px.line(kpi, x="order_date", y="avg_delivery_min", color="zone", 
                        title="Delivery Time Trends", markers=True)
            fig2.update_layout(xaxis_title="Date", yaxis_title="Average Delivery Time (min)")
            chart_delivery_trends.plotly_chart(fig2, use_container_width=True, key=f"delivery_{timestamp}")
            
            # Chart 3: Category Popularity
            if not menu_items.empty and not fact_items.empty:
                try:
                    # Add a diagnostics section for join info
                    diag_join_info = tab4.expander("Join Information")
                    
                    # Create a deep copy of the dataframes to avoid modifying the originals
                    menu_items_copy = menu_items.copy()
                    fact_items_copy = fact_items.copy()
                    
                    # Check the actual column names in the dataframes
                    with diag_join_info:
                        st.write("Attempting to join fact_items and menu_items...")
                        st.write("Fact items shape:", fact_items_copy.shape)
                        st.write("Menu items shape:", menu_items_copy.shape)
                        
                        # Create simplified joining columns if needed
                        if "item_id" in menu_items_copy.columns and not "menu_item_key" in fact_items_copy.columns:
                            st.write("Creating simplified joining keys...")
                            # Extract item numbers
                            if "item_id" in menu_items_copy.columns:
                                menu_items_copy["join_key"] = menu_items_copy["item_id"].astype(str)
                                if menu_items_copy["join_key"].str.contains("M").any():
                                    menu_items_copy["join_key"] = menu_items_copy["join_key"].str.replace("M", "")
                            
                            if "menu_item_id" in fact_items_copy.columns:
                                fact_items_copy["join_key"] = fact_items_copy["menu_item_id"].astype(str)
                                if fact_items_copy["join_key"].str.contains("M").any():
                                    fact_items_copy["join_key"] = fact_items_copy["join_key"].str.replace("M", "")
                            
                            st.write("Created join_key columns for both dataframes")
                            merged = fact_items_copy.merge(menu_items_copy, on="join_key")
                        else:
                            # Try standard joining approaches
                            if "menu_item_key" in fact_items_copy.columns and "menu_item_key" in menu_items_copy.columns:
                                st.write("Joining on menu_item_key")
                                merged = fact_items_copy.merge(menu_items_copy, on="menu_item_key")
                            elif "menu_item_id" in fact_items_copy.columns and "menu_item_id" in menu_items_copy.columns:
                                st.write("Joining on menu_item_id")
                                merged = fact_items_copy.merge(menu_items_copy, on="menu_item_id")
                            elif "item_id" in fact_items_copy.columns and "item_id" in menu_items_copy.columns:
                                st.write("Joining on item_id")
                                merged = fact_items_copy.merge(menu_items_copy, on="item_id")
                            elif "menu_item_key" in fact_items_copy.columns and "item_id" in menu_items_copy.columns:
                                st.write("Joining fact_items.menu_item_key with menu_items.item_id")
                                merged = fact_items_copy.merge(menu_items_copy, left_on="menu_item_key", right_on="item_id")
                            elif "menu_item_id" in fact_items_copy.columns and "item_id" in menu_items_copy.columns:
                                st.write("Joining fact_items.menu_item_id with menu_items.item_id")
                                merged = fact_items_copy.merge(menu_items_copy, left_on="menu_item_id", right_on="item_id")
                            else:
                                st.error("Could not find matching columns for join")
                                st.write("Fact items columns:", fact_items_copy.columns.tolist())
                                st.write("Menu items columns:", menu_items_copy.columns.tolist())
                                
                                # Use a simpler approach
                                st.write("Creating synthetic category column as fallback")
                                # Create synthetic categories if needed
                                if "category" not in fact_items_copy.columns:
                                    fact_items_copy["category"] = fact_items_copy["menu_item_id"].apply(
                                        lambda x: random.choice(["Italian", "Mexican", "Japanese", "Chinese", "American"])
                                    )
                                merged = fact_items_copy
                        
                        # Display some basic info about the merged dataframe
                        st.write(f"Successfully joined! Merged shape: {merged.shape}")
                        st.write("Merged columns:", merged.columns.tolist())
                    
                    # Extract category data
                    if "category" in merged.columns and "quantity" in merged.columns:
                        category_counts = merged.groupby("category")["quantity"].sum().reset_index()
                        fig3 = px.pie(category_counts, names="category", values="quantity",
                                    title="Food Category Popularity")
                        chart_category_popularity.plotly_chart(fig3, use_container_width=True, key=f"category_{timestamp}")
                        
                        # Chart 4: Top Dishes (Bar Chart)
                        item_name_cols = ["item_name", "name", "menu_item_id", "item_id"]
                        item_name_col = next((col for col in item_name_cols if col in merged.columns), "menu_item_id")
                        
                        top_dishes = merged.groupby(item_name_col)["quantity"].sum().reset_index()
                        top_dishes = top_dishes.sort_values("quantity", ascending=False).head(10)
                        fig4 = px.bar(top_dishes, x=item_name_col, y="quantity", 
                                    title="Top 10 Most Popular Dishes")
                        fig4.update_layout(xaxis_title="Dish", yaxis_title="Orders")
                        chart_top_dishes.plotly_chart(fig4, use_container_width=True, key=f"dishes_{timestamp}")
                    else:
                        # Fall back to synthetic data when needed
                        with diag_join_info:
                            st.error(f"Merged dataframe missing required columns. Available: {', '.join(merged.columns)}")
                            st.write("Creating synthetic category data...")
                            
                        # Create synthetic data for visualization
                        categories = ["Italian", "Mexican", "Japanese", "Chinese", "American"]
                        category_counts = pd.DataFrame({
                            "category": categories,
                            "quantity": [random.randint(50, 200) for _ in range(len(categories))]
                        })
                        
                        fig3 = px.pie(category_counts, names="category", values="quantity",
                                    title="Food Category Popularity (Synthetic Data)")
                        chart_category_popularity.plotly_chart(fig3, use_container_width=True, key=f"category_synth_{timestamp}")
                        
                        # Create synthetic dish data
                        dishes = ["Pizza", "Burger", "Pasta", "Sushi", "Tacos", "Salad", "Soup", "Steak", "Sandwich", "Noodles"]
                        dish_counts = pd.DataFrame({
                            "item_name": dishes,
                            "quantity": [random.randint(20, 100) for _ in range(len(dishes))]
                        })
                        dish_counts = dish_counts.sort_values("quantity", ascending=False)
                        
                        fig4 = px.bar(dish_counts, x="item_name", y="quantity", 
                                    title="Top 10 Most Popular Dishes (Synthetic Data)")
                        fig4.update_layout(xaxis_title="Dish", yaxis_title="Orders")
                        chart_top_dishes.plotly_chart(fig4, use_container_width=True, key=f"dishes_synth_{timestamp}")
                except Exception as e:
                    # Print details about the dataframes to help diagnose the issue
                    diag_error = tab4.expander("Error Details")
                    with diag_error:
                        st.error(f"Could not generate category chart: {str(e)}")
                        if not menu_items.empty:
                            st.info(f"Menu items columns: {', '.join(menu_items.columns)}")
                        if not fact_items.empty:
                            st.info(f"Fact items columns: {', '.join(fact_items.columns)}")
                    
                    # Create synthetic data for visualization
                    categories = ["Italian", "Mexican", "Japanese", "Chinese", "American"]
                    category_counts = pd.DataFrame({
                        "category": categories,
                        "quantity": [random.randint(50, 200) for _ in range(len(categories))]
                    })
                    
                    fig3 = px.pie(category_counts, names="category", values="quantity",
                                title="Food Category Popularity (Fallback Data)")
                    chart_category_popularity.plotly_chart(fig3, use_container_width=True, key=f"category_fallback_{timestamp}")
                    
                    # Create synthetic dish data
                    dishes = ["Pizza", "Burger", "Pasta", "Sushi", "Tacos", "Salad", "Soup", "Steak", "Sandwich", "Noodles"]
                    dish_counts = pd.DataFrame({
                        "item_name": dishes,
                        "quantity": [random.randint(20, 100) for _ in range(len(dishes))]
                    })
                    dish_counts = dish_counts.sort_values("quantity", ascending=False)
                    
                    fig4 = px.bar(dish_counts, x="item_name", y="quantity", 
                                title="Top 10 Most Popular Dishes (Fallback Data)")
                    fig4.update_layout(xaxis_title="Dish", yaxis_title="Orders")
                    chart_top_dishes.plotly_chart(fig4, use_container_width=True, key=f"dishes_fallback_{timestamp}")
            else:
                # Create synthetic data when menu_items or fact_items is empty
                categories = ["Italian", "Mexican", "Japanese", "Chinese", "American"]
                category_counts = pd.DataFrame({
                    "category": categories,
                    "quantity": [random.randint(50, 200) for _ in range(len(categories))]
                })
                
                fig3 = px.pie(category_counts, names="category", values="quantity",
                            title="Food Category Popularity (No Data Available)")
                chart_category_popularity.plotly_chart(fig3, use_container_width=True, key=f"category_nodata_{timestamp}")
                
                # Create synthetic dish data
                dishes = ["Pizza", "Burger", "Pasta", "Sushi", "Tacos", "Salad", "Soup", "Steak", "Sandwich", "Noodles"]
                dish_counts = pd.DataFrame({
                    "item_name": dishes,
                    "quantity": [random.randint(20, 100) for _ in range(len(dishes))]
                })
                dish_counts = dish_counts.sort_values("quantity", ascending=False)
                
                fig4 = px.bar(dish_counts, x="item_name", y="quantity", 
                            title="Top 10 Most Popular Dishes (No Data Available)")
                fig4.update_layout(xaxis_title="Dish", yaxis_title="Orders")
                chart_top_dishes.plotly_chart(fig4, use_container_width=True, key=f"dishes_nodata_{timestamp}")
            
            # Tab 2: Restaurant Performance Charts
            if not restaurant_perf.empty:
                # Chart 5: Restaurant Ratings Over Time
                latest_ratings = restaurant_perf.sort_values("report_date").drop_duplicates(["restaurant_id"], keep="last")
                top_restaurants = latest_ratings.sort_values("avg_rating", ascending=False).head(10)
                
                fig5 = px.bar(top_restaurants, x="restaurant_id", y="avg_rating", 
                            title="Top 10 Restaurants by Rating",
                            color="avg_rating", color_continuous_scale="RdYlGn")
                fig5.update_layout(xaxis_title="Restaurant", yaxis_title="Average Rating")
                chart_restaurant_ratings.plotly_chart(fig5, use_container_width=True, key=f"ratings_{timestamp}")
                
                # Chart 6: Preparation Time
                fig6 = px.bar(top_restaurants, x="restaurant_id", y="avg_prep_time",
                            title="Food Preparation Time for Top Restaurants",
                            color="avg_prep_time", color_continuous_scale="RdYlGn_r")
                fig6.update_layout(xaxis_title="Restaurant", yaxis_title="Avg Preparation Time (min)")
                chart_restaurant_prep_time.plotly_chart(fig6, use_container_width=True, key=f"prep_time_{timestamp}")
                
                # Chart 7: Restaurant Performance Matrix
                fig7 = px.scatter(latest_ratings, x="avg_prep_time", y="avg_rating",
                                size="orders_count", color="cancel_rate",
                                hover_name="restaurant_id",
                                title="Restaurant Performance Matrix",
                                color_continuous_scale="RdYlGn_r")
                fig7.update_layout(xaxis_title="Average Preparation Time (min)", 
                                yaxis_title="Average Rating")
                chart_restaurant_performance.plotly_chart(fig7, use_container_width=True, key=f"perf_matrix_{timestamp}")
            else:
                chart_restaurant_ratings.info("No restaurant performance data available")
                chart_restaurant_prep_time.info("No restaurant performance data available")
                chart_restaurant_performance.info("No restaurant performance data available")
                
            # Tab 3: Live Simulation Charts
            # Create history dataframe
            history_df = pd.DataFrame({
                "time": st.session_state.chart_history["time"],
                "orders": st.session_state.chart_history["orders"],
                "avg_delivery": st.session_state.chart_history["avg_delivery"]
            })
            
            if not history_df.empty:
                # Chart 8: Live Orders Trend
                fig8 = px.line(history_df, x="time", y="orders", 
                            title="Live Order Volume (Simulated)")
                fig8.update_layout(xaxis_title="Time", yaxis_title="Order Volume")
                chart_live_orders.plotly_chart(fig8, use_container_width=True, key=f"live_orders_{timestamp}")
                
                # Chart 9: Live Delivery Time Trend
                fig9 = px.line(history_df, x="time", y="avg_delivery", 
                            title="Live Delivery Time Trend (Simulated)")
                fig9.update_layout(xaxis_title="Time", yaxis_title="Avg Delivery Time (min)")
                chart_live_delivery_time.plotly_chart(fig9, use_container_width=True, key=f"live_delivery_{timestamp}")
            else:
                chart_live_orders.info("Start simulation to see live order data")
                chart_live_delivery_time.info("Start simulation to see live delivery time data")
            
            # Show recent simulated data
            recent_orders = st.session_state.simulated_orders[-10:] if st.session_state.simulated_orders else []
            recent_reports = st.session_state.simulated_reports[-5:] if st.session_state.simulated_reports else []
            
            if recent_orders or recent_reports:
                table_data = []
                for o in reversed(recent_orders):
                    table_data.append({
                        "Time": datetime.fromisoformat(o["order_time"][:-1]).strftime("%H:%M:%S"),
                        "Type": "Order",
                        "ID": o["order_id"],
                        "Details": f"Restaurant: {o['restaurant_id']}, Amount: ${o.get('total_amount', 0):.2f}"
                    })
                
                for r in reversed(recent_reports):
                    table_data.append({
                        "Time": datetime.now().strftime("%H:%M:%S"),
                        "Type": "Report",
                        "ID": r["restaurant_id"],
                        "Details": f"Prep Time: {r['avg_prep_time']} min, Rating: {r['avg_rating']}"
                    })
                
                simulated_data_table.dataframe(table_data, key=f"sim_data_{timestamp}")
            else:
                simulated_data_table.info("No simulated data yet. Start the simulation or generate data manually.")
        else:
            st.error("No KPI data available. Please check the data pipeline.")
            
        # Force a refresh every 5 seconds when running
        if st.session_state.running:
            st.session_state.refresh_counter += 1
            
    except Exception as e:
        st.error(f"Error updating dashboard: {e}")

# Main Loop to update dashboard every few seconds
last_update_time = time.time()  # Initialize with current time
update_interval = 3  # Update every 3 seconds

# Create a placeholder for showing simulation activity
sim_activity_indicator = st.empty()

while True:
    current_time = time.time()
    
    # Add a refresh indicator in the simulation tab when running
    if st.session_state.running:
        update_interval = max(1, 4 - st.session_state.sim_speed // 3)  # Faster updates at higher sim speed
    else:
        update_interval = 3  # Normal update interval when not running
        
    # Force a refresh if we've added new orders or if it's been long enough since last update
    force_refresh = st.session_state.running and (st.session_state.new_orders_count > 0)
    time_to_refresh = (current_time - last_update_time) >= update_interval
    
    if force_refresh or time_to_refresh:
        try:
            # Show an indicator that we're updating with live data
            if st.session_state.running and st.session_state.new_orders_count > 0:
                with st.sidebar:
                    st.success(f"✓ Processing {st.session_state.new_orders_count} new orders...")
                    
            # Refresh the dashboard
            draw_dashboard()
            last_update_time = current_time
            
        except Exception as e:
            st.error(f"Dashboard update error: {e}")
    
    time.sleep(0.5)
