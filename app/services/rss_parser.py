import feedparser
import hashlib
import logging
import re
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Dict, List, Any, Optional
from dateutil import parser as date_parser
from ..models.schemas import Article, Tag

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RSSParser:
    """Classe pour parser et normaliser les flux RSS de différentes sources"""
    
    def __init__(self):
        self.handlers = {
            "aws": self._handle_aws,
            "azure": self._handle_azure,
            "google": self._handle_google,
            # Ajouter d'autres handlers spécifiques ici
            "default": self._handle_default
        }
    
    async def fetch_and_parse(self, source_name: str, source_url: str) -> List[Dict[str, Any]]:
        """Récupère et parse un flux RSS"""
        try:
            # Utiliser feedparser pour récupérer le flux
            feed = feedparser.parse(source_url)
            
            if hasattr(feed, 'bozo_exception'):
                logger.error(f"Erreur lors du parsing de {source_name}: {feed.bozo_exception}")
                return []
            
            if not feed.entries:
                logger.warning(f"Aucune entrée trouvée pour {source_name}")
                return []
            
            # Déterminer quel handler utiliser
            handler = self.handlers.get(source_name.lower(), self.handlers["default"])
            
            # Parser les entrées
            articles = []
            for entry in feed.entries:
                try:
                    article = handler(entry, source_name)
                    if article:
                        articles.append(article)
                except Exception as e:
                    logger.error(f"Erreur lors du parsing de l'entrée {entry.get('title', 'Unknown')}: {str(e)}")
            
            return articles
        
        except Exception as e:
            logger.error(f"Erreur lors de la récupération du flux {source_name}: {str(e)}")
            return []
    
    def _handle_default(self, entry: Dict[str, Any], source_name: str) -> Dict[str, Any]:
        """Handler par défaut pour les flux RSS standards"""
        # Générer un ID unique
        entry_id = entry.get('id', entry.get('link', ''))
        unique_id = hashlib.md5(f"{source_name}:{entry_id}".encode()).hexdigest()
        
        # Parser la date
        pub_date = self._parse_date(entry.get('published', entry.get('pubDate', '')))
        
        # Extraire le contenu du HTML si nécessaire
        description = self._clean_html(entry.get('description', ''))
        
        # Récupérer le contenu complet si disponible
        content = None
        if 'content' in entry and entry.content:
            for content_item in entry.content:
                if content_item.get('type') == 'text/html':
                    content = self._clean_html(content_item.value)
                    break
        
        # Récupérer les tags/catégories si disponibles
        tags = []
        if hasattr(entry, 'tags'):
            for tag in entry.tags:
                tags.append({
                    "name": tag.term,
                    "confidence": 1.0
                })
        
        # Extraire une image si disponible
        image_url = self._extract_image(entry)
        
        return {
            "id": unique_id,
            "title": entry.get('title', ''),
            "link": entry.get('link', ''),
            "pub_date": pub_date,
            "description": description,
            "content": content,
            "source": source_name,
            "tags": tags,
            "image_url": image_url
        }
    
    def _handle_aws(self, entry: Dict[str, Any], source_name: str) -> Dict[str, Any]:
        """Handler spécifique pour AWS Blog"""
        article = self._handle_default(entry, source_name)
        
        # AWS utilise souvent content:encoded pour le contenu complet
        if 'content_encoded' in entry:
            article["content"] = self._clean_html(entry.content_encoded)
        
        # Extraction des tags spécifiques AWS
        if not article["tags"] and hasattr(entry, 'categories'):
            article["tags"] = [{
                "name": cat,
                "confidence": 1.0
            } for cat in entry.categories]
        
        return article
    
    def _handle_azure(self, entry: Dict[str, Any], source_name: str) -> Dict[str, Any]:
        """Handler spécifique pour Azure Blog"""
        article = self._handle_default(entry, source_name)
        
        # Traitement spécifique Azure si nécessaire
        # Souvent, Azure a du HTML dans la description mais pas de contenu encodé
        if not article["content"] and article["description"]:
            article["content"] = article["description"]
        
        return article
    
    def _handle_google(self, entry: Dict[str, Any], source_name: str) -> Dict[str, Any]:
        """Handler spécifique pour Google Cloud Blog"""
        article = self._handle_default(entry, source_name)
        
        # Google Cloud utilise parfois des structures spécifiques
        # Vérifier si des adaptations sont nécessaires ici
        
        return article
    
    def _clean_html(self, html_content: str) -> str:
        """Nettoie le HTML pour extraire le texte"""
        if not html_content:
            return ""
        
        # Utiliser BeautifulSoup pour nettoyer le HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Supprimer les scripts et styles
        for script in soup(["script", "style"]):
            script.extract()
        
        # Récupérer le texte
        text = soup.get_text(separator=' ', strip=True)
        
        # Nettoyer les espaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def _parse_date(self, date_str: str) -> str:
        """Parse une date depuis différents formats possibles"""
        if not date_str:
            return datetime.now().isoformat()
        
        try:
            return date_parser.parse(date_str).isoformat()
        except Exception:
            logger.warning(f"Impossible de parser la date: {date_str}")
            return datetime.now().isoformat()
    
    def _extract_image(self, entry: Dict[str, Any]) -> Optional[str]:
        """Extrait l'URL d'une image à partir de différentes structures possibles"""
        # Essayer les media:content
        if hasattr(entry, 'media_content') and entry.media_content:
            for media in entry.media_content:
                if 'url' in media and media.get('type', '').startswith('image/'):
                    return media['url']
        
        # Essayer les enclosures
        if hasattr(entry, 'enclosures') and entry.enclosures:
            for enclosure in entry.enclosures:
                if 'type' in enclosure and enclosure['type'].startswith('image/'):
                    return enclosure.get('href', enclosure.get('url'))
        
        # Chercher dans le contenu HTML
        content_html = entry.get('description', '')
        if 'content' in entry and entry.content:
            for content_item in entry.content:
                if content_item.get('type') == 'text/html':
                    content_html = content_item.value
                    break
        
        if content_html:
            soup = BeautifulSoup(content_html, 'html.parser')
            img = soup.find('img')
            if img and img.get('src'):
                return img['src']
        
        return None 