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
    view: 'grid', // Vue par défaut (grid ou list)
    allTags: new Set(),
    generatedTags: new Set(),
    sourceCounts: {}, // Pour stocker le nombre d'articles par source
    isLoading: false
};

// Éléments DOM
const elements = {
    articlesContainer: document.getElementById('articlesContainer'),
    pagination: document.getElementById('pagination'),
    searchInput: document.getElementById('searchInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    readLaterBtn: document.getElementById('readLaterBtn'),
    sourceManagementBtn: document.getElementById('sourceManagementBtn'),
    addSourceForm: document.getElementById('addSourceForm'),
    sourcesList: document.getElementById('sourcesList'),
    articleTemplate: document.getElementById('articleTemplate'),
    sourceMenuItemTemplate: document.getElementById('sourceMenuItemTemplate'),
    sourcesMenuList: document.getElementById('sourcesMenuList'),
    totalCount: document.getElementById('totalCount'),
    saveCount: document.getElementById('saveCount'),
    viewControls: document.querySelector('.view-controls'),
    filterDropdown: document.getElementById('filterDropdown'),
    tagFilters: document.getElementById('tagFilters')
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
    
    // Initialiser la vue
    initializeView();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Recherche
    elements.searchInput.addEventListener('input', debounce((e) => {
        currentState.search = e.target.value || null;
        currentState.page = 1;
        loadArticles();
    }, 300));

    // Rafraîchissement des flux
    elements.refreshBtn.addEventListener('click', async () => {
        if (currentState.isLoading) return;
        
        elements.refreshBtn.classList.add('spin');
        
        try {
            await fetch(`${API_BASE_URL}/refresh`, {
                method: 'POST'
            });
            await loadArticles();
            showToast('Flux rafraîchis avec succès!', 'success');
        } catch (error) {
            console.error('Erreur lors du rafraîchissement:', error);
            showToast('Erreur lors du rafraîchissement des flux', 'danger');
        } finally {
            elements.refreshBtn.classList.remove('spin');
        }
    });

    // Affichage des articles "à lire plus tard"
    elements.readLaterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const wasActive = currentState.readLater;
        
        // Réinitialiser les filtres
        currentState.readLater = wasActive ? null : true;
        currentState.read = null;
        currentState.source = null;
        currentState.page = 1;
        
        // Mettre à jour l'apparence
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
        
        if (!wasActive) {
            elements.readLaterBtn.classList.add('active');
        } else {
            document.querySelector('.menu-item:first-child').classList.add('active');
        }
        
        loadArticles();
    });

    // Gestion des sources
    elements.sourceManagementBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const sourceModal = new bootstrap.Modal(document.getElementById('sourceModal'));
        sourceModal.show();
    });

    // Délégation d'événements pour les clics sur les sources du menu
    elements.sourcesMenuList.addEventListener('click', (e) => {
        e.preventDefault();
        const sourceItem = e.target.closest('.source-menu-item');
        if (sourceItem) {
            const sourceName = sourceItem.dataset.source;
            
            document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
            sourceItem.classList.add('active');
            
            currentState.readLater = null;
            currentState.source = sourceName;
            currentState.page = 1;
            
            loadArticles();
        }
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
    document.addEventListener('click', (e) => {
        const tagElement = e.target.closest('.tag-badge');
        if (tagElement && tagElement.dataset.tag) {
            const tag = tagElement.dataset.tag;
            
            // Mettre à jour l'UI des tags
            document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.tag-badge').forEach(t => t.classList.remove('active'));
            
            if (currentState.tag === tag) {
                currentState.tag = null;
                document.querySelector('.menu-item:first-child').classList.add('active');
            } else {
                tagElement.classList.add('active');
                currentState.tag = tag;
                document.querySelectorAll('.tag-badge').forEach(t => {
                    if (t.dataset.tag === tag) {
                        t.classList.add('active');
                    }
                });
            }
            
            currentState.source = null;
            currentState.readLater = null;
            currentState.page = 1;
            loadArticles();
        }
    });

    // Switcher de vue (grille/liste)
    elements.viewControls.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.btn-view');
        if (viewBtn) {
            const view = viewBtn.dataset.view;
            if (view && view !== currentState.view) {
                currentState.view = view;
                
                // Mettre à jour l'UI
                document.querySelectorAll('.btn-view').forEach(btn => btn.classList.remove('active'));
                viewBtn.classList.add('active');
                
                // Mise à jour de la classe du container
                elements.articlesContainer.classList.remove('grid-view', 'list-view');
                elements.articlesContainer.classList.add(`${view}-view`);
            }
        }
    });

    // Délégation d'événements pour le conteneur d'articles (boutons d'action)
    elements.articlesContainer.addEventListener('click', async (e) => {
        // Pour le bouton "à lire plus tard"
        const readLaterBtn = e.target.closest('.read-later-btn');
        if (readLaterBtn) {
            e.preventDefault();
            const articleId = readLaterBtn.closest('.article-card').dataset.id;
            const isActive = readLaterBtn.classList.contains('active');
            
            try {
                await updateArticleStatus(articleId, { read_later: !isActive });
                readLaterBtn.classList.toggle('active');
                const icon = readLaterBtn.querySelector('i');
                if (!isActive) {
                    icon.className = 'fas fa-bookmark';
                    showToast('Article ajouté à la liste "À lire plus tard"', 'info');
                    
                    // Mettre à jour le compteur
                    updateSavedCount(1);
                } else {
                    icon.className = 'far fa-bookmark';
                    showToast('Article retiré de la liste "À lire plus tard"', 'info');
                    
                    // Mettre à jour le compteur
                    updateSavedCount(-1);
                }
            } catch (error) {
                console.error('Erreur:', error);
                showToast('Erreur lors de la mise à jour du statut', 'danger');
            }
        }
        
        // Pour le bouton "marquer comme lu"
        const markReadBtn = e.target.closest('.mark-read-btn');
        if (markReadBtn) {
            e.preventDefault();
            const articleCard = markReadBtn.closest('.article-card');
            const articleId = articleCard.dataset.id;
            const isActive = markReadBtn.classList.contains('active');
            
            try {
                await updateArticleStatus(articleId, { read: !isActive });
                markReadBtn.classList.toggle('active');
                const icon = markReadBtn.querySelector('i');
                
                if (!isActive) {
                    icon.className = 'fas fa-check-circle';
                    showToast('Article marqué comme lu', 'success');
                    articleCard.classList.add('read');
                    
                    // Mettre à jour le compteur total
                    updateTotalCount(-1);
                } else {
                    icon.className = 'far fa-check-circle';
                    articleCard.classList.remove('read');
                    
                    // Mettre à jour le compteur total
                    updateTotalCount(1);
                }
            } catch (error) {
                console.error('Erreur:', error);
                showToast('Erreur lors de la mise à jour du statut', 'danger');
            }
        }
    });
    
    // Filtre de lecture (lu, non lu, tous)
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Mettre à jour l'UI
            dropdownItems.forEach(item => item.classList.remove('active'));
            item.classList.add('active');
            
            // Mettre à jour le texte du bouton
            elements.filterDropdown.textContent = item.textContent;
            elements.filterDropdown.appendChild(document.createElement('i')).className = 'fas fa-chevron-down';
            
            // Mettre à jour l'état
            const text = item.textContent.trim();
            if (text === 'Non lu') {
                currentState.read = false;
            } else if (text === 'Lus') {
                currentState.read = true;
            } else {
                currentState.read = null;
            }
            
            currentState.page = 1;
            loadArticles();
        });
    });

    // Délégation pour les sources dans le modal
    elements.sourcesList.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-source-btn');
        if (deleteBtn) {
            e.preventDefault();
            const sourceId = deleteBtn.dataset.id;
            
            if (confirm('Êtes-vous sûr de vouloir supprimer cette source?')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`, {
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
        }
        
        const toggleBtn = e.target.closest('.toggle-source-btn');
        if (toggleBtn) {
            e.preventDefault();
            const sourceId = toggleBtn.dataset.id;
            const isActive = toggleBtn.dataset.active === 'true';
            
            try {
                const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ active: !isActive })
                });
                
                if (!response.ok) {
                    throw new Error('Erreur lors de la mise à jour');
                }
                
                // Recharger les sources et les articles
                await Promise.all([
                    loadSources(),
                    loadArticles()
                ]);
                
                showToast(`Source ${!isActive ? 'activée' : 'désactivée'} avec succès!`, 'success');
            } catch (error) {
                console.error('Erreur:', error);
                showToast('Erreur lors de la mise à jour de la source', 'danger');
            }
        }
    });
}

// Initialisation de la vue
function initializeView() {
    // Définir la vue par défaut
    elements.articlesContainer.classList.add(`${currentState.view}-view`);
    
    // Activer le bouton correspondant
    document.querySelector(`.btn-view[data-view="${currentState.view}"]`).classList.add('active');
}

// Mise à jour du compteur total
function updateTotalCount(delta = 0) {
    const currentCount = parseInt(elements.totalCount.textContent) || 0;
    elements.totalCount.textContent = Math.max(0, currentCount + delta);
}

// Mise à jour du compteur "à lire plus tard"
function updateSavedCount(delta = 0) {
    const currentCount = parseInt(elements.saveCount.textContent) || 0;
    elements.saveCount.textContent = Math.max(0, currentCount + delta);
}

// Chargement des articles depuis l'API
async function loadArticles() {
    currentState.isLoading = true;
    
    // Afficher un indicateur de chargement
    elements.articlesContainer.innerHTML = `
        <div class="loading-indicator">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement...</span>
            </div>
            <p>Chargement des articles...</p>
        </div>
    `;
    
    // Construire l'URL avec les paramètres
    let url = `${API_BASE_URL}/articles?page=${currentState.page}&page_size=${currentState.pageSize}`;
    
    if (currentState.source) {
        url += `&source=${currentState.source}`;
    }
    
    if (currentState.tag) {
        url += `&tag=${encodeURIComponent(currentState.tag)}`;
    }
    
    if (currentState.search) {
        url += `&search=${encodeURIComponent(currentState.search)}`;
    }
    
    if (currentState.readLater) {
        url += '&read_later=true';
    }
    
    if (currentState.read === true) {
        url += '&read=true';
    } else if (currentState.read === false) {
        url += '&read=false';
    }
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('API Response:', data); // Ajout d'un log pour diagnostiquer
        
        renderArticles(data);
        renderPagination(data);
        updateTagFilters(data.articles);
        
        // Mettre à jour le compteur total
        elements.totalCount.textContent = data.total;
    } catch (error) {
        console.error('Erreur lors du chargement des articles:', error);
        elements.articlesContainer.innerHTML = `
            <div class="loading-indicator">
                <div class="alert alert-danger" role="alert">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Erreur lors du chargement des articles.
                </div>
                <button class="btn btn-primary mt-3" onclick="loadArticles()">
                    <i class="fas fa-sync-alt me-1"></i> Réessayer
                </button>
            </div>
        `;
    } finally {
        currentState.isLoading = false;
    }
}

// Chargement des sources depuis l'API
async function loadSources() {
    try {
        const response = await fetch(`${API_BASE_URL}/sources`);
        const sources = await response.json();
        
        renderSourcesInMenu(sources);
        renderSourcesList(sources);
        
        // Compter les articles à lire plus tard
        try {
            const readLaterResponse = await fetch(`${API_BASE_URL}/articles?read_later=true&page=1&page_size=1`);
            const readLaterData = await readLaterResponse.json();
            elements.saveCount.textContent = readLaterData.total;
        } catch (error) {
            console.error('Erreur lors du comptage des articles à lire plus tard:', error);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des sources:', error);
    }
}

// Mise à jour du statut d'un article
async function updateArticleStatus(articleId, status) {
    // Construire l'URL avec les paramètres
    let url = `${API_BASE_URL}/articles/${articleId}/status?`;
    
    // Ajouter les paramètres à l'URL
    if (status.read_later !== undefined) {
        url += `read_later=${status.read_later}`;
    }
    
    if (status.read !== undefined) {
        if (url.endsWith('?')) {
            url += `read=${status.read}`;
        } else {
            url += `&read=${status.read}`;
        }
    }
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        console.error('Erreur de mise à jour:', await response.text());
        throw new Error('Erreur lors de la mise à jour du statut');
    }
    
    return await response.json();
}

// Rendu des articles
function renderArticles(data) {
    elements.articlesContainer.innerHTML = '';
    
    if (data.articles.length === 0) {
        elements.articlesContainer.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-info-circle fa-2x mb-3 text-muted"></i>
                <p>Aucun article trouvé pour les critères sélectionnés.</p>
            </div>
        `;
        return;
    }
    
    data.articles.forEach((article) => {
        const clone = elements.articleTemplate.content.cloneNode(true);
        const articleElement = clone.querySelector('.article-card');
        
        // Définir l'ID de l'article
        articleElement.dataset.id = article.id;
        
        // Ajouter la classe "read" si l'article est lu
        if (article.read) {
            articleElement.classList.add('read');
        }
        
        // Image
        const imgContainer = clone.querySelector('.article-image');
        const imgElement = clone.querySelector('.article-image img');
        
        if (article.image_url && article.image_url.trim() !== '') {
            imgElement.src = article.image_url;
            imgElement.alt = article.title;
        } else {
            // Générer un placeholder avec le nom de la source et une couleur de fond
            imgContainer.classList.add('no-image');
            imgElement.style.display = 'none';
            
            const bgColor = getColorFromSource(article.source);
            imgContainer.style.backgroundColor = bgColor;
            
            // Créer un div pour afficher le nom de la source
            const sourceElement = document.createElement('div');
            sourceElement.className = 'source-name';
            sourceElement.textContent = article.source;
            imgContainer.appendChild(sourceElement);
        }
        
        // Titre et description
        clone.querySelector('.article-title').textContent = article.title || 'Sans titre';
        const descriptionElement = clone.querySelector('.article-description');
        if (article.description && article.description.trim() !== '') {
            descriptionElement.textContent = article.description;
        } else {
            descriptionElement.textContent = 'Aucune description disponible pour cet article.';
            descriptionElement.classList.add('text-muted', 'fst-italic');
        }
        
        // Badge source et date
        const sourceElement = clone.querySelector('.article-source');
        sourceElement.textContent = article.source;
        
        // Déterminer une catégorie basée sur la source (si aucune fournie)
        let category = 'tech';
        if (article.source.toLowerCase().includes('aws') || article.source.toLowerCase().includes('azure') || article.source.toLowerCase().includes('cloud')) {
            category = 'cloud';
        } else if (article.source.toLowerCase().includes('security') || article.source.toLowerCase().includes('sécu')) {
            category = 'security';
        } else if (article.source.toLowerCase().includes('ai') || article.source.toLowerCase().includes('ia')) {
            category = 'ia';
        } else if (article.source.toLowerCase().includes('dev')) {
            category = 'dev';
        }
        sourceElement.dataset.category = category;
        
        // Date de publication
        clone.querySelector('.article-date').textContent = moment(article.pub_date).fromNow();
        
        // Tags
        const tagsContainer = clone.querySelector('.article-tags');
        
        // Préparer les tags
        let articleTags = [];
        
        // Utiliser les tags existants s'ils existent
        if (article.tags && article.tags.length > 0) {
            articleTags = article.tags;
        } else {
            // Générer des tags à partir du contenu et du titre
            const generatedTags = generateTagsFromContent(article.title, article.description);
            if (generatedTags.length > 0) {
                articleTags = generatedTags.map(tag => ({ name: tag }));
            }
        }
        
        // Afficher les tags
        articleTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.classList.add('tag-badge');
            tagElement.textContent = typeof tag === 'string' ? tag : tag.name;
            tagElement.dataset.tag = typeof tag === 'string' ? tag : tag.name;
            tagsContainer.appendChild(tagElement);
        });
        
        // Lien vers l'article
        const articleLink = clone.querySelector('.article-link');
        articleLink.href = article.link;
        
        // État des boutons
        const readLaterBtn = clone.querySelector('.read-later-btn');
        const markReadBtn = clone.querySelector('.mark-read-btn');
        
        if (article.read_later) {
            readLaterBtn.classList.add('active');
            readLaterBtn.querySelector('i').className = 'fas fa-bookmark';
        } else {
            readLaterBtn.classList.remove('active');
            readLaterBtn.querySelector('i').className = 'far fa-bookmark';
        }
        
        if (article.read) {
            markReadBtn.classList.add('active');
            markReadBtn.querySelector('i').className = 'fas fa-check-circle';
        } else {
            markReadBtn.classList.remove('active');
            markReadBtn.querySelector('i').className = 'far fa-check-circle';
        }
        
        elements.articlesContainer.appendChild(clone);
    });
}

// Rendu des sources dans le menu latéral
function renderSourcesInMenu(sources) {
    elements.sourcesMenuList.innerHTML = '';
    
    const activeSources = sources.filter(s => s.active);
    
    if (activeSources.length === 0) {
        elements.sourcesMenuList.innerHTML = '<div class="no-sources">Aucune source disponible</div>';
        return;
    }
    
    activeSources.forEach(source => {
        const clone = elements.sourceMenuItemTemplate.content.cloneNode(true);
        const menuItem = clone.querySelector('.source-menu-item');
        
        menuItem.dataset.source = source.name;
        menuItem.querySelector('.source-name').textContent = source.name;
        
        // Par défaut, mettre 0 ou le nombre stocké précédemment
        const count = currentState.sourceCounts[source.name] || 0;
        menuItem.querySelector('.item-count').textContent = count;
        
        // Ajouter la classe active si c'est la source actuellement sélectionnée
        if (currentState.source === source.name) {
            menuItem.classList.add('active');
        }
        
        elements.sourcesMenuList.appendChild(clone);
    });
}

// Rendu de la liste des sources dans le modal
function renderSourcesList(sources) {
    elements.sourcesList.innerHTML = '';
    
    if (sources.length === 0) {
        elements.sourcesList.innerHTML = `
            <li class="list-group-item">
                <div class="text-center text-muted">
                    <i class="fas fa-info-circle me-2"></i>
                    Aucune source configurée.
                </div>
            </li>
        `;
        return;
    }
    
    sources.forEach(source => {
        const sourceItem = document.createElement('li');
        sourceItem.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
        
        sourceItem.innerHTML = `
            <div>
                <span class="badge article-source me-2" data-category="${source.category || 'other'}">${source.name}</span>
                <small class="text-muted">${source.url}</small>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-${source.active ? 'warning' : 'success'} toggle-source-btn me-1" 
                        data-id="${source.name}" 
                        data-active="${source.active}"
                        title="${source.active ? 'Désactiver' : 'Activer'} cette source">
                    <i class="fas ${source.active ? 'fa-pause' : 'fa-play'}"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-source-btn" 
                        data-id="${source.name}"
                        title="Supprimer cette source">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        elements.sourcesList.appendChild(sourceItem);
    });
}

// Mise à jour des filtres de tag
function updateTagFilters(articles) {
    // Réinitialiser les tags pour éviter les duplications
    currentState.allTags = new Set();
    
    // Collecter tous les tags de tous les articles
    articles.forEach(article => {
        if (article.tags && article.tags.length > 0) {
            article.tags.forEach(tag => {
                const tagName = typeof tag === 'string' ? tag : tag.name;
                if (tagName) currentState.allTags.add(tagName);
            });
        }
    });
    
    // Convertir en array et trier alphabétiquement
    const allTagsArray = Array.from(currentState.allTags).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    // Ajouter les tags générés
    if (currentState.generatedTags.size > 0) {
        currentState.generatedTags.forEach(tag => {
            if (!allTagsArray.includes(tag)) {
                allTagsArray.push(tag);
            }
        });
        // Retrier après l'ajout des nouveaux tags
        allTagsArray.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }
    
    // Mettre à jour l'UI avec tous les tags
    elements.tagFilters.innerHTML = '';
    
    // Si aucun tag n'est disponible, afficher un message
    if (allTagsArray.length === 0) {
        elements.tagFilters.innerHTML = '<div class="text-muted">Aucun tag disponible</div>';
        return;
    }
    
    // Afficher tous les tags
    allTagsArray.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag-badge');
        tagElement.dataset.tag = tag;
        tagElement.textContent = tag;
        
        if (currentState.tag === tag) {
            tagElement.classList.add('active');
        }
        
        elements.tagFilters.appendChild(tagElement);
    });
    
    // Afficher le nombre total de tags
    const tagCount = document.createElement('div');
    tagCount.className = 'text-muted mt-2 small';
    tagCount.textContent = `${allTagsArray.length} tags au total`;
    elements.tagFilters.appendChild(tagCount);
}

// Fonction utilitaire pour debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Affichage d'un toast de notification
function showToast(message, type = 'info') {
    // Créer l'élément de toast s'il n'existe pas
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '5';
        document.body.appendChild(toastContainer);
    }
    
    // Créer le toast
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast show fade-in-up`;
    toast.id = toastId;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Contenu du toast
    toast.innerHTML = `
        <div class="toast-header bg-${type} text-white">
            <strong class="me-auto">TechPulse</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Fermer"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Ajouter au conteneur
    toastContainer.appendChild(toast);
    
    // Fermer automatiquement après 3 secondes
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
    
    // Gérer le clic sur le bouton fermer
    const closeButton = toast.querySelector('.btn-close');
    closeButton.addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
}

// Animation de fondu
document.addEventListener('DOMContentLoaded', () => {
    // Ajouter une classe CSS pour l'animation de fondu des toasts
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .fade-out {
            animation: fadeOut 0.3s ease forwards;
        }
    `;
    document.head.appendChild(style);
});

// Fonction pour extraire les initiales à partir du titre d'un article
function getInitialsFromTitle(title) {
    if (!title) return '??';
    
    // Extraire les deux premiers mots significatifs
    const words = title.split(/\s+/).filter(w => w.length > 2);
    
    if (words.length === 0) return '??';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    
    // Prendre les initiales des deux premiers mots significatifs
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

// Fonction pour générer une couleur basée sur le nom de la source
function getColorFromSource(source) {
    if (!source) return '#4a88e5';
    
    // Générer un hash simple basé sur le nom de la source
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
        hash = source.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convertir en une couleur HSL pour de meilleures couleurs
    const h = hash % 360;
    return `hsl(${h}, 70%, 60%)`;
}

// Fonction pour déterminer la couleur du texte en fonction du fond
function getContrastColor(bgColor) {
    // Pour les couleurs HSL, on peut simplement utiliser la luminosité
    // Si la couleur commence par "hsl", extraire la luminosité
    if (bgColor.startsWith('hsl')) {
        const luminosity = parseInt(bgColor.match(/(\d+)%\)/)[1]);
        return luminosity > 60 ? '#333333' : '#ffffff';
    }
    
    // Fallback pour les autres formats de couleur
    return '#ffffff';
}

// Fonction pour générer des tags à partir du contenu de l'article
function generateTagsFromContent(title, description) {
    // Si pas de contenu, impossible de générer des tags
    if (!title && !description) return [];
    
    // Fusionner titre et description
    const content = `${title || ''} ${description || ''}`.toLowerCase();
    
    // Liste des mots vides (stopwords) à ignorer
    const stopwords = new Set([
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", 
        "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", 
        "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", 
        "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", 
        "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", 
        "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", 
        "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", 
        "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", 
        "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", 
        "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", 
        "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", 
        "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", 
        "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", 
        "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", 
        "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", 
        "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", 
        "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
    ]);
    
    // Termes techniques courants à identifier en priorité
    const techTerms = {
        "cloud": ["cloud", "aws", "azure", "gcp", "google cloud", "amazon web", "microsoft azure"],
        "ia": ["ai", "ml", "machine learning", "artificial intelligence", "deep learning", "neural", "gpt", "llm"],
        "security": ["security", "cybersecurity", "cyber", "hack", "vulnerability", "exploit", "cve", "threat"],
        "dev": ["developer", "programming", "code", "software", "development", "api"],
        "devops": ["devops", "ci/cd", "pipeline", "jenkins", "docker", "kubernetes", "k8s", "container"],
        "database": ["database", "sql", "nosql", "mongodb", "postgresql", "mysql"],
        "web": ["javascript", "css", "html", "web", "frontend", "backend", "fullstack"],
        "mobile": ["android", "ios", "mobile", "app", "smartphone"]
    };
    
    // Recherche de termes techniques
    const technicalTags = [];
    for (const [category, terms] of Object.entries(techTerms)) {
        for (const term of terms) {
            if (content.includes(term)) {
                technicalTags.push(category.charAt(0).toUpperCase() + category.slice(1));
                break;
            }
        }
    }
    
    // Nettoyer le contenu (retirer ponctuation)
    const cleanContent = content.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
    
    // Diviser en mots et filtrer les stopwords et mots courts
    const words = cleanContent.split(/\s+/)
        .filter(word => word.length > 3 && !stopwords.has(word));
    
    // Compter les occurrences
    const wordCounts = {};
    words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Trier par fréquence et prendre les 5 mots les plus fréquents
    const frequentWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
    
    // Combiner les tags techniques et les mots fréquents
    const allTags = [...new Set([...technicalTags, ...frequentWords])];
    
    // Ajouter ces tags à l'ensemble des tags générés
    allTags.forEach(tag => currentState.generatedTags.add(tag));
    
    // Limiter à 5 tags maximum
    return allTags.slice(0, 5);
}

// Fonction pour initialiser le comportement de la barre latérale fixe
function initSidebarBehavior() {
    const sidebar = document.querySelector('.fixed-sidebar');
    const tagFilters = document.getElementById('tagFilters');
    
    if (!sidebar || !tagFilters) return;
    
    // Gérer l'état de survol pour le défilement
    sidebar.addEventListener('mouseenter', () => {
        sidebar.classList.add('hover');
    });
    
    sidebar.addEventListener('mouseleave', () => {
        sidebar.classList.remove('hover');
    });
    
    // Ajuster la taille de la barre latérale au redimensionnement de la fenêtre
    window.addEventListener('resize', adjustSidebarSize);
    
    // Exécuter immédiatement pour initialiser
    adjustSidebarSize();
    
    // Masquer la barre latérale pendant le défilement sur mobile
    let lastScrollY = window.scrollY;
    let scrollTimer;
    
    window.addEventListener('scroll', () => {
        if (window.innerWidth < 768) {
            // Sur mobile, masquer pendant le défilement
            const currentScrollY = window.scrollY;
            
            // Détecter la direction du défilement
            if (currentScrollY > lastScrollY) {
                // Défilement vers le bas, masquer
                sidebar.classList.add('scroll-hidden');
            } else {
                // Défilement vers le haut, afficher
                sidebar.classList.remove('scroll-hidden');
            }
            
            lastScrollY = currentScrollY;
            
            // Réafficher après le défilement
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                sidebar.classList.remove('scroll-hidden');
            }, 500);
        }
    });
}

// Ajuster la taille de la barre latérale en fonction de la fenêtre
function adjustSidebarSize() {
    const sidebar = document.querySelector('.fixed-sidebar');
    const tagFilters = document.getElementById('tagFilters');
    
    if (!sidebar || !tagFilters) return;
    
    if (window.innerWidth >= 768) {
        // Sur desktop
        const navbarHeight = document.querySelector('.navbar').offsetHeight;
        const windowHeight = window.innerHeight;
        sidebar.style.top = navbarHeight + 'px';
        sidebar.style.height = (windowHeight - navbarHeight - 20) + 'px';
        
        // Ajuster la hauteur de la zone des tags
        const sidebarFilters = sidebar.querySelector('.filter-section');
        const tagsLabel = tagFilters.previousElementSibling;
        const availableHeight = sidebar.offsetHeight - 
                               sidebarFilters.offsetHeight - 
                               tagsLabel.offsetHeight - 
                               sidebar.firstElementChild.offsetHeight - 
                               60; // padding et marges
        
        tagFilters.style.maxHeight = availableHeight + 'px';
    } else {
        // Sur mobile, réinitialiser
        sidebar.style.height = 'auto';
        tagFilters.style.maxHeight = '200px';
    }
}

// Rendu de la pagination
function renderPagination(data) {
    elements.pagination.innerHTML = '';
    
    const page = data.page;
    const pageSize = data.page_size;
    const total = data.total;
    const total_pages = Math.ceil(total / pageSize);
    
    // Ne pas afficher la pagination s'il n'y a qu'une seule page
    if (total_pages <= 1) {
        return;
    }
    
    // Bouton précédent
    const prevLi = document.createElement('li');
    prevLi.classList.add('page-item');
    if (page === 1) {
        prevLi.classList.add('disabled');
    }
    
    const prevLink = document.createElement('a');
    prevLink.classList.add('page-link');
    prevLink.href = '#';
    prevLink.dataset.page = page - 1;
    prevLink.innerHTML = '&laquo;';
    prevLink.setAttribute('aria-label', 'Précédent');
    
    prevLi.appendChild(prevLink);
    elements.pagination.appendChild(prevLi);
    
    // Déterminer les numéros de page à afficher
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(total_pages, page + 2);
    
    // Ajuster si on est près du début ou de la fin
    if (page <= 3) {
        endPage = Math.min(5, total_pages);
    } else if (page >= total_pages - 2) {
        startPage = Math.max(1, total_pages - 4);
    }
    
    // Numéros de page
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.classList.add('page-item');
        if (i === page) {
            pageLi.classList.add('active');
        }
        
        const pageLink = document.createElement('a');
        pageLink.classList.add('page-link');
        pageLink.href = '#';
        pageLink.dataset.page = i;
        pageLink.textContent = i;
        
        pageLi.appendChild(pageLink);
        elements.pagination.appendChild(pageLi);
    }
    
    // Bouton suivant
    const nextLi = document.createElement('li');
    nextLi.classList.add('page-item');
    if (page === total_pages) {
        nextLi.classList.add('disabled');
    }
    
    const nextLink = document.createElement('a');
    nextLink.classList.add('page-link');
    nextLink.href = '#';
    nextLink.dataset.page = page + 1;
    nextLink.innerHTML = '&raquo;';
    nextLink.setAttribute('aria-label', 'Suivant');
    
    nextLi.appendChild(nextLink);
    elements.pagination.appendChild(nextLi);
} 