FROM node:20-alpine AS frontend-build
WORKDIR /frontend

# ติดตั้ง dependency ของ UI
COPY quotation-processor-ui/package.json quotation-processor-ui/package-lock.json ./
RUN npm ci

# คัดลอก source แล้ว build
COPY quotation-processor-ui ./

# base URL ของ API (เรียกแบบ relative: /api/....)
ENV VITE_API_BASE_URL="."

RUN npm run build


# ---------- Stage 2: Backend + Static + Excel Template ----------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# (ถ้า requirements บางตัวต้องใช้ system lib ให้เพิ่มในบรรทัดนี้ได้)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ติดตั้ง Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอก backend code
COPY app ./app

# สร้างโฟลเดอร์ templates สำหรับ Excel template
RUN mkdir -p ./app/templates

# คัดลอกไฟล์ Excel template จาก root repo เข้าไปใน app/templates
# temp.xlsx = ไฟล์ template ที่คุณมีอยู่ "C:\Users\kongl\Documents\GitHub\DeploymentQuotationCompare\temp.xlsx"
COPY temp.xlsx ./app/templates/quotation_template.xlsx

# คัดลอก frontend ที่ build แล้วเข้าไปเป็น static ของ backend
COPY --from=frontend-build /frontend/dist ./app/static

# เปิด port 8000 ให้ container
EXPOSE 8000

# รัน FastAPI ผ่าน Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
