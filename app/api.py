import os
import tempfile
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
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
from .models import ProcessResponse

router = APIRouter(prefix="/api", tags=["quotation"])


class SettingsPayload(BaseModel):
    google_api_key: Optional[str] = None
    gcp_service_account_json: Optional[str] = None


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


@router.post("/process-files", response_model=ProcessResponse)
async def process_files_endpoint(
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
            effective_google_api_key,
            effective_gcp_json,
        )

        return ProcessResponse(sheet_id=sheet_id, results=results, errors=errors)
