import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import categories as categories_router
from app.routers import items as items_router
from app.routers import movements as movements_router
from app.routers import analytics as analytics_router
from app.routers import settings as settings_router
from app.routers import sync as sync_router
from app.routers import personnel as personnel_router
from app.seed import seed_data

load_dotenv()

app = FastAPI(title="BRU Stock Movements API")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip() for o in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(categories_router.router)
app.include_router(items_router.router)
app.include_router(movements_router.router)
app.include_router(analytics_router.router)
app.include_router(settings_router.router)
app.include_router(sync_router.router)
app.include_router(personnel_router.router)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {"status": "ok"}
