import logging
import re
from typing import List, Dict, Any
from keybert import KeyBERT
import spacy

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TagGenerator:
    """Classe pour générer des tags à partir du contenu des articles"""
    
    def __init__(self):
        # Liste de mots-clés techniques à rechercher
        self.tech_keywords = {
            # Cloud providers
            "aws": ["aws", "amazon web services", "ec2", "s3", "dynamodb", "lambda", "cloudfront"],
            "azure": ["azure", "microsoft azure", "azure functions", "cosmos db", "blob storage"],
            "gcp": ["gcp", "google cloud", "google cloud platform", "bigquery", "cloud storage"],
            
            # Technologies
            "kubernetes": ["kubernetes", "k8s", "container orchestration", "kubectl"],
            "docker": ["docker", "container", "containerization"],
            "terraform": ["terraform", "infrastructure as code", "iac"],
            "serverless": ["serverless", "faas", "function as a service"],
            
            # IA/ML
            "ai": ["artificial intelligence", "ai", "machine learning", "ml"],
            "llm": ["llm", "large language model", "language model", "gpt", "bert"],
            "ml": ["machine learning", "deep learning", "neural network"],
            
            # Cybersécurité
            "security": ["security", "cybersecurity", "cyber security", "infosec"],
            "encryption": ["encryption", "cryptography", "crypto"],
            "zero_trust": ["zero trust", "zero-trust"],
            
            # DevOps
            "devops": ["devops", "ci/cd", "continuous integration", "continuous deployment"],
            "gitops": ["gitops", "git-based operations"],
            
            # Data
            "big_data": ["big data", "data lake", "data warehouse"],
            "analytics": ["analytics", "business intelligence", "bi"],
            
            # Développement
            "backend": ["backend", "api", "rest api", "graphql"],
            "frontend": ["frontend", "spa", "single page application", "react", "vue", "angular"],
            "microservices": ["microservices", "service mesh", "api gateway"],
        }
        
        try:
            # Charger NLP pour l'extraction d'entités
            self.nlp = spacy.load("en_core_web_sm")
        except Exception as e:
            logger.warning(f"Impossible de charger spaCy: {str(e)}")
            self.nlp = None
        
        try:
            # Initialiser KeyBERT pour l'extraction de mots-clés
            self.keyword_model = KeyBERT()
        except Exception as e:
            logger.warning(f"Impossible de charger KeyBERT: {str(e)}")
            self.keyword_model = None
    
    async def generate_tags(self, title: str, content: str, existing_tags: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Générer des tags à partir du titre et du contenu"""
        if existing_tags is None:
            existing_tags = []
        
        existing_tag_names = {tag["name"].lower() for tag in existing_tags}
        tags = existing_tags.copy()
        
        # Texte complet à analyser
        full_text = f"{title} {content}"
        
        # 1. Recherche par mots-clés définis
        keyword_tags = self._match_keywords(full_text)
        for tag_name, confidence in keyword_tags:
            if tag_name.lower() not in existing_tag_names:
                tags.append({"name": tag_name, "confidence": confidence})
                existing_tag_names.add(tag_name.lower())
        
        # 2. Extraction d'entités via SpaCy si disponible
        if self.nlp:
            entity_tags = self._extract_entities(full_text)
            for tag_name, confidence in entity_tags:
                if tag_name.lower() not in existing_tag_names:
                    tags.append({"name": tag_name, "confidence": confidence})
                    existing_tag_names.add(tag_name.lower())
        
        # 3. Extraction de mots-clés via KeyBERT si disponible
        if self.keyword_model and content:
            keyword_tags = self._extract_keywords(content)
            for tag_name, confidence in keyword_tags:
                if tag_name.lower() not in existing_tag_names:
                    tags.append({"name": tag_name, "confidence": confidence})
                    existing_tag_names.add(tag_name.lower())
        
        # Limiter le nombre de tags
        tags.sort(key=lambda x: x["confidence"], reverse=True)
        return tags[:10]  # Limiter à 10 tags max
    
    def _match_keywords(self, text: str) -> List[tuple]:
        """Correspond le texte avec les mots-clés prédéfinis"""
        text = text.lower()
        matched_tags = []
        
        for tag_name, keywords in self.tech_keywords.items():
            for keyword in keywords:
                # Recherche de correspondance avec des mots entiers
                pattern = r'\b{}\b'.format(re.escape(keyword.lower()))
                matches = re.findall(pattern, text)
                
                if matches:
                    # La confiance est basée sur le nombre de correspondances
                    confidence = min(1.0, 0.6 + (len(matches) * 0.1))
                    matched_tags.append((tag_name.replace("_", " ").title(), confidence))
                    break  # Pas besoin de chercher d'autres mots-clés pour ce tag
        
        return matched_tags
    
    def _extract_entities(self, text: str) -> List[tuple]:
        """Extrait les entités du texte via SpaCy"""
        entity_tags = []
        
        try:
            doc = self.nlp(text[:10000])  # Limiter à 10K caractères pour la performance
            
            for ent in doc.ents:
                if ent.label_ in ["ORG", "PRODUCT", "GPE"]:
                    # Organisation, Produit ou Entité géopolitique
                    if len(ent.text) > 2 and ent.text.lower() not in ["the", "a", "an"]:
                        entity_tags.append((ent.text, 0.7))
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction d'entités: {str(e)}")
        
        return entity_tags
    
    def _extract_keywords(self, text: str) -> List[tuple]:
        """Extrait les mots-clés du texte via KeyBERT"""
        keyword_tags = []
        
        try:
            # Limiter la taille du texte pour la performance
            text = text[:5000]
            
            # Extraction de mots-clés avec KeyBERT
            keywords = self.keyword_model.extract_keywords(
                text, 
                keyphrase_ngram_range=(1, 2),
                stop_words='english', 
                use_maxsum=True, 
                top_n=5
            )
            
            for keyword, score in keywords:
                keyword_tags.append((keyword.title(), float(score)))
        
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction de mots-clés: {str(e)}")
        
        return keyword_tags 