# TechPulse

Application de veille technologique intelligente pour consultants en transformation digitale, centralisant les actualités tech depuis divers flux RSS.

## Fonctionnalités

- Agrégation de flux RSS (AWS, Azure, Google Cloud, etc.)
- Présentation sous forme de cartes interactives et esthétiques
- Génération automatique de tags techniques
- Filtrage par tags, source ou recherche texte
- Interface utilisateur moderne et réactive
- Badges de source avec dégradés de couleur par catégorie
- Effets visuels et animations pour améliorer l'expérience utilisateur
- Gestion complète des sources via l'interface
- Marquage des articles lus/à lire plus tard

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/KhalidOUARDIRHI/TechPulse.git
cd techpulse

# Installer les dépendances
pip install -r requirements.txt

# Télécharger le modèle SpaCy
python -m spacy download en_core_web_sm

# Initialiser l'application avec les données par défaut
python init_app.py

# Lancer l'application
python app.py
```

## Structure du projet

- `/app` - Code principal de l'application
  - `/api` - API FastAPI
  - `/models` - Modèles de données
  - `/services` - Services métier
  - `/db` - Gestion de la base de données SQLite
  - `/utils` - Utilitaires divers
- `/static` - Ressources statiques
  - `/css` - Feuilles de style
  - `/js` - Scripts JavaScript
  - `/images` - Images et ressources graphiques
- `/templates` - Templates HTML
- `/data` - Données de l'application (base SQLite)

## Utilitaires

- `reset_database.py` - Script pour réinitialiser complètement la base de données
- `cleanup_duplicates.py` - Nettoie les articles en double dans la base
- `init_app.py` - Initialise l'application avec les données par défaut

## Fonctionnalités UI

- Interface utilisateur moderne avec effets visuels et animations
- Carte d'articles avec animation au survol
- Badges de source avec dégradé de couleurs par catégorie
- Filtrage dynamique par tags populaires
- Système de notification toast
- Interface adaptative (responsive design)
- Système de pagination intuitif 