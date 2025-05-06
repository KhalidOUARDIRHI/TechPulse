import logging
import re
from typing import List, Dict, Any
import string
from collections import Counter

# Importations conditionnelles
try:
    from keybert import KeyBERT
    KEYBERT_AVAILABLE = True
except ImportError:
    KEYBERT_AVAILABLE = False

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False

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
            "security": ["security", "cybersecurity", "cyber security", "infosec", "vulnerability", "exploit", "cve"],
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
            
            # Ajouts de nouveaux domaines
            "blockchain": ["blockchain", "ethereum", "bitcoin", "crypto", "web3", "dapp", "nft"],
            "iot": ["iot", "internet of things", "connected devices", "smart home"],
            "mobile": ["mobile", "android", "ios", "swift", "kotlin", "react native", "flutter"],
            "automation": ["automation", "rpa", "robotic process automation"],
            "java": ["java", "spring", "spring boot", "hibernate", "jvm"],
            "python": ["python", "django", "flask", "fastapi", "numpy", "pandas"],
            "javascript": ["javascript", "typescript", "node.js", "nodejs", "npm", "react", "angular", "vue"],
            "devops_tools": ["jenkins", "gitlab", "github actions", "circleci", "travis", "ansible", "puppet", "chef"],
            "databases": ["database", "sql", "nosql", "postgresql", "mysql", "mongodb", "cassandra", "redis"],
            "cloud_native": ["cloud native", "cncf", "istio", "envoy", "prometheus", "grafana"],
            "networking": ["networking", "cdn", "dns", "load balancing", "firewall", "vpn", "proxy"]
        }
        
        # Liste des mots vides à ignorer
        self.stopwords = set([
            "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", 
            "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "could", "did", "do", 
            "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", "having", 
            "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", 
            "it", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", 
            "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she", 
            "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", 
            "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", 
            "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you", 
            "your", "yours", "yourself", "yourselves"
        ])
        
        # Modèles d'IA conditionnels
        self.nlp = None
        self.keyword_model = None
        
        if SPACY_AVAILABLE:
            try:
                # Charger NLP pour l'extraction d'entités
                self.nlp = spacy.load("en_core_web_sm")
                logger.info("Modèle SpaCy chargé avec succès")
            except Exception as e:
                logger.warning(f"Impossible de charger spaCy: {str(e)}")
        
        if KEYBERT_AVAILABLE:
            try:
                # Initialiser KeyBERT pour l'extraction de mots-clés
                self.keyword_model = KeyBERT()
                logger.info("Modèle KeyBERT chargé avec succès")
            except Exception as e:
                logger.warning(f"Impossible de charger KeyBERT: {str(e)}")
    
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
        
        # 2. Extraction de mots-clés basique (fonctionne même sans modèles)
        basic_tags = self._extract_basic_keywords(full_text)
        for tag_name, confidence in basic_tags:
            if tag_name.lower() not in existing_tag_names:
                tags.append({"name": tag_name, "confidence": confidence})
                existing_tag_names.add(tag_name.lower())
        
        # 3. Extraction d'entités via SpaCy si disponible
        if self.nlp:
            entity_tags = self._extract_entities(full_text)
            for tag_name, confidence in entity_tags:
                if tag_name.lower() not in existing_tag_names:
                    tags.append({"name": tag_name, "confidence": confidence})
                    existing_tag_names.add(tag_name.lower())
        
        # 4. Extraction de mots-clés via KeyBERT si disponible
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
    
    def _extract_basic_keywords(self, text: str) -> List[tuple]:
        """Extrait des mots-clés basiques du texte sans modèles d'IA"""
        # Nettoyer le texte
        text = text.lower()
        
        # Supprimer la ponctuation et remplacer par des espaces
        for punct in string.punctuation:
            text = text.replace(punct, ' ')
        
        # Diviser en mots
        words = text.split()
        
        # Filtrer les mots vides et trop courts
        filtered_words = [word for word in words if word not in self.stopwords and len(word) > 3]
        
        # Extraire les n-grammes (phrases de 2 ou 3 mots)
        ngrams = []
        for i in range(len(filtered_words) - 1):
            # Bigrams (2 mots)
            ngrams.append(" ".join(filtered_words[i:i+2]))
            # Trigrams (3 mots) si possible
            if i < len(filtered_words) - 2:
                ngrams.append(" ".join(filtered_words[i:i+3]))
        
        # Compter les occurrences
        word_counts = Counter(filtered_words)
        ngram_counts = Counter(ngrams)
        
        # Garder les mots et n-grammes les plus fréquents
        # Privilégier les n-grammes (plus spécifiques)
        keyword_tags = []
        
        # Ajouter les n-grammes les plus fréquents
        for ngram, count in ngram_counts.most_common(10):
            confidence = min(1.0, 0.5 + (count * 0.1))
            keyword_tags.append((ngram.title(), confidence))
        
        # Ajouter les mots simples les plus fréquents
        for word, count in word_counts.most_common(15):
            if len(word) > 3 and word not in [tag[0].lower() for tag in keyword_tags]:
                confidence = min(1.0, 0.4 + (count * 0.05))
                keyword_tags.append((word.title(), confidence))
        
        return keyword_tags[:15]  # Limiter aux 15 mots-clés les plus pertinents
    
    def _extract_entities(self, text: str) -> List[tuple]:
        """Extrait les entités du texte via SpaCy"""
        entity_tags = []
        
        try:
            doc = self.nlp(text[:10000])  # Limiter à 10K caractères pour la performance
            
            for ent in doc.ents:
                if ent.label_ in ["ORG", "PRODUCT", "GPE", "PERSON", "WORK_OF_ART", "EVENT"]:
                    # Filtrage des entités pertinentes
                    ent_text = ent.text.strip()
                    if (len(ent_text) > 2 and 
                        ent_text.lower() not in self.stopwords and 
                        not ent_text.isdigit()):
                        entity_tags.append((ent_text, 0.7))
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