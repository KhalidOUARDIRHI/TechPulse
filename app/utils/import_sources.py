import json
import asyncio
import logging
import os
from typing import List, Dict, Any
from ..db import save_source, init_db

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def import_sources_from_json(json_file_path: str) -> List[Dict[str, Any]]:
    """
    Importe des sources RSS depuis un fichier JSON
    
    Args:
        json_file_path: Chemin vers le fichier JSON contenant les sources
        
    Returns:
        Liste des sources importées
    """
    try:
        if not os.path.exists(json_file_path):
            logger.error(f"Le fichier {json_file_path} n'existe pas")
            return []
        
        with open(json_file_path, 'r', encoding='utf-8') as f:
            sources = json.load(f)
        
        if not isinstance(sources, list):
            logger.error(f"Format de fichier invalide: {json_file_path}")
            return []
        
        # Initialiser la base de données
        await init_db()
        
        # Sauvegarder chaque source
        imported_sources = []
        for source in sources:
            logger.info(f"Importation de la source: {source.get('name')}")
            await save_source(source)
            imported_sources.append(source)
        
        logger.info(f"{len(imported_sources)} sources importées avec succès")
        return imported_sources
    
    except json.JSONDecodeError as e:
        logger.error(f"Erreur de décodage JSON: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"Erreur lors de l'importation des sources: {str(e)}")
        return []

if __name__ == "__main__":
    # Point d'entrée pour l'exécution en tant que script
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python -m app.utils.import_sources <json_file_path>")
        sys.exit(1)
    
    json_file_path = sys.argv[1]
    
    # Exécuter l'importation de manière asyncio
    loop = asyncio.get_event_loop()
    imported_sources = loop.run_until_complete(import_sources_from_json(json_file_path))
    
    print(f"Importation terminée: {len(imported_sources)} sources importées") 