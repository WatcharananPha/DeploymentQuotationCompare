# --- Stage 1: Build Frontend (React) ---
FROM node:20-alpine AS frontend-build

# อย่าเพิ่ง set NODE_ENV=production ตอน build เพราะต้องใช้ devDependencies (tsc, vite)
WORKDIR /frontend

# Copy package files
COPY quotation-processor-ui/package.json quotation-processor-ui/package-lock.json ./

# Install ALL dependencies (including devDependencies for build tools)
RUN npm install

# Copy source code
COPY quotation-processor-ui ./

# Set Env Var for Build
ENV VITE_API_BASE_URL="."

# Build Project
RUN npm run build

# --- Stage 2: Build Backend (FastAPI) & Serve ---
FROM python:3.11-slim

# Config Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app    

# Install System Dependencies (Optional but good for some python libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY app ./app

# Create Template Directory & Copy Template
# สำคัญ: ตรวจสอบว่าชื่อไฟล์ต้นฉบับคือ 'temp.xlsx' จริงๆ
RUN mkdir -p ./app/templates
COPY temp.xlsx ./app/templates/quotation_template.xlsx

# Copy Frontend Build Artifacts from Stage 1
COPY --from=frontend-build /frontend/dist ./app/static

# Expose Port
EXPOSE 8000

# Run Application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "300"]