<<<<<<< HEAD
from typing import List, Optional
=======
# app/core/config.py
from typing import List

>>>>>>> 759411f8df63217551d651388c87e0550fd3b293
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

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
<<<<<<< HEAD
=======

>>>>>>> 759411f8df63217551d651388c87e0550fd3b293
    model_config = SettingsConfigDict(
        extra="ignore",
        populate_by_name=True,
    )

<<<<<<< HEAD
settings = Settings()
=======

settings = Settings()
>>>>>>> 759411f8df63217551d651388c87e0550fd3b293
