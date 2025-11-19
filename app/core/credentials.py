from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class _CredentialStore:
    google_api_key: Optional[str] = None
    gcp_service_account_json: Optional[str] = None

    def set(self, google_api_key: str, gcp_service_account_json: str) -> None:
        self.google_api_key = google_api_key
        self.gcp_service_account_json = gcp_service_account_json

    def get(self) -> Tuple[Optional[str], Optional[str]]:
        return self.google_api_key, self.gcp_service_account_json


credential_store = _CredentialStore()
