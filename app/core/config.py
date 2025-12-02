from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

RUNTIME_SETTINGS_PATH = Path(__file__).resolve().parent / "runtime_settings.json"


class Settings(BaseSettings):
    default_sheet_id: str = Field(
        default="17tMHStXQYXaIQHQIA4jdUyHaYt_tuoNCEEuJCstWEuw",
        alias="DEFAULT_SHEET_ID",
    )

    cors_origins: List[str] = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        alias="CORS_ORIGINS",
    )

    google_api_key: Optional[str] = Field(
        default=None,
        alias="GOOGLE_API_KEY",
    )

    gcp_service_account_json: Optional[str] = Field(
        default=None,
        alias="GCP_SERVICE_ACCOUNT_JSON",
    )

    excel_template_path: str = Field(
        default="app/core/excel_template.xlsx",
        alias="EXCEL_TEMPLATE_PATH",
    )

    model_config = SettingsConfigDict(
        extra="ignore",
        populate_by_name=True,
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()


def load_runtime_overrides() -> dict:
    if not RUNTIME_SETTINGS_PATH.exists():
        return {}
    return json.loads(RUNTIME_SETTINGS_PATH.read_text(encoding="utf-8"))


def save_runtime_overrides(data: dict) -> None:
    RUNTIME_SETTINGS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def get_effective_google_api_key() -> Optional[str]:
    overrides = load_runtime_overrides()
    return overrides.get("google_api_key") or settings.google_api_key


def get_effective_gcp_service_account_json() -> Optional[str]:
    overrides = load_runtime_overrides()
    return overrides.get("gcp_service_account_json") or settings.gcp_service_account_json