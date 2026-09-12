import os
import time
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@celery_app.task(bind=True)
def dispatch_grid_job(self, job_id: str, payload: dict):
    """
    Asynchronous task that would normally interface with the Go Agents.
    For now, it simulates job dispatching latency.
    """
    print(f"[Celery] Dispatching job {job_id} to grid...")
    time.sleep(2)
    print(f"[Celery] Job {job_id} successfully queued on edge nodes.")
    return {"status": "dispatched", "job_id": job_id}
