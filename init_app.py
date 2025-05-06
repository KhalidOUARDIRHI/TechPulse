import asyncio
import os
import argparse
import logging
from app.db import init_db
from app.utils.import_sources import import_sources_from_json
from app.services.rss_parser import RSSParser
from app.services.tag_generator import TagGenerator

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

async def initialize_app(import_sources: bool = True, fetch_initial: bool = True, retention_days: int = 30):
    """
    Initialise l'application
    
    Args:
        import_sources: Si True, importe les sources depuis sources_example.json
        fetch_initial: Si True, récupère les articles initiaux
        retention_days: Durée de rétention des articles en jours
    """
    # Créer les dossiers nécessaires
    os.makedirs("data", exist_ok=True)
    os.makedirs("static/images", exist_ok=True)
    
    # Initialiser la base de données
    logger.info("Initialisation de la base de données...")
    await init_db()
    logger.info("Base de données initialisée avec succès")
    
    # Importer les sources
    imported_sources = []
    if import_sources:
        source_file = "sources_example.json"
        if os.path.exists(source_file):
            logger.info(f"Importation des sources depuis {source_file}...")
            imported_sources = await import_sources_from_json(source_file)
            logger.info(f"{len(imported_sources)} sources importées")
        else:
            logger.warning(f"Fichier {source_file} non trouvé, aucune source importée")
    
    # Récupérer les articles initiaux
    if fetch_initial and imported_sources:
        logger.info("Récupération des articles initiaux...")
        rss_parser = RSSParser()
        tag_generator = TagGenerator()
        
        total_articles = 0
        for source in imported_sources:
            try:
                source_name = source.get("name")
                source_url = source.get("url")
                logger.info(f"Récupération des articles pour {source_name}...")
                
                articles = await rss_parser.fetch_and_parse(source_name, source_url)
                
                for article in articles:
                    # Générer des tags
                    if not article.get("tags"):
                        title = article.get("title", "")
                        content = article.get("content", article.get("description", ""))
                        article["tags"] = await tag_generator.generate_tags(title, content)
                
                    # Sauvegarder l'article
                    from app.db import save_article
                    await save_article(article)
                
                total_articles += len(articles)
                logger.info(f"{len(articles)} articles récupérés pour {source_name}")
            
            except Exception as e:
                logger.error(f"Erreur lors de la récupération des articles pour {source.get('name')}: {str(e)}")
        
        logger.info(f"Total: {total_articles} articles récupérés")
    
    logger.info("Initialisation terminée")

if __name__ == "__main__":
    # Analyser les arguments de ligne de commande
    parser = argparse.ArgumentParser(description="Initialiser l'application TechPulse")
    parser.add_argument("--no-import", action="store_true", help="Ne pas importer les sources")
    parser.add_argument("--no-fetch", action="store_true", help="Ne pas récupérer les articles initiaux")
    parser.add_argument("--retention", type=int, default=30, help="Durée de rétention des articles en jours")
    
    args = parser.parse_args()
    
    # Exécuter l'initialisation
    asyncio.run(initialize_app(
        import_sources=not args.no_import,
        fetch_initial=not args.no_fetch,
        retention_days=args.retention
    )) 