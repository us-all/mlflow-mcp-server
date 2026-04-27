import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const config = {
  trackingUri: (process.env.MLFLOW_TRACKING_URI ?? "").replace(/\/+$/, ""),
  token: process.env.MLFLOW_TRACKING_TOKEN ?? "",
  username: process.env.MLFLOW_TRACKING_USERNAME ?? "",
  password: process.env.MLFLOW_TRACKING_PASSWORD ?? "",
  defaultExperimentId: process.env.MLFLOW_EXPERIMENT_ID ?? "",
  allowWrite: process.env.MLFLOW_ALLOW_WRITE === "true",
};

export function validateConfig(): void {
  if (!config.trackingUri) {
    throw new Error("MLFLOW_TRACKING_URI environment variable is required");
  }
}
