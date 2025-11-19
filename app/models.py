from typing import Any, Dict, List
from pydantic import BaseModel

class ProcessResponse(BaseModel):
    sheet_id: str
    results: List[Dict[str, Any]]
    errors: List[str]
