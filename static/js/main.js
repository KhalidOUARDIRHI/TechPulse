// Configuration
const API_BASE_URL = '/api';
moment.locale('fr');

// État global
let currentState = {
    page: 1,
    pageSize: 20,
    source: null,
    tag: null,
    search: null,
    readLater: null,
    read: null,
    allTags: new Set() // Pour stocker tous les tags uniques
};

// Éléments DOM
const elements = {
    articlesContainer: document.getElementById('articlesContainer'),
    pagination: document.getElementById('pagination'),
    sourceFilter: document.getElementById('sourceFilter'),
    tagFilters: document.getElementById('tagFilters'),
    searchInput: document.getElementById('searchInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    readLaterBtn: document.getElementById('readLaterBtn'),
    sourceManagementBtn: document.getElementById('sourceManagementBtn'),
    addSourceForm: document.getElementById('addSourceForm'),
    sourcesList: document.getElementById('sourcesList'),
    articleTemplate: document.getElementById('articleTemplate')
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Chargement initial
    await Promise.all([
        loadSources(),
        loadArticles()
    ]);

    // Écouteurs d'événements
    setupEventListeners();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Filtrage par source
    elements.sourceFilter.addEventListener('change', (e) => {
        currentState.source = e.target.value || null;
        currentState.page = 1;
        loadArticles();
    });

    // Recherche
    elements.searchInput.addEventListener('input', debounce((e) => {
        currentState.search = e.target.value || null;
        currentState.page = 1;
        loadArticles();
    }, 300));

    // Rafraîchissement des flux
    elements.refreshBtn.addEventListener('click', async () => {
        elements.refreshBtn.disabled = true;
        elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            await fetch(`${API_BASE_URL}/refresh`, {
                method: 'POST'
            });
            await loadArticles();
        } catch (error) {
            console.error('Erreur lors du rafraîchissement:', error);
            showToast('Erreur lors du rafraîchissement des flux', 'danger');
        } finally {
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    });

    // Affichage des articles "à lire plus tard"
    elements.readLaterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentState.readLater = currentState.readLater ? null : true;
        currentState.read = null;
        currentState.page = 1;
        
        // Mettre à jour l'apparence du bouton
        elements.readLaterBtn.classList.toggle('active');
        loadArticles();
    });

    // Gestion des sources
    elements.sourceManagementBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const sourceModal = new bootstrap.Modal(document.getElementById('sourceModal'));
        sourceModal.show();
    });

    // Ajout de source
    elements.addSourceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sourceData = {
            name: document.getElementById('sourceName').value,
            url: document.getElementById('sourceUrl').value,
            category: document.getElementById('sourceCategory').value,
            active: true
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/sources`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sourceData)
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout de la source');
            }
            
            // Réinitialiser le formulaire
            elements.addSourceForm.reset();
            
            // Recharger les sources et les articles
            await Promise.all([
                loadSources(),
                loadArticles()
            ]);
            
            showToast('Source ajoutée avec succès!', 'success');
        } catch (error) {
            console.error('Erreur:', error);
            showToast('Erreur lors de l\'ajout de la source', 'danger');
        }
    });

    // Délégation d'événements pour les clics sur la pagination
    elements.pagination.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.tagName === 'A' && e.target.dataset.page) {
            currentState.page = parseInt(e.target.dataset.page);
            loadArticles();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Délégation d'événements pour les clics sur les tags
    elements.tagFilters.addEventListener('click', (e) => {
        const tagElement = e.target.closest('.tag-badge');
        if (tagElement) {
            const tag = tagElement.dataset.tag;
            
            // Toggle le tag actif
            if (currentState.tag === tag) {
                currentState.tag = null;
                tagElement.classList.remove('active');
            } else {
                // Désactiver le tag précédemment actif
                const activeTags = elements.tagFilters.querySelectorAll('.tag-badge.active');
                activeTags.forEach(t => t.classList.remove('active'));
                
                currentState.tag = tag;
                tagElement.classList.add('active');
            }
            
            currentState.page = 1;
            loadArticles();
        }
    });

    // Délégation d'événements pour le conteneur d'articles
    elements.articlesContainer.addEventListener('click', async (e) => {
        // Pour le bouton "à lire plus tard"
        const readLaterBtn = e.target.closest('.read-later-btn');
        if (readLaterBtn) {
            e.preventDefault();
            const articleId = readLaterBtn.closest('[data-id]').dataset.id;
            const isActive = readLaterBtn.classList.contains('active');
            
            try {
                await updateArticleStatus(articleId, { read_later: !isActive });
                readLaterBtn.classList.toggle('active');
            } catch (error) {
                console.error('Erreur:', error);
            }
        }
        
        // Pour le bouton "marquer comme lu"
        const markReadBtn = e.target.closest('.mark-read-btn');
        if (markReadBtn) {
            e.preventDefault();
            const articleId = markReadBtn.closest('[data-id]').dataset.id;
            const isActive = markReadBtn.classList.contains('active');
            
            try {
                await updateArticleStatus(articleId, { read: !isActive });
                markReadBtn.classList.toggle('active');
            } catch (error) {
                console.error('Erreur:', error);
            }
        }
    });
}

// Chargement des articles
async function loadArticles() {
    // Afficher le chargement
    elements.articlesContainer.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-2">Chargement des articles...</p>
        </div>
    `;
    
    // Construire les paramètres de requête
    const params = new URLSearchParams({
        page: currentState.page,
        page_size: currentState.pageSize
    });
    
    if (currentState.source) params.append('source', currentState.source);
    if (currentState.tag) params.append('tag', currentState.tag);
    if (currentState.search) params.append('search', currentState.search);
    if (currentState.readLater !== null) params.append('read_later', currentState.readLater);
    if (currentState.read !== null) params.append('read', currentState.read);
    
    try {
        const response = await fetch(`${API_BASE_URL}/articles?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des articles');
        }
        
        const data = await response.json();
        renderArticles(data);
        renderPagination(data);
        updateTagFilters(data.articles);
    } catch (error) {
        console.error('Erreur:', error);
        elements.articlesContainer.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="alert alert-danger">
                    Erreur lors du chargement des articles. Veuillez réessayer.
                </div>
            </div>
        `;
    }
}

// Chargement des sources
async function loadSources() {
    try {
        const response = await fetch(`${API_BASE_URL}/sources`);
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des sources');
        }
        
        const sources = await response.json();
        renderSourceOptions(sources);
        renderSourcesList(sources);
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Mise à jour du statut d'un article
async function updateArticleStatus(articleId, status) {
    const params = new URLSearchParams();
    if (status.read_later !== undefined) params.append('read_later', status.read_later);
    if (status.read !== undefined) params.append('read', status.read);
    
    const response = await fetch(`${API_BASE_URL}/articles/${articleId}/status?${params.toString()}`, {
        method: 'PUT'
    });
    
    if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour du statut');
    }
    
    return await response.json();
}

// Rendu des articles
function renderArticles(data) {
    if (!data.articles || data.articles.length === 0) {
        elements.articlesContainer.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="text-muted">Aucun article trouvé.</p>
            </div>
        `;
        return;
    }
    
    elements.articlesContainer.innerHTML = '';
    
    data.articles.forEach(article => {
        // Cloner le template
        const template = elements.articleTemplate.content.cloneNode(true);
        const articleElement = template.querySelector('.col-md-6');
        
        // Définir l'ID de l'article
        articleElement.dataset.id = article.id;
        
        // Remplir les données
        const img = articleElement.querySelector('.card-img-top');
        if (article.image_url) {
            img.src = article.image_url;
        } else {
            img.src = '/static/images/placeholder.jpg';
            img.alt = 'Pas d\'image disponible';
        }
        
        articleElement.querySelector('.source-badge').textContent = article.source;
        articleElement.querySelector('.pub-date').textContent = moment(article.pub_date).fromNow();
        articleElement.querySelector('.card-title').textContent = article.title;
        articleElement.querySelector('.description').textContent = article.description || article.summary || '';
        articleElement.querySelector('.article-link').href = article.link;
        
        // Ajouter les tags
        const tagsContainer = articleElement.querySelector('.tags-container');
        if (article.tags && article.tags.length > 0) {
            article.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag-badge';
                tagElement.textContent = tag.name;
                tagsContainer.appendChild(tagElement);
                
                // Ajouter au set de tous les tags
                currentState.allTags.add(tag.name);
            });
        }
        
        // Définir l'état des boutons
        if (article.read_later) {
            articleElement.querySelector('.read-later-btn').classList.add('active');
        }
        
        if (article.read) {
            articleElement.querySelector('.mark-read-btn').classList.add('active');
        }
        
        // Ajouter à la liste
        elements.articlesContainer.appendChild(articleElement);
    });
}

// Rendu de la pagination
function renderPagination(data) {
    const totalPages = Math.ceil(data.total / data.page_size);
    
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Bouton précédent
    html += `
        <li class="page-item ${data.page === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${data.page - 1}" aria-label="Précédent">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Pages
    const startPage = Math.max(1, data.page - 2);
    const endPage = Math.min(totalPages, data.page + 2);
    
    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === data.page ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        html += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
    }
    
    // Bouton suivant
    html += `
        <li class="page-item ${data.page === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${data.page + 1}" aria-label="Suivant">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    elements.pagination.innerHTML = html;
}

// Rendu des options de source
function renderSourceOptions(sources) {
    let html = '<option value="">Toutes les sources</option>';
    
    sources.forEach(source => {
        html += `<option value="${source.name}" ${currentState.source === source.name ? 'selected' : ''}>${source.name}</option>`;
    });
    
    elements.sourceFilter.innerHTML = html;
}

// Rendu de la liste des sources dans le modal
function renderSourcesList(sources) {
    if (!sources || sources.length === 0) {
        elements.sourcesList.innerHTML = '<li class="list-group-item">Aucune source configurée</li>';
        return;
    }
    
    let html = '';
    
    sources.forEach(source => {
        html += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${source.name}</strong>
                    <small class="d-block text-muted">${source.url}</small>
                    <span class="badge bg-secondary">${source.category}</span>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-danger delete-source-btn" data-source="${source.name}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
    });
    
    elements.sourcesList.innerHTML = html;
    
    // Ajouter l'événement de suppression
    elements.sourcesList.querySelectorAll('.delete-source-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const sourceName = btn.dataset.source;
            
            if (confirm(`Voulez-vous vraiment supprimer la source "${sourceName}" ?`)) {
                try {
                    const response = await fetch(`${API_BASE_URL}/sources/${sourceName}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Erreur lors de la suppression');
                    }
                    
                    // Recharger les sources et les articles
                    await Promise.all([
                        loadSources(),
                        loadArticles()
                    ]);
                    
                    showToast('Source supprimée avec succès!', 'success');
                } catch (error) {
                    console.error('Erreur:', error);
                    showToast('Erreur lors de la suppression de la source', 'danger');
                }
            }
        });
    });
}

// Mise à jour des filtres de tags
function updateTagFilters(articles) {
    // Extraire tous les tags uniques des articles actuels
    const currentTags = new Set();
    
    articles.forEach(article => {
        if (article.tags && article.tags.length > 0) {
            article.tags.forEach(tag => {
                currentTags.add(tag.name);
            });
        }
    });
    
    // Vider le conteneur de filtres
    elements.tagFilters.innerHTML = '';
    
    // Ajouter les tags les plus pertinents (ceux des articles actuels)
    currentTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag-badge';
        tagElement.dataset.tag = tag;
        tagElement.textContent = tag;
        
        if (currentState.tag === tag) {
            tagElement.classList.add('active');
        }
        
        elements.tagFilters.appendChild(tagElement);
    });
}

// Utilitaire pour debounce les événements d'input
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Affichage de notifications toast
function showToast(message, type = 'info') {
    // Créer le toast dynamiquement
    const toastContainer = document.createElement('div');
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '5';
    
    toastContainer.innerHTML = `
        <div class="toast align-items-center text-white bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toastContainer);
    
    const toastElement = toastContainer.querySelector('.toast');
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    
    toast.show();
    
    // Supprimer le conteneur après la fermeture
    toastElement.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toastContainer);
    });
} 