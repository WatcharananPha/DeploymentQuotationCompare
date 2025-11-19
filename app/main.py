from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router as api_router

app = FastAPI(title="Quotation Processor API", version="1.0.0")

# CORS – ปรับ origin ตามโดเมน frontend จริงตอน deploy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: เปิดหมด, prod: กำหนด origin ให้แคบลง
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
