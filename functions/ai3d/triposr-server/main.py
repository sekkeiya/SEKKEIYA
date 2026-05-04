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
    # No longer needed for stateless mock
    pass

@app.post("/jobs", response_model=JobResponse)
async def create_job(request: JobRequest, background_tasks: BackgroundTasks):
    provider_job_id = f"mock_triposr_{uuid.uuid4().hex}"
    
    # In a stateless mock, we don't store the job.
    # We just return the job ID.
    return {"providerJobId": provider_job_id, "status": "processing"}

@app.get("/jobs/{provider_job_id}")
async def get_job(provider_job_id: str):
    # In a stateless mock, we can just pretend the job is always successful immediately.
    # This prevents issues with Cloud Run scaling down and losing in-memory state.
    mock_url = os.getenv(
        "MOCK_GLB_URL", 
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb"
    )
    
    return {
        "status": "success",
        "glbUrl": mock_url
    }

if __name__ == "__main__":
    import uvicorn
    # uvicorn main:app --reload --port 8000 で起動
    uvicorn.run(app, host="127.0.0.1", port=8000)
