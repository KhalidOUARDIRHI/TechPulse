import os
import asyncio
import logging
import sqlite3
import shutil
from init_app import initialize_app

# Configuration du logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Chemin de la base de données
DATABASE_PATH = "data/rss_data.db"

async def reset_database():
    """Supprime la base de données et les données temporaires"""
    try:
        # Supprimer le dossier data complet
        if os.path.exists("data"):
            logger.info("Suppression du dossier data...")
            shutil.rmtree("data")
            logger.info("Dossier data supprimé avec succès")
        
        # Recréer le dossier data
        os.makedirs("data", exist_ok=True)
        logger.info("Dossier data recréé")
        
        # Initialiser l'application avec les sources de sources_example.json
        logger.info("Réinitialisation de l'application...")
        await initialize_app(import_sources=True, fetch_initial=True)
        
        logger.info("Réinitialisation terminée avec succès")
        
    except Exception as e:
        logger.error(f"Erreur lors de la réinitialisation: {str(e)}")

if __name__ == "__main__":
    asyncio.run(reset_database()) 