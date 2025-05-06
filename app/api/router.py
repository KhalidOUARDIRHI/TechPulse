from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from ..models.schemas import Article, ArticleResponse, SourceConfig
from ..services.rss_parser import RSSParser
from ..services.tag_generator import TagGenerator
from ..db import database
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
rss_parser = RSSParser()
tag_generator = TagGenerator()

@router.get("/articles", response_model=ArticleResponse)
async def get_articles(
    page: int = Query(1, ge=1, description="Numéro de page"),
    page_size: int = Query(20, ge=5, le=100, description="Nombre d'articles par page"),
    source: Optional[str] = Query(None, description="Filtrer par source"),
    tag: Optional[str] = Query(None, description="Filtrer par tag"),
    search: Optional[str] = Query(None, description="Recherche dans le titre et la description"),
    read_later: Optional[bool] = Query(None, description="Filtrer par articles à lire plus tard"),
    read: Optional[bool] = Query(None, description="Filtrer par articles lus")
):
    """Récupère les articles avec pagination et filtrage"""
    try:
        result = await database.get_articles(
            page=page,
            page_size=page_size,
            source=source,
            tag=tag,
            search=search,
            read_later=read_later,
            read=read
        )
        return result
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des articles: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors de la récupération des articles")

@router.get("/sources", response_model=List[SourceConfig])
async def get_sources():
    """Récupère les sources RSS configurées"""
    try:
        sources = await database.get_sources()
        return sources
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des sources: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors de la récupération des sources")

@router.post("/sources", response_model=SourceConfig)
async def add_source(source: SourceConfig):
    """Ajoute une nouvelle source RSS"""
    try:
        # Vérifier si l'URL est valide en tentant un fetch
        articles = await rss_parser.fetch_and_parse(source.name, str(source.url))
        if not articles:
            raise HTTPException(status_code=400, detail="URL de flux RSS invalide ou aucun article trouvé")
        
        # Sauvegarder la source
        await database.save_source(source.dict())
        
        # Optionnel: sauvegarder les premiers articles
        for article in articles[:10]:  # Limiter aux 10 premiers
            # Générer des tags si nécessaire
            if not article.get("tags"):
                title = article.get("title", "")
                content = article.get("content", article.get("description", ""))
                article["tags"] = await tag_generator.generate_tags(title, content)
            
            await database.save_article(article)
        
        return source
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'ajout de la source: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors de l'ajout de la source")

@router.delete("/sources/{source_name}")
async def delete_source(source_name: str):
    """Supprime une source RSS"""
    try:
        sources = await database.get_sources()
        exists = any(s["name"] == source_name for s in sources)
        
        if not exists:
            raise HTTPException(status_code=404, detail="Source non trouvée")
        
        # Mettre à jour la source comme inactive
        source_data = {"name": source_name, "active": 0}
        await database.save_source(source_data)
        
        return {"status": "success", "message": f"Source {source_name} désactivée"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de la source: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors de la suppression de la source")

@router.put("/articles/{article_id}/status")
async def update_article_status(
    article_id: str,
    read_later: Optional[bool] = None,
    read: Optional[bool] = None
):
    """Met à jour le statut de lecture d'un article"""
    try:
        if read_later is None and read is None:
            raise HTTPException(status_code=400, detail="Au moins un paramètre de statut doit être fourni")
        
        await database.update_article_status(article_id, read_later, read)
        return {"status": "success", "message": "Statut de l'article mis à jour"}
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du statut: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors de la mise à jour du statut")

@router.post("/refresh")
async def refresh_feeds():
    """Rafraîchit tous les flux RSS actifs"""
    try:
        sources = await database.get_sources(active_only=True)
        
        total_articles = 0
        for source in sources:
            # Récupérer et parser les articles
            articles = await rss_parser.fetch_and_parse(source["name"], source["url"])
            
            # Générer des tags et sauvegarder
            for article in articles:
                if not article.get("tags"):
                    title = article.get("title", "")
                    content = article.get("content", article.get("description", ""))
                    article["tags"] = await tag_generator.generate_tags(title, content)
                
                await database.save_article(article)
            
            total_articles += len(articles)
            
            # Mettre à jour la date de dernier fetch
            source["last_fetch"] = database.datetime.now().isoformat()
            await database.save_source(source)
        
        return {
            "status": "success", 
            "message": f"Tous les flux ont été rafraîchis", 
            "sources_count": len(sources),
            "articles_count": total_articles
        }
    except Exception as e:
        logger.error(f"Erreur lors du rafraîchissement des flux: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors du rafraîchissement des flux") 