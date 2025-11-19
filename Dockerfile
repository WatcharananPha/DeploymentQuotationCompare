# --- Stage 1: Build Frontend (React) ---
FROM node:20-alpine AS frontend-build
WORKDIR /frontend

# Copy package files & install dependencies
COPY quotation-processor-ui/package.json quotation-processor-ui/package-lock.json ./
RUN npm install

# Copy source code & build
COPY quotation-processor-ui ./
# ปรับแต่งให้ build ออกมาเป็น production files
RUN npm run build

# --- Stage 2: Build Backend (FastAPI) & Serve ---
FROM python:3.11-slim

# ป้องกัน Python สร้างไฟล์ .pyc และ buffer stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ติดตั้ง Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอก Code Backend
COPY app ./app

# คัดลอก Frontend ที่ Build เสร็จแล้วจาก Stage 1 มาไว้ในโฟลเดอร์ static ของ Backend
COPY --from=frontend-build /frontend/dist ./app/static

# Expose Port
EXPOSE 8000

# รัน FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]