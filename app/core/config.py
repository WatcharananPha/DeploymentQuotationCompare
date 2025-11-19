# app/core/config.py
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # === ส่วนที่ code ใช้ (attribute ฝั่ง Python) ===
    google_api_key: Optional[str] = Field(default=None, alias="GOOGLE_API_KEY")
    default_sheet_id: str = Field(
        default="17tMHStXQYXaIQHQIA4jdUyHaYt_tuoNCEEuJCstWEuw",
        alias="DEFAULT_SHEET_ID",
    )
    gcp_service_account_json: Optional[str] = Field(
        default=None, alias="GCP_SERVICE_ACCOUNT_JSON"
    )

    # ถ้ามีการใช้ CORS_ORIGINS ใน main.py ก็ประกาศไว้ตรงนี้ด้วย
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        alias="CORS_ORIGINS",
    )

    # ตั้งค่าการอ่าน .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",          # ถ้ามี env แปลก ๆ จะไม่ทำให้ล้ม
        populate_by_name=True,   # ให้รองรับทั้ง alias และชื่อ field
    )

    # === property สำรองให้ code ที่อาจเรียกชื่อแบบ UPPERCASE อยู่เดิม ===
    @property
    def GOOGLE_API_KEY(self) -> Optional[str]:
        return self.google_api_key

    @property
    def DEFAULT_SHEET_ID(self) -> str:
        return self.default_sheet_id

    @property
    def GCP_SERVICE_ACCOUNT_JSON(self) -> Optional[str]:
        return self.gcp_service_account_json


settings = Settings()
