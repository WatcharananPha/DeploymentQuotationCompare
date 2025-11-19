import json

import gspread
from google.oauth2.service_account import Credentials

from .config import settings

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

def get_gspread_client() -> gspread.Client:
    info = json.loads(settings.gcp_service_account_json)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    client = gspread.authorize(creds)
    return client

def authenticate_and_open_sheet(sheet_id: str):
    """
    เปิด worksheet แรกของ Google Sheet ตาม sheet_id
    ถ้าไม่ส่ง sheet_id มาให้ ใช้ default จาก config
    """
    client = get_gspread_client()
    key = sheet_id or settings.default_sheet_id
    sh = client.open_by_key(key)
    return sh.get_worksheet(0)
