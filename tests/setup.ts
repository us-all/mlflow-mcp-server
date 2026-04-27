// Set required env vars before any module loads — config.ts reads them at import time.
process.env.MLFLOW_TRACKING_URI = process.env.MLFLOW_TRACKING_URI ?? "http://localhost:5000";
