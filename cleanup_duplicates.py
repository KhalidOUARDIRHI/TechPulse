import asyncio
import logging
import sqlite3
from typing import List, Dict, Set
import os

# Configuration du logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Chemin de la base de données
DATABASE_PATH = "data/rss_data.db"

async def cleanup_duplicate_sources():
    """Nettoie les sources en double dans la base de données"""
    if not os.path.exists(DATABASE_PATH):
        logger.error(f"Base de données introuvable: {DATABASE_PATH}")
        return
    
    try:
        # Connexion à la base de données
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Récupérer toutes les sources
        cursor.execute("SELECT name, url, category, active, icon FROM sources")
        sources = cursor.fetchall()
        
        if not sources:
            logger.info("Aucune source trouvée dans la base de données.")
            conn.close()
            return
        
        # Identifier les doublons (basés sur l'URL)
        unique_urls: Dict[str, List] = {}
        for source in sources:
            name, url, category, active, icon = source
            
            # Standardiser les URLs pour la comparaison
            normalized_url = url.strip().lower()
            if normalized_url.endswith('/'):
                normalized_url = normalized_url[:-1]
            
            # Conserver la source la plus récente (avec le plus grand rowid)
            if normalized_url in unique_urls:
                unique_urls[normalized_url].append(source)
            else:
                unique_urls[normalized_url] = [source]
        
        # Trouver les doublons
        duplicates = {url: sources for url, sources in unique_urls.items() if len(sources) > 1}
        
        if not duplicates:
            logger.info("Aucun doublon trouvé dans les sources.")
            conn.close()
            return
        
        # Informations sur les doublons
        total_duplicates = sum(len(sources) - 1 for sources in duplicates.values())
        logger.info(f"Trouvé {total_duplicates} sources en double")
        
        # Supprimer les doublons
        for url, dup_sources in duplicates.items():
            # Trier par nom pour prendre le plus court/simple comme source à conserver
            dup_sources.sort(key=lambda x: len(x[0]))
            keep = dup_sources[0]
            to_delete = dup_sources[1:]
            
            logger.info(f"Conservation de '{keep[0]}' et suppression de {[s[0] for s in to_delete]}")
            
            # Supprimer les doublons
            for source in to_delete:
                cursor.execute("DELETE FROM sources WHERE name = ?", (source[0],))
        
        # Supprimer aussi les articles sans source associée
        cursor.execute("""
            DELETE FROM articles 
            WHERE source NOT IN (SELECT name FROM sources)
        """)
        deleted_articles = cursor.rowcount
        logger.info(f"Suppression de {deleted_articles} articles sans source associée")
        
        # Commettre les changements
        conn.commit()
        logger.info("Nettoyage terminé avec succès")
        
        # Fermer la connexion
        conn.close()
        
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage des doublons: {str(e)}")
        
async def main():
    """Fonction principale"""
    await cleanup_duplicate_sources()

if __name__ == "__main__":
    asyncio.run(main()) 