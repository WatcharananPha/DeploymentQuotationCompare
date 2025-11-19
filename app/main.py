import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .api import router as api_router

app = FastAPI(title="Quotation Processor API", version="1.0.0")

# CORS config (ยังคงไว้เผื่อ Local Dev, แต่บน Prod จะเป็น Origin เดียวกัน)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Include API Router ก่อนเสมอ
app.include_router(api_router)

# 2. ตรวจสอบว่ามีโฟลเดอร์ static หรือไม่ (จากการ Build Docker)
static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(static_dir):
    # Mount static files (JS, CSS, Images)
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    
    # Serve index.html สำหรับ root path และทุก path ที่ไม่ตรงกับ API (เพื่อรองรับ React Router)
    @app.get("/{full_path:path}")
    async def serve_app(full_path: str):
        # ถ้า request ขึ้นต้นด้วย api/ ให้ปล่อยผ่าน (ไปที่ api_router)
        if full_path.startswith("api/"):
            return {"error": "API endpoint not found"}
            
        # นอกนั้นส่ง index.html ให้ React จัดการต่อ
        return FileResponse(os.path.join(static_dir, "index.html"))
else:
    print("Warning: Static files directory not found. Frontend will not be served.")

@app.get("/health")
async def health():
    return {"status": "ok"}