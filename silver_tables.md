```mermaid
erDiagram
    SILVER_ORDERS ||--o{ SILVER_MENU_ITEMS : includes
    SILVER_ORDERS ||--o{ SILVER_DRIVERS : assigned_to
    SILVER_ORDERS ||--o{ SILVER_RESTAURANT_PERFORMANCE : ordered_from
    SILVER_DRIVERS ||--o{ SILVER_WEATHER : drives_in
    SILVER_MENU_ITEMS ||--o{ SILVER_RESTAURANT_PERFORMANCE : available_at

    SILVER_ORDERS {
        string order_id
        string customer_id
        string restaurant_id
        string driver_id
        string items
        string status
        datetime order_time
        datetime delivery_time
        datetime ingest_timestamp
    }

    SILVER_MENU_ITEMS {
        string item_id
        string restaurant_id
        string item_name
        string category
        float base_price
        datetime ingest_timestamp
    }

    SILVER_DRIVERS {
        string driver_id
        string name
        float rating
        string zone
        datetime ingest_timestamp
    }

    SILVER_RESTAURANT_PERFORMANCE {
        date report_date
        string restaurant_id
        float avg_prep_time
        float avg_rating
        int orders_count
        float cancel_rate
        float avg_tip
        datetime ingest_timestamp
    }

    SILVER_WEATHER {
        string zone
        datetime weather_time
        float temperature
        string condition
        datetime ingest_timestamp
    }


```