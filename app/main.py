import logging
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from .api import router as api_router
from .db import init_db
from .utils.cleaner import DataCleaner

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Création de l'application FastAPI
app = FastAPI(
    title="TechPulse",
    description="Application de veille technologique intelligente pour consultants en transformation digitale. Agrège et filtre les actualités tech depuis divers flux RSS avec génération automatique de tags et interface moderne.",
    version="1.0.0",
)

# Middleware CORS pour permettre les requêtes cross-origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # À restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montage des fichiers statiques
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configuration des templates
templates = Jinja2Templates(directory="templates")

# Inclusion des routes API
app.include_router(api_router, prefix="/api")

# Création du dossier data si inexistant
os.makedirs("data", exist_ok=True)

# Route principale pour l'interface web
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Page d'accueil de l'application"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.on_event("startup")
async def startup_event():
    """Initialisation à l'exécution de l'application"""
    # Initialiser la base de données
    await init_db()
    logger.info("Base de données initialisée")
    
    # Démarrer le nettoyeur de données en arrière-plan
    cleaner = DataCleaner(retention_days=30)
    asyncio.create_task(cleaner.schedule_cleaning(interval_hours=24))
    logger.info("Nettoyeur de données démarré")

if __name__ == "__main__":
    # Exécution de l'application avec uvicorn
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    ) 