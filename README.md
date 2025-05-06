# TechPulse

Application de veille technologique intelligente pour consultants en transformation digitale, centralisant les actualités tech depuis divers flux RSS.

## Fonctionnalités

- Agrégation de flux RSS (AWS, Azure, Google Cloud, etc.)
- Présentation sous forme de "tickets dynamiques"
- Génération automatique de tags techniques
- Filtrage par tags, domaine ou date
- Résumés automatiques des articles

## Installation

```bash
# Cloner le dépôt
git clone [url-du-repo]
cd techpulse

# Installer les dépendances
pip install -r requirements.txt

# Télécharger le modèle SpaCy
python -m spacy download en_core_web_sm

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
- `/templates` - Templates HTML 