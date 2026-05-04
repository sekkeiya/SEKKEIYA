from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uuid
import time
import os

app = FastAPI()

# In-memory job store
jobs = {}

class JobRequest(BaseModel):
    imageUrl: str
    jobId: str
    uid: str

class JobResponse(BaseModel):
    providerJobId: str
    status: str

def process_job(provider_job_id: str):
    # Simulate processing delay (Mock TripoSR generation time)
    time.sleep(5)
    
    # Assume generation was successful
    jobs[provider_job_id]['status'] = 'success'
    
    # Return an external mock GLB URL instead of a local file
    mock_url = os.getenv(
        "MOCK_GLB_URL", 
        "https://firebasestorage.googleapis.com/v0/b/shapeshare1d.appspot.com/o/assets%2Fsystem%2Fsekkeiya_demo.glb?alt=media"
    )
    jobs[provider_job_id]['glbUrl'] = mock_url

@app.post("/jobs", response_model=JobResponse)
async def create_job(request: JobRequest, background_tasks: BackgroundTasks):
    provider_job_id = f"mock_triposr_{uuid.uuid4().hex}"
    
    jobs[provider_job_id] = {
        "status": "processing",
        "imageUrl": request.imageUrl,
        "jobId": request.jobId,
        "uid": request.uid
    }
    
    # Start the "generation" in the background
    background_tasks.add_task(process_job, provider_job_id)
    
    return {"providerJobId": provider_job_id, "status": "processing"}

@app.get("/jobs/{provider_job_id}")
async def get_job(provider_job_id: str):
    if provider_job_id not in jobs:
        return {"status": "failed", "error": "Job not found"}
        
    job = jobs[provider_job_id]
    if job['status'] == "processing":
        return {"status": "processing"}
    elif job['status'] == "success":
        return {
            "status": "success",
            "glbUrl": job['glbUrl']
        }
    else:
        return {"status": "failed", "error": "Unknown status"}

if __name__ == "__main__":
    import uvicorn
    # uvicorn main:app --reload --port 8000 で起動
    uvicorn.run(app, host="127.0.0.1", port=8000)
