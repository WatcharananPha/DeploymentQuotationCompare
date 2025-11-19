# app/api.py
import os
import tempfile
from typing import List
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from .core.config import set_google_api_key, set_gcp_service_json, settings
from .core.processing import extract_sheet_id_from_url, process_files
from .models import ProcessResponse

router = APIRouter(prefix="/api", tags=["quotation"])


@router.post("/settings")
async def save_settings(google_api_key: str = Form(...), gcp_service_account_json: str = Form(...)):
    if not google_api_key.strip():
        raise HTTPException(status_code=400, detail="Missing Google API key")
    if not gcp_service_account_json.strip():
        raise HTTPException(status_code=400, detail="Missing service account JSON")
    set_google_api_key(google_api_key)
    set_gcp_service_json(gcp_service_account_json)
    return {"message": "API keys saved"}


@router.post("/process-files", response_model=ProcessResponse)
async def process_files_endpoint(
    files: List[UploadFile] = File(...),
    sheet_url: str = Form(""),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    with tempfile.TemporaryDirectory() as temp_dir:
        file_paths = []
        for upload in files:
            dest = os.path.join(temp_dir, upload.filename)
            content = await upload.read()
            with open(dest, "wb") as f:
                f.write(content)
            file_paths.append(dest)
        sheet_id = extract_sheet_id_from_url(sheet_url) or settings.default_sheet_id
        results, errors = await run_in_threadpool(process_files, file_paths, sheet_id)
        return ProcessResponse(sheet_id=sheet_id, results=results, errors=errors)