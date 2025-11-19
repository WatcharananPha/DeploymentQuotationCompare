import os
import tempfile
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from .core.config import settings
from .core.processing import extract_sheet_id_from_url, process_files
from .models import ProcessResponse

router = APIRouter(prefix="/api", tags=["quotation"])

@router.post("/process-files", response_model=ProcessResponse)
async def process_files_endpoint(
    files: List[UploadFile] = File(...),
    sheet_url: str = Form(""),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    with tempfile.TemporaryDirectory() as temp_dir:
        file_paths: List[str] = []
        for upload in files:
            dest = os.path.join(temp_dir, upload.filename)
            content = await upload.read()
            with open(dest, "wb") as f:
                f.write(content)
            file_paths.append(dest)
        sheet_id = extract_sheet_id_from_url(sheet_url) or settings.default_sheet_id
        results, errors = await run_in_threadpool(process_files, file_paths, sheet_id)
        return ProcessResponse(sheet_id=sheet_id, results=results, errors=errors)