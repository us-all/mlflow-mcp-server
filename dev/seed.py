"""Seed the local MLflow tracking server with demo data.

Idempotent: if an experiment named 'demo' already exists with runs,
this exits without re-seeding. Re-seed by deleting the volume:
    docker compose down -v
"""
import os
import random
import time

import mlflow
from mlflow.tracking import MlflowClient

TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", "http://localhost:5000")
EXPERIMENT_NAME = "demo"
MODEL_NAME = "demo-classifier"

mlflow.set_tracking_uri(TRACKING_URI)
client = MlflowClient()


def get_or_create_experiment(name: str) -> str:
    existing = client.get_experiment_by_name(name)
    if existing:
        return existing.experiment_id
    return client.create_experiment(name)


def seed_runs(experiment_id: str, n: int = 5) -> list[str]:
    run_ids: list[str] = []
    for i in range(n):
        with mlflow.start_run(experiment_id=experiment_id, run_name=f"run-{i}") as run:
            mlflow.log_param("learning_rate", round(random.uniform(1e-4, 1e-1), 4))
            mlflow.log_param("batch_size", random.choice([16, 32, 64]))
            mlflow.log_param("model_type", random.choice(["lr", "rf", "xgb"]))
            for step in range(10):
                mlflow.log_metric("loss", 1.0 / (step + 1) + random.random() * 0.1, step=step)
                mlflow.log_metric("accuracy", 0.5 + step * 0.04 + random.random() * 0.02, step=step)
            mlflow.set_tag("env", "local")
            mlflow.set_tag("owner", "demo")
            run_ids.append(run.info.run_id)
    return run_ids


def seed_registered_model(run_ids: list[str]) -> None:
    try:
        client.create_registered_model(MODEL_NAME, description="Demo classifier")
    except Exception:
        pass

    for i, run_id in enumerate(run_ids[:3]):
        source = f"runs:/{run_id}/model"
        mv = client.create_model_version(
            name=MODEL_NAME,
            source=source,
            run_id=run_id,
            description=f"Demo model version {i + 1}",
        )
        client.set_model_version_tag(MODEL_NAME, mv.version, "validated", "true")

    versions = client.search_model_versions(f"name='{MODEL_NAME}'")
    if versions:
        latest = max(versions, key=lambda v: int(v.version))
        client.set_registered_model_alias(MODEL_NAME, "champion", latest.version)


def main() -> None:
    experiment_id = get_or_create_experiment(EXPERIMENT_NAME)
    existing = client.search_runs([experiment_id], max_results=1)
    if existing:
        print(f"experiment '{EXPERIMENT_NAME}' (id={experiment_id}) already has runs; skipping seed.")
        return

    print(f"seeding experiment '{EXPERIMENT_NAME}' (id={experiment_id})...")
    run_ids = seed_runs(experiment_id, n=5)
    print(f"  created {len(run_ids)} runs")
    seed_registered_model(run_ids)
    print(f"  registered model '{MODEL_NAME}' with versions and 'champion' alias")
    print("done.")


if __name__ == "__main__":
    main()
