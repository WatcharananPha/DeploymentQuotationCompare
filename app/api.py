# app/api.py
import os
import tempfile
import uuid
import asyncio
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from .core.config import (
    settings,
    load_runtime_overrides,
    save_runtime_overrides,
    get_effective_google_api_key,
    get_effective_gcp_service_account_json,
)
from .core.processing import extract_sheet_id_from_url, process_files

router = APIRouter(prefix="/api", tags=["quotation"])

jobs: Dict[str, Dict[str, Any]] = {}

class SettingsPayload(BaseModel):
    google_api_key: Optional[str] = None
    gcp_service_account_json: Optional[str] = None

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.get("/settings", response_model=SettingsPayload)
def get_settings():
    overrides = load_runtime_overrides()
    return SettingsPayload(
        google_api_key=overrides.get("google_api_key") or settings.google_api_key,
        gcp_service_account_json=overrides.get("gcp_service_account_json") or settings.gcp_service_account_json,
    )

@router.post("/settings", response_model=SettingsPayload)
def update_settings(payload: SettingsPayload):
    overrides = load_runtime_overrides()
    if payload.google_api_key is not None:
        overrides["google_api_key"] = payload.google_api_key.strip()
    if payload.gcp_service_account_json is not None:
        overrides["gcp_service_account_json"] = payload.gcp_service_account_json.strip()
    save_runtime_overrides(overrides)
    return SettingsPayload(
        google_api_key=overrides.get("google_api_key"),
        gcp_service_account_json=overrides.get("gcp_service_account_json"),
    )

async def background_processing_task(job_id: str, file_paths: List[str], sheet_id: str, api_key: str, gcp_json: str):
    try:
        results, errors = await run_in_threadpool(
            process_files,
            file_paths,
            sheet_id,
            api_key,
            gcp_json,
        )
        jobs[job_id] = {
            "status": "completed",
            "result": {"sheet_id": sheet_id, "results": results, "errors": errors}
        }
    except Exception as e:
        jobs[job_id] = {"status": "failed", "error": str(e)}
    finally:
        for path in file_paths:
            if os.path.exists(path):
                try:
                    os.unlink(path)
                except:
                    pass

@router.post("/process-files-async", response_model=JobStatusResponse)
async def submit_processing_job(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    sheet_url: str = Form(""),
    google_api_key: str = Form(""),
    gcp_service_account_json: str = Form(""),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    effective_google_api_key = google_api_key.strip() or get_effective_google_api_key()
    if not effective_google_api_key:
        raise HTTPException(status_code=400, detail="Missing Google API key")

    effective_gcp_json = (
        gcp_service_account_json.strip()
        or get_effective_gcp_service_account_json()
        or ""
    )

    temp_dir = tempfile.mkdtemp()
    file_paths = []
    for upload in files:
        dest = os.path.join(temp_dir, upload.filename)
        content = await upload.read()
        with open(dest, "wb") as f:
            f.write(content)
        file_paths.append(dest)

    sheet_id = extract_sheet_id_from_url(sheet_url) or settings.default_sheet_id
    job_id = str(uuid.uuid4())
    
    jobs[job_id] = {"status": "processing", "result": None}

    background_tasks.add_task(
        background_processing_task,
        job_id,
        file_paths,
        sheet_id,
        effective_google_api_key,
        effective_gcp_json,
    )

    return JobStatusResponse(job_id=job_id, status="processing")

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        result=job.get("result"),
        error=job.get("error")
    )