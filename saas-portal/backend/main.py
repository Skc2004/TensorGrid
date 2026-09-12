from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import condor

app = FastAPI(
    title="HTCondor SaaS API",
    description="Backend API for the Student SaaS Web Portal",
    version="1.0.0"
)

# Allow the Vite Frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Default Vite dev server port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "online", "message": "HTCondor SaaS API is running."}

@app.post("/api/jobs/submit")
async def submit_job(file: UploadFile = File(...)):
    if not file.filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Only Python (.py) scripts are allowed.")
    
    try:
        content = await file.read()
        job_id = condor.submit_script(content, file.filename)
        return {"status": "success", "job_id": job_id, "message": f"Successfully submitted {file.filename} to the HTCondor Grid."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs/status")
def get_status():
    try:
        jobs = condor.get_job_status()
        return {"status": "success", "jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/grid/metrics")
def get_grid_metrics():
    # Hardcoded for MVP, could dynamically query condor_status
    return {
        "status": "success",
        "metrics": {
            "total_cores_available": 1200,
            "cores_in_use": 340,
            "compute_hours_saved": 4500,
            "cloud_cost_equivalent_saved": "$12,400",
            "active_nodes": 45,
            "grid_health": "Optimal"
        }
    }

@app.delete("/api/jobs/cancel/{job_id}")
def cancel_job(job_id: str):
    try:
        condor.cancel_job(job_id)
        return {"status": "success", "message": f"Successfully cancelled job {job_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
