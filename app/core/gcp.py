import json

import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

def get_gspread_client(service_account_json: str) -> gspread.Client:
    info = json.loads(service_account_json)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    client = gspread.authorize(creds)
    return client

def authenticate_and_open_sheet(sheet_id: str, service_account_json: str):
    client = get_gspread_client(service_account_json)
    key = sheet_id
    sh = client.open_by_key(key)
    return sh.get_worksheet(0)