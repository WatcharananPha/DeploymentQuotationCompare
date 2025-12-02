# app/core/excel_template.py
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List
import tempfile

from openpyxl import load_workbook, Workbook

BASE_DIR = Path(__file__).resolve().parent.parent  # app/core -> app
TEMPLATES_DIR = BASE_DIR / "templates"
TEMPLATE_PATH = TEMPLATES_DIR / "quotation_template.xlsx"


def _ensure_template_workbook():
    if TEMPLATE_PATH.exists():
        wb = load_workbook(TEMPLATE_PATH)
        ws = wb.active
    else:
        wb = Workbook()
        ws = wb.active
        ws.title = "Sheet1"
    return wb, ws


def generate_excel_from_results(results: List[Dict[str, Any]]) -> str:
    """
    รับผลลัพธ์ที่ได้จาก process_files แล้ว generate เป็นไฟล์ Excel
    โดยใช้ template เดิม (quotation_template.xlsx) ถ้ามี
    return เป็น path ของ temp .xlsx ที่พร้อมให้ส่งให้ client ดาวน์โหลด
    """
    wb, ws = _ensure_template_workbook()

    current_row = 1

    for idx, item in enumerate(results, start=1):
        # results อาจเป็น list ของ data ตรง ๆ หรือเป็น {file_name, data}
        data = item.get("data") if isinstance(item, dict) and "data" in item else item
        if not data:
            continue

        company = data.get("company", "")
        contact = data.get("contact", "")
        total_price = data.get("totalPrice", 0)
        total_vat = data.get("totalVat", 0)
        total_inc_vat = data.get("totalPriceIncludeVat", 0)
        products = data.get("products", []) or []

        ws.cell(row=current_row, column=1, value=f"Supplier {idx}")
        ws.cell(row=current_row, column=2, value=company)
        current_row += 1

        ws.cell(row=current_row, column=1, value="Contact")
        ws.cell(row=current_row, column=2, value=contact)
        current_row += 1

        ws.cell(row=current_row, column=1, value="รวมเป็นเงิน")
        ws.cell(row=current_row, column=2, value=total_price)
        ws.cell(row=current_row, column=3, value=total_vat)
        ws.cell(row=current_row, column=4, value=total_inc_vat)
        current_row += 2

        # header products
        ws.cell(row=current_row, column=1, value="รายการ")
        ws.cell(row=current_row, column=2, value="จำนวน")
        ws.cell(row=current_row, column=3, value="หน่วย")
        ws.cell(row=current_row, column=4, value="ราคาต่อหน่วย")
        ws.cell(row=current_row, column=5, value="รวมเป็นเงิน")
        current_row += 1

        for p in products:
            ws.cell(row=current_row, column=1, value=p.get("name"))
            ws.cell(row=current_row, column=2, value=p.get("quantity"))
            ws.cell(row=current_row, column=3, value=p.get("unit"))
            ws.cell(row=current_row, column=4, value=p.get("pricePerUnit"))
            ws.cell(row=current_row, column=5, value=p.get("totalPrice"))
            current_row += 1

        current_row += 2  # เว้นบรรทัดคั่น supplier ถัดไป

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(tmp.name)
    tmp.close()
    return tmp.name