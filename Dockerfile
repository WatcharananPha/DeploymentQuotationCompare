FROM node:20-alpine AS frontend-build
WORKDIR /frontend

COPY quotation-processor-ui/package.json quotation-processor-ui/package-lock.json ./
RUN npm install

COPY quotation-processor-ui ./

ENV VITE_API_BASE_URL="." 

RUN npm run build

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