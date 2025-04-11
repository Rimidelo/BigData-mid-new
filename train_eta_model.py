import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import joblib

# Load your feature data
df = pd.read_csv("woeat_demo/gold/ml_delivery_features.csv")

# 🧹 Drop rows with missing target values
df = df.dropna(subset=["delivery_minutes"])


# Define X and y
X = df[["distance_km", "driver_rating", "weather_condition", "time_of_day"]]
y = df["delivery_minutes"]

# Define preprocessing
categorical = ["weather_condition", "time_of_day"]
preprocessor = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical)
], remainder="passthrough")

# Pipeline: preprocess + model
model = Pipeline([
    ("prep", preprocessor),
    ("rf", RandomForestRegressor(n_estimators=100, random_state=42))
])

# Split and train
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model.fit(X_train, y_train)

# Evaluate and print
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
print(f"✅ Model trained. MAE: {mae:.1f} minutes")

# Save model
joblib.dump(model, "woeat_model_pipeline.pkl")




