from fastapi import FastAPI, Depends, HTTPException, status, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, database, celery_worker
import uuid
import datetime
import asyncio
import random

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="HTCondor Grid API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def auto_scale_spot_fleet():
    while True:
        # Mocking a check to the Redis celery broker for queue length
        # In reality: queue_len = redis_client.llen("celery")
        queue_len = random.randint(0, 15)
        
        if queue_len > 10:
            print(f"[AWS Auto-Scaler] High load detected (Queue: {queue_len}). Provisioning EC2 Spot Instances...")
            # Mocking boto3 call:
            # ec2 = boto3.client('ec2')
            # ec2.request_spot_instances(InstanceCount=1, Type='one-time', LaunchSpecification={...})
            print("[AWS Auto-Scaler] Spot Instance request fulfilled. Node spinning up.")
        elif queue_len == 0:
            print("[AWS Auto-Scaler] Queue is empty. Terminating idle Spot Instances to save costs.")
            
        await asyncio.sleep(10) # Check every 10 seconds

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(auto_scale_spot_fleet())

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Temporary mock auth until we implement JWT
def get_current_user(db: Session = Depends(get_db)):
    user = db.query(models.User).first()
    if not user:
        # Seed default admin user and default org
        org = models.Organization(name="College Edu Default", credits_balance=10000)
        db.add(org)
        db.commit()
        db.refresh(org)
        
        user = models.User(email="admin@college.edu", hashed_password="hashed_password", role="admin", is_approved=True, credits=5000, current_org_id=org.id)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        member = models.OrganizationMember(org_id=org.id, user_id=user.id, role="admin")
        db.add(member)
        db.commit()
    return user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    # Mock login logic
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        user = models.User(email=req.email, hashed_password="mock", role="student", is_approved=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return {"access_token": "mock-jwt-token", "token_type": "bearer", "role": user.role, "email": user.email, "is_approved": user.is_approved}

@app.get("/api/auth/profile")
def get_profile(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    org_name = None
    if current_user.current_org_id:
        org = db.query(models.Organization).filter(models.Organization.id == current_user.current_org_id).first()
        org_name = org.name if org else None
    return {"email": current_user.email, "role": current_user.role, "credits": current_user.credits, "org_name": org_name}

@app.post("/api/orgs", response_model=schemas.Organization)
def create_org(org: schemas.OrganizationBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_org = models.Organization(name=org.name)
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    
    member = models.OrganizationMember(org_id=db_org.id, user_id=current_user.id, role="admin")
    current_user.current_org_id = db_org.id
    db.add(member)
    db.commit()
    return db_org

@app.get("/api/orgs", response_model=list[schemas.Organization])
def list_orgs(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = db.query(models.OrganizationMember).filter(models.OrganizationMember.user_id == current_user.id).all()
    org_ids = [m.org_id for m in memberships]
    orgs = db.query(models.Organization).filter(models.Organization.id.in_(org_ids)).all()
    return orgs

@app.post("/api/jobs/submit")
def submit_job(
    cpu: int = Form(1),
    ram: int = Form(2),
    gpu: bool = Form(False),
    workspace_id: str = Form("personal"),
    file: UploadFile = File(None),
    codeString: str = Form(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    
    cmd = "python script.py"
    if codeString:
        cmd = "python -c '...'"
        
    db_job = models.Job(
        id=job_id,
        cmd=cmd,
        cpu_req=cpu,
        ram_req=ram,
        gpu_req=gpu,
        workspace_id=workspace_id,
        owner_id=current_user.id,
        org_id=current_user.current_org_id
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    # Push to Celery
    payload = {"cmd": db_job.cmd, "cpu": db_job.cpu_req, "ram": db_job.ram_req}
    celery_worker.dispatch_grid_job.delay(job_id, payload)
    
    return {"status": "success", "message": f"Job submitted to distributed queue. Job ID: {job_id}", "job_id": job_id}

@app.post("/api/models/deploy")
def deploy_model(req: schemas.JobCreate, current_user: models.User = Depends(get_current_user)):
    # In reality, this communicates with Go Agent to StartInferenceServer
    endpoint = f"https://inference.grid.college.edu/models/{current_user.id}/predict"
    return {"status": "success", "message": "Model container provisioned and traffic routed.", "endpoint": endpoint}

@app.post("/api/jupyter/launch")
def launch_jupyter(req: schemas.JobCreate, current_user: models.User = Depends(get_current_user)):
    # In reality, this communicates with Go Agent to StartJupyterLab
    url = f"https://notebooks.grid.college.edu/lab?token=secure_token_{current_user.id}"
    return {"status": "success", "message": "JupyterLab container provisioned.", "url": url}

@app.get("/api/jobs/status")
def get_jobs_status(workspace_id: str = "personal", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    jobs = db.query(models.Job).filter(models.Job.workspace_id == workspace_id).all()
    # Format for frontend
    result = []
    for j in jobs:
        result.append({
            "cluster_id": j.id,
            "owner": j.owner.email if j.owner else "unknown",
            "status": j.status,
            "cmd": j.cmd,
            "ram_used": f"{j.ram_req}MB",
            "cpu_load": f"{j.cpu_req} Cores"
        })
    return result

@app.get("/api/grid/metrics")
def get_metrics():
    return {
        "total_cores_available": 128,
        "total_ram_gb_available": 1024,
        "nodes_active": 8,
        "nodes_idle": 2,
        "cloud_cost_equivalent_saved": "$452.10"
    }

@app.get("/api/admin/analytics")
def get_analytics():
    return {
        "cpu_history": [{"date": "Mon", "cpuLoad": 45}, {"date": "Tue", "cpuLoad": 60}],
        "department_usage": [{"name": "Physics", "hours": 450}, {"name": "Bio", "hours": 320}]
    }
