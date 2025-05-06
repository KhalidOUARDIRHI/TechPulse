import logging
import asyncio
from datetime import datetime, timedelta
from ..db import database

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataCleaner:
    """Classe utilitaire pour nettoyer les données périmées"""
    
    def __init__(self, retention_days: int = 30):
        """
        Initialise le nettoyeur de données
        
        Args:
            retention_days: Nombre de jours de rétention des articles
        """
        self.retention_days = retention_days
    
    async def clean_old_data(self):
        """Nettoie les articles plus anciens que la période de rétention"""
        try:
            logger.info(f"Nettoyage des articles plus anciens que {self.retention_days} jours")
            await database.delete_old_articles(days=self.retention_days)
            logger.info("Nettoyage terminé avec succès")
        except Exception as e:
            logger.error(f"Erreur lors du nettoyage des données: {str(e)}")
    
    async def schedule_cleaning(self, interval_hours: int = 24):
        """
        Planifie le nettoyage à intervalles réguliers
        
        Args:
            interval_hours: Intervalle en heures entre chaque nettoyage
        """
        logger.info(f"Planification du nettoyage toutes les {interval_hours} heures")
        while True:
            await self.clean_old_data()
            # Attendre l'intervalle spécifié
            await asyncio.sleep(interval_hours * 3600)  # Convertir en secondes 