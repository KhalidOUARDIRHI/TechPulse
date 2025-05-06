import sqlite3
import json
import os
import aiosqlite
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Chemin de la base de données
DATABASE_PATH = "data/rss_data.db"

# S'assurer que le dossier data existe
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

async def init_db():
    """Initialise la base de données avec les tables nécessaires"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Création de la table articles
        await db.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            pub_date TEXT NOT NULL,
            description TEXT,
            content TEXT,
            summary TEXT,
            source TEXT NOT NULL,
            tags TEXT,
            read_later INTEGER DEFAULT 0,
            read INTEGER DEFAULT 0,
            image_url TEXT,
            created_at TEXT NOT NULL
        )
        """)
        
        # Création de la table sources
        await db.execute("""
        CREATE TABLE IF NOT EXISTS sources (
            name TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            icon TEXT,
            category TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            last_fetch TEXT
        )
        """)
        
        # Index pour accélérer les recherches
        await db.execute("CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_articles_pubdate ON articles(pub_date)")
        
        await db.commit()

async def save_article(article_data: Dict[str, Any]) -> str:
    """Sauvegarde un article dans la base de données"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Convertir les tags en JSON pour stockage
        if "tags" in article_data and article_data["tags"]:
            article_data["tags"] = json.dumps([t.dict() if hasattr(t, "dict") else t for t in article_data["tags"]])
        else:
            article_data["tags"] = "[]"
        
        # Ajouter la date de création
        article_data["created_at"] = datetime.now().isoformat()
        
        # Insérer ou mettre à jour l'article
        fields = ", ".join(article_data.keys())
        placeholders = ", ".join("?" for _ in article_data)
        values = list(article_data.values())
        
        query = f"""
        INSERT OR REPLACE INTO articles ({fields})
        VALUES ({placeholders})
        """
        
        await db.execute(query, values)
        await db.commit()
        
        return article_data["id"]

async def get_articles(
    page: int = 1, 
    page_size: int = 20, 
    source: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    read_later: Optional[bool] = None,
    read: Optional[bool] = None
) -> Dict[str, Any]:
    """Récupère les articles selon les critères de filtrage"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = sqlite3.Row
        
        # Construire la requête avec conditions
        query = "SELECT * FROM articles WHERE 1=1"
        params = []
        
        if source:
            query += " AND source = ?"
            params.append(source)
        
        if tag:
            query += " AND tags LIKE ?"
            params.append(f"%{tag}%")
        
        if search:
            query += " AND (title LIKE ? OR description LIKE ?)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")
        
        if read_later is not None:
            query += " AND read_later = ?"
            params.append(1 if read_later else 0)
        
        if read is not None:
            query += " AND read = ?"
            params.append(1 if read else 0)
        
        # Obtenir le compte total
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        async with db.execute(count_query, params) as cursor:
            total = await cursor.fetchone()
            total = dict(total)["COUNT(*)"] if total else 0
        
        # Ajouter ordre et pagination
        query += " ORDER BY pub_date DESC LIMIT ? OFFSET ?"
        params.append(page_size)
        params.append((page - 1) * page_size)
        
        # Exécuter la requête
        articles = []
        async with db.execute(query, params) as cursor:
            async for row in cursor:
                article = dict(row)
                # Convertir les tags de JSON à liste
                if article["tags"]:
                    article["tags"] = json.loads(article["tags"])
                else:
                    article["tags"] = []
                articles.append(article)
        
        return {
            "articles": articles,
            "total": total,
            "page": page,
            "page_size": page_size
        }

async def delete_old_articles(days: int = 30):
    """Supprime les articles plus anciens que le nombre de jours spécifié"""
    cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "DELETE FROM articles WHERE created_at < ?",
            (cutoff_date,)
        )
        await db.commit()

async def save_source(source_data: Dict[str, Any]):
    """Sauvegarde ou met à jour une source RSS"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        fields = ", ".join(source_data.keys())
        placeholders = ", ".join("?" for _ in source_data)
        values = list(source_data.values())
        
        query = f"""
        INSERT OR REPLACE INTO sources ({fields})
        VALUES ({placeholders})
        """
        
        await db.execute(query, values)
        await db.commit()

async def get_sources(active_only: bool = True) -> List[Dict[str, Any]]:
    """Récupère les sources RSS configurées"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = sqlite3.Row
        
        query = "SELECT * FROM sources"
        if active_only:
            query += " WHERE active = 1"
        
        sources = []
        async with db.execute(query) as cursor:
            async for row in cursor:
                sources.append(dict(row))
        
        return sources

async def update_article_status(article_id: str, read_later: Optional[bool] = None, read: Optional[bool] = None):
    """Met à jour le statut de lecture d'un article"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        updates = []
        params = []
        
        if read_later is not None:
            updates.append("read_later = ?")
            params.append(1 if read_later else 0)
        
        if read is not None:
            updates.append("read = ?")
            params.append(1 if read else 0)
        
        if not updates:
            return
        
        query = f"UPDATE articles SET {', '.join(updates)} WHERE id = ?"
        params.append(article_id)
        
        await db.execute(query, params)
        await db.commit() 