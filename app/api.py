import os
import tempfile
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from .core.config import settings
from .core.credentials import credential_store
from .core.processing import extract_sheet_id_from_url, process_files
from .models import ProcessResponse

router = APIRouter(prefix="/api", tags=["quotation"])

@router.post("/process-files", response_model=ProcessResponse)
async def process_files_endpoint(
    files: List[UploadFile] = File(...),
    sheet_url: str = Form(""),
    google_api_key: str | None = Form(None),
    gcp_service_account_json: str | None = Form(None),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    stored_api_key, stored_service_json = credential_store.get()
    effective_api_key = (google_api_key or stored_api_key or "").strip()
    effective_service_json = (gcp_service_account_json or stored_service_json or "").strip()

    if not effective_api_key:
        raise HTTPException(status_code=400, detail="Missing Google API key")
    if not effective_service_json:
        raise HTTPException(status_code=400, detail="Missing service account JSON")

    with tempfile.TemporaryDirectory() as temp_dir:
        file_paths: List[str] = []
        for upload in files:
            dest = os.path.join(temp_dir, upload.filename)
            content = await upload.read()
            with open(dest, "wb") as f:
                f.write(content)
            file_paths.append(dest)
        sheet_id = extract_sheet_id_from_url(sheet_url) or settings.default_sheet_id
        results, errors = await run_in_threadpool(
            process_files,
            file_paths,
            sheet_id,
            effective_api_key,
            effective_service_json,
        )
        return ProcessResponse(sheet_id=sheet_id, results=results, errors=errors)


@router.get("/credentials")
async def get_credentials():
    google_api_key, gcp_service_account_json = credential_store.get()
    return {
        "google_api_key": google_api_key or "",
        "gcp_service_account_json": gcp_service_account_json or "",
    }


@router.post("/credentials")
async def save_credentials(
    google_api_key: str = Form(...),
    gcp_service_account_json: str = Form(...),
):
    if not google_api_key.strip():
        raise HTTPException(status_code=400, detail="Google API key is required")
    if not gcp_service_account_json.strip():
        raise HTTPException(status_code=400, detail="Service account JSON is required")

    credential_store.set(google_api_key.strip(), gcp_service_account_json.strip())
    return {"status": "saved"}