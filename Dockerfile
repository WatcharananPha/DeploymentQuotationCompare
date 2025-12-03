FROM node:20-alpine AS frontend-build

ENV NODE_ENV=production
WORKDIR /frontend

COPY quotation-processor-ui/package.json quotation-processor-ui/package-lock.json ./
RUN npm ci

COPY quotation-processor-ui ./
ENV VITE_API_BASE_URL="."
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p ./app/templates
COPY temp.xlsx ./app/templates/temp.xlsx

COPY --from=frontend-build /frontend/dist ./app/static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
