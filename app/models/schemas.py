from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional
from datetime import datetime

class Tag(BaseModel):
    """Schéma pour les tags techniques associés aux articles"""
    name: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)

class Article(BaseModel):
    """Schéma pour les articles de flux RSS"""
    id: str  # Unique ID généré à partir du GUID ou de l'URL
    title: str
    link: HttpUrl
    pub_date: datetime
    description: str
    content: Optional[str] = None
    summary: Optional[str] = None  # Résumé généré
    source: str  # Nom de la source (AWS, Azure, Google, etc.)
    tags: List[Tag] = []
    read_later: bool = False
    read: bool = False
    image_url: Optional[HttpUrl] = None

class ArticleResponse(BaseModel):
    """Schéma pour la réponse API contenant les articles"""
    articles: List[Article]
    total: int
    page: int = 1
    page_size: int = 20

class SourceConfig(BaseModel):
    """Configuration d'une source RSS"""
    name: str
    url: HttpUrl
    icon: Optional[str] = None
    category: str
    active: bool = True 