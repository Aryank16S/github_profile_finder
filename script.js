// DOM Elements
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const clearInputBtn = document.getElementById('clear-input-btn');
const profileContainer = document.getElementById('profile-container');
const reposContainer = document.getElementById('repos-container');
const recentSearchesSection = document.getElementById('recent-searches');
const recentChips = document.getElementById('recent-chips');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Favorites Elements
const favoritesToggleBtn = document.getElementById('favorites-toggle-btn');
const favoritesBadgeCount = document.getElementById('favorites-badge-count');
const favoritesDrawer = document.getElementById('favorites-drawer');
const closeDrawerBtn = document.getElementById('close-drawer-btn');
const favoritesList = document.getElementById('favorites-list');

// Theme Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');

// Constants
const API_URL = 'https://api.github.com/users/';
const STORAGE_KEYS = {
    RECENT: 'gh_recent_searches',
    FAVORITES: 'gh_favorites',
    THEME: 'gh_theme'
};

const LANGUAGE_COLORS = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'Python': '#3572A5',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'C': '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    'Java': '#b07219',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'Swift': '#F05138',
    'Kotlin': '#A97BFF',
    'Dart': '#00B4AB',
    'Shell': '#89e051',
    'Vue': '#41b883',
    'React': '#61dafb',
    'Jupyter Notebook': '#DA5B0B',
    'Scala': '#c22d40',
    'R': '#198CE7',
    'Lua': '#000080',
    'Zig': '#ec915c',
    'Elixir': '#6e4a7e'
};

// State
let activeAbortController = null;
let currentUser = null;
let currentRepos = [];
let visibleReposCount = 8;
const INITIAL_REPOS_COUNT = 8;

/* ==========================================================================
   Utility Helpers & Safe Storage
   ========================================================================== */

function safeGetStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn('Storage read failed:', e);
        return null;
    }
}

function safeSetStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('Storage write failed:', e);
    }
}

function safeRemoveStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn('Storage remove failed:', e);
    }
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debounce(fn, delay = 500) {
    let timer = null;
    const debounced = function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ==========================================================================
   Theme Management (Dark / Light)
   ========================================================================== */

function initTheme() {
    const savedTheme = safeGetStorage(STORAGE_KEYS.THEME);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        applyTheme(prefersLight ? 'light' : 'dark');
    }
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.textContent = '☀️';
        safeSetStorage(STORAGE_KEYS.THEME, 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
        safeSetStorage(STORAGE_KEYS.THEME, 'dark');
    }
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
});

/* ==========================================================================
   Recent Searches History
   ========================================================================== */

function getRecentSearches() {
    const data = safeGetStorage(STORAGE_KEYS.RECENT);
    try {
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveRecentSearch(username) {
    if (!username) return;
    const history = getRecentSearches().filter(u => u.toLowerCase() !== username.toLowerCase());
    history.unshift(username);
    if (history.length > 8) history.length = 8;
    safeSetStorage(STORAGE_KEYS.RECENT, JSON.stringify(history));
    renderRecentSearches();
}

function removeRecentSearch(username) {
    const history = getRecentSearches().filter(u => u.toLowerCase() !== username.toLowerCase());
    safeSetStorage(STORAGE_KEYS.RECENT, JSON.stringify(history));
    renderRecentSearches();
}

function clearRecentSearches() {
    safeRemoveStorage(STORAGE_KEYS.RECENT);
    renderRecentSearches();
}

function renderRecentSearches() {
    const history = getRecentSearches();
    if (history.length === 0) {
        recentSearchesSection.classList.add('hidden');
        recentChips.innerHTML = '';
        return;
    }

    recentSearchesSection.classList.remove('hidden');
    recentChips.innerHTML = history.map(username => `
        <div class="recent-chip" data-user="${escapeHTML(username)}">
            <span class="chip-text">${escapeHTML(username)}</span>
            <span class="chip-remove" data-remove="${escapeHTML(username)}" title="Remove">✕</span>
        </div>
    `).join('');
}

recentChips.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
        e.stopPropagation();
        const userToRemove = removeBtn.getAttribute('data-remove');
        removeRecentSearch(userToRemove);
        return;
    }

    const chip = e.target.closest('[data-user]');
    if (chip) {
        const username = chip.getAttribute('data-user');
        searchInput.value = username;
        toggleClearBtn();
        debouncedSearch.cancel();
        getProfile(username);
    }
});

clearHistoryBtn.addEventListener('click', clearRecentSearches);

/* ==========================================================================
   Favorites Management (localStorage)
   ========================================================================== */

function getFavorites() {
    const data = safeGetStorage(STORAGE_KEYS.FAVORITES);
    try {
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function isFavorite(login) {
    if (!login) return false;
    const favorites = getFavorites();
    return favorites.some(fav => fav.login.toLowerCase() === login.toLowerCase());
}

function toggleFavoriteProfile(user) {
    if (!user || !user.login) return;
    let favorites = getFavorites();
    const index = favorites.findIndex(fav => fav.login.toLowerCase() === user.login.toLowerCase());

    if (index >= 0) {
        favorites.splice(index, 1);
    } else {
        favorites.unshift({
            login: user.login,
            name: user.name || user.login,
            avatar_url: user.avatar_url,
            html_url: user.html_url,
            bio: user.bio || ''
        });
    }

    safeSetStorage(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    updateFavoritesBadge();
    renderFavoritesList();
    updateFavoriteButtonState();
}

function updateFavoritesBadge() {
    const favorites = getFavorites();
    favoritesBadgeCount.textContent = favorites.length;
}

function updateFavoriteButtonState() {
    const favBtn = document.getElementById('profile-fav-btn');
    if (!favBtn || !currentUser) return;

    const fav = isFavorite(currentUser.login);
    if (fav) {
        favBtn.classList.add('active');
        favBtn.innerHTML = '★ Saved';
        favBtn.title = 'Remove from favorite profiles';
    } else {
        favBtn.classList.remove('active');
        favBtn.innerHTML = '☆ Favorite';
        favBtn.title = 'Save to favorite profiles';
    }
}

function renderFavoritesList() {
    const favorites = getFavorites();
    if (favorites.length === 0) {
        favoritesList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⭐</span>
                <p>No favorite profiles saved yet.</p>
                <p style="font-size: 12px; margin-top: 4px; color: var(--text-faint);">
                    Search any developer and click "☆ Favorite" on their card to save them for quick access.
                </p>
            </div>
        `;
        return;
    }

    favoritesList.innerHTML = favorites.map(fav => `
        <div class="favorite-item">
            <img class="fav-avatar" src="${fav.avatar_url}" alt="${escapeHTML(fav.login)}" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'">
            <div class="fav-info" data-load-fav="${escapeHTML(fav.login)}">
                <strong>${escapeHTML(fav.name)}</strong>
                <span class="fav-handle">@${escapeHTML(fav.login)}</span>
            </div>
            <div class="fav-actions">
                <button class="fav-view-btn" data-load-fav="${escapeHTML(fav.login)}">View</button>
                <button class="fav-del-btn" data-delete-fav="${escapeHTML(fav.login)}" title="Remove favorite">✕</button>
            </div>
        </div>
    `).join('');
}

favoritesList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-delete-fav]');
    if (deleteBtn) {
        const username = deleteBtn.getAttribute('data-delete-fav');
        const favorites = getFavorites().filter(f => f.login.toLowerCase() !== username.toLowerCase());
        safeSetStorage(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
        updateFavoritesBadge();
        renderFavoritesList();
        updateFavoriteButtonState();
        return;
    }

    const loadTarget = e.target.closest('[data-load-fav]');
    if (loadTarget) {
        const username = loadTarget.getAttribute('data-load-fav');
        searchInput.value = username;
        toggleClearBtn();
        closeDrawer();
        debouncedSearch.cancel();
        getProfile(username);
    }
});

function openDrawer() {
    favoritesDrawer.classList.remove('hidden');
    favoritesDrawer.setAttribute('aria-hidden', 'false');
    renderFavoritesList();
}

function closeDrawer() {
    favoritesDrawer.classList.add('hidden');
    favoritesDrawer.setAttribute('aria-hidden', 'true');
}

favoritesToggleBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
favoritesDrawer.addEventListener('click', (e) => {
    if (e.target === favoritesDrawer) closeDrawer();
});

/* ==========================================================================
   Data Fetching with AbortController
   ========================================================================== */

async function getProfile(username) {
    username = (username || '').trim();
    if (!username) {
        showFeedback('Please enter a GitHub username to search.', true);
        return;
    }

    // Cancel pending in-flight request if any
    if (activeAbortController) {
        activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    setLoading(true);
    reposContainer.classList.add('hidden');

    try {
        const response = await fetch(API_URL + encodeURIComponent(username), { signal });

        if (!response.ok) {
            if (response.status === 404) {
                showFeedback('User not found. Please double-check the username.', true);
            } else if (response.status === 403) {
                showFeedback('GitHub API rate limit exceeded. Please wait a short while or try again later.', true);
            } else {
                showFeedback(`Unable to fetch user data (HTTP Status ${response.status}).`, true);
            }
            currentUser = null;
            currentRepos = [];
            return;
        }

        const user = await response.json();
        currentUser = user;
        saveRecentSearch(user.login);
        renderProfileCard(user);

        // Fetch repositories concurrently with the same signal
        fetchUserRepositories(user.login, signal);
    } catch (err) {
        if (err.name === 'AbortError') {
            // New request has cancelled this one; ignore silently
            return;
        }
        console.error('Fetch profile error:', err);
        showFeedback('Network connection error. Check your internet connection.', true);
        currentUser = null;
        currentRepos = [];
    } finally {
        setLoading(false);
    }
}

async function fetchUserRepositories(username, signal) {
    reposContainer.classList.remove('hidden');
    reposContainer.innerHTML = `
        <div class="repos-header">
            <div class="repos-title-group">
                <h3>Public Repositories</h3>
            </div>
        </div>
        <div class="status-card">
            <div class="spinner"></div>
            <p>Fetching repositories...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { signal });
        if (!response.ok) {
            renderReposSection([]);
            return;
        }
        const repos = await response.json();
        currentRepos = Array.isArray(repos) ? repos : [];
        visibleReposCount = INITIAL_REPOS_COUNT;
        renderReposSection(currentRepos);
    } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Fetch repos error:', err);
        renderReposSection([]);
    }
}

function setLoading(isLoading) {
    searchBtn.disabled = isLoading;
    if (isLoading) {
        profileContainer.innerHTML = `
            <div class="status-card">
                <div class="spinner"></div>
                <p>Fetching profile details...</p>
            </div>
        `;
    }
}

function showFeedback(message, isError = false) {
    profileContainer.innerHTML = `
        <div class="status-card ${isError ? 'error' : ''}">
            ${escapeHTML(message)}
        </div>
    `;
    reposContainer.classList.add('hidden');
}

/* ==========================================================================
   Profile Card Rendering
   ========================================================================== */

function renderProfileCard(user) {
    const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        })
        : 'Unknown';

    const safeName = escapeHTML(user.name || user.login);
    const safeLogin = escapeHTML(user.login);
    const safeBio = user.bio ? escapeHTML(user.bio) : 'This profile does not have a public biography yet.';
    const safeLocation = user.location ? escapeHTML(user.location) : 'Location unavailable';
    const reposCount = (user.public_repos ?? 0).toLocaleString();
    const followersCount = (user.followers ?? 0).toLocaleString();
    const followingCount = (user.following ?? 0).toLocaleString();

    let metaDetailsHTML = `
        <div class="meta-row">
            <span class="meta-icon">📍</span>
            <span>${safeLocation}</span>
        </div>
        <div class="meta-row">
            <span class="meta-icon">🗓️</span>
            <span>Member since ${joinedDate}</span>
        </div>
    `;

    if (user.company) {
        metaDetailsHTML += `
            <div class="meta-row">
                <span class="meta-icon">🏢</span>
                <span>${escapeHTML(user.company)}</span>
            </div>
        `;
    }

    if (user.blog) {
        const blogUrl = user.blog.startsWith('http://') || user.blog.startsWith('https://')
            ? user.blog
            : `https://${user.blog}`;
        metaDetailsHTML += `
            <div class="meta-row">
                <span class="meta-icon">🔗</span>
                <a href="${escapeHTML(blogUrl)}" target="_blank" rel="noopener noreferrer" class="meta-link">${escapeHTML(user.blog)}</a>
            </div>
        `;
    }

    const isFav = isFavorite(user.login);

    const cardHTML = `
        <article class="profile-card">
            <div class="profile-top">
                <img class="profile-avatar" src="${user.avatar_url}" alt="${safeName}" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'">
                <div class="profile-names">
                    <div class="profile-title-row">
                        <div>
                            <h2>${safeName}</h2>
                            <a class="handle" href="${user.html_url}" target="_blank" rel="noopener noreferrer">@${safeLogin}</a>
                        </div>
                        <button id="profile-fav-btn" class="btn-fav ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}">
                            ${isFav ? '★ Saved' : '☆ Favorite'}
                        </button>
                    </div>
                </div>
            </div>

            <p class="profile-bio">${safeBio}</p>

            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Repos</span>
                    <span class="stat-value">${reposCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Followers</span>
                    <span class="stat-value">${followersCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Following</span>
                    <span class="stat-value">${followingCount}</span>
                </div>
            </div>

            <div class="meta-details">
                ${metaDetailsHTML}
            </div>

            <a href="${user.html_url}" target="_blank" rel="noopener noreferrer" class="btn-profile">
                Visit GitHub Profile ↗
            </a>
        </article>
    `;

    profileContainer.innerHTML = cardHTML;

    // Attach favorite toggle event
    const favBtn = document.getElementById('profile-fav-btn');
    if (favBtn) {
        favBtn.addEventListener('click', () => {
            toggleFavoriteProfile(currentUser);
        });
    }
}

/* ==========================================================================
   Repositories Rendering, Filtering & Sorting
   ========================================================================== */

function getProcessedRepos() {
    const filterInput = document.getElementById('repo-filter-input');
    const sortSelect = document.getElementById('repo-sort-select');

    const filterTerm = filterInput ? filterInput.value.trim().toLowerCase() : '';
    const sortBy = sortSelect ? sortSelect.value : 'stars';

    let repos = [...currentRepos];

    // Filter by name or description
    if (filterTerm) {
        repos = repos.filter(repo => {
            const name = (repo.name || '').toLowerCase();
            const desc = (repo.description || '').toLowerCase();
            return name.includes(filterTerm) || desc.includes(filterTerm);
        });
    }

    // Sort repositories
    repos.sort((a, b) => {
        if (sortBy === 'stars') {
            return (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0);
        } else if (sortBy === 'updated') {
            return new Date(b.updated_at) - new Date(a.updated_at);
        } else if (sortBy === 'forks') {
            return (b.forks_count ?? 0) - (a.forks_count ?? 0);
        } else if (sortBy === 'name') {
            return (a.name || '').localeCompare(b.name || '');
        }
        return 0;
    });

    return repos;
}

function renderReposSection(repos) {
    if (!repos || repos.length === 0) {
        reposContainer.innerHTML = `
            <div class="repos-header">
                <div class="repos-title-group">
                    <h3>Public Repositories</h3>
                    <span class="repos-count-badge">0</span>
                </div>
            </div>
            <div class="status-card">
                <p>This user does not have any public repositories yet.</p>
            </div>
        `;
        reposContainer.classList.remove('hidden');
        return;
    }

    reposContainer.innerHTML = `
        <div class="repos-header">
            <div class="repos-title-group">
                <h3>Public Repositories</h3>
                <span id="repo-count-badge" class="repos-count-badge">${repos.length}</span>
            </div>
            <div class="repos-controls">
                <div class="repo-filter-wrapper">
                    <input type="text" id="repo-filter-input" placeholder="Filter repositories..." class="repo-filter-input" autocomplete="off">
                </div>
                <div class="sort-select-wrapper">
                    <label for="repo-sort-select">Sort:</label>
                    <select id="repo-sort-select" class="repo-sort-select">
                        <option value="stars">⭐ Most Stars</option>
                        <option value="updated" selected>🕒 Recently Updated</option>
                        <option value="forks">🍴 Most Forks</option>
                        <option value="name">🔤 Name (A-Z)</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="repos-grid" class="repos-grid"></div>
        <div id="repos-load-more" class="load-more-container hidden"></div>
    `;

    reposContainer.classList.remove('hidden');

    const filterInput = document.getElementById('repo-filter-input');
    const sortSelect = document.getElementById('repo-sort-select');

    filterInput.addEventListener('input', () => {
        visibleReposCount = INITIAL_REPOS_COUNT;
        renderRepoCards();
    });

    sortSelect.addEventListener('change', () => {
        visibleReposCount = INITIAL_REPOS_COUNT;
        renderRepoCards();
    });

    renderRepoCards();
}

function renderRepoCards() {
    const grid = document.getElementById('repos-grid');
    const countBadge = document.getElementById('repo-count-badge');
    const loadMoreBox = document.getElementById('repos-load-more');
    if (!grid) return;

    const processed = getProcessedRepos();
    if (countBadge) countBadge.textContent = processed.length;

    if (processed.length === 0) {
        grid.innerHTML = `
            <div class="status-card" style="grid-column: 1 / -1;">
                <p>No repositories match your filter criteria.</p>
            </div>
        `;
        if (loadMoreBox) loadMoreBox.classList.add('hidden');
        return;
    }

    const visibleList = processed.slice(0, visibleReposCount);

    grid.innerHTML = visibleList.map(repo => {
        const langColor = LANGUAGE_COLORS[repo.language] || '#8b949e';
        const safeName = escapeHTML(repo.name);
        const safeDesc = repo.description ? escapeHTML(repo.description) : 'No description provided.';
        const stars = (repo.stargazers_count ?? 0).toLocaleString();
        const forks = (repo.forks_count ?? 0).toLocaleString();
        const updatedTime = formatRelativeTime(repo.updated_at);

        return `
            <div class="repo-card">
                <div class="repo-card-top">
                    <div class="repo-name-row">
                        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="repo-name" title="${safeName}">
                            <span>📦</span>
                            <span>${safeName}</span>
                        </a>
                        <span class="repo-visibility">${repo.fork ? 'Fork' : 'Public'}</span>
                    </div>
                    <p class="repo-desc" title="${safeDesc}">${safeDesc}</p>
                </div>
                <div class="repo-meta">
                    ${repo.language ? `
                        <span class="repo-lang">
                            <span class="lang-color" style="background-color: ${langColor};"></span>
                            ${escapeHTML(repo.language)}
                        </span>
                    ` : ''}
                    <span class="repo-stat" title="${stars} stars">⭐ ${stars}</span>
                    <span class="repo-stat" title="${forks} forks">🍴 ${forks}</span>
                    <span class="repo-updated">Updated ${updatedTime}</span>
                </div>
            </div>
        `;
    }).join('');

    // Load more button if remaining repos exist
    if (loadMoreBox) {
        if (processed.length > visibleReposCount) {
            loadMoreBox.classList.remove('hidden');
            loadMoreBox.innerHTML = `
                <button id="load-more-repos-btn" class="load-more-btn">
                    Show More (${processed.length - visibleReposCount} remaining)
                </button>
            `;
            document.getElementById('load-more-repos-btn').addEventListener('click', () => {
                visibleReposCount += INITIAL_REPOS_COUNT;
                renderRepoCards();
            });
        } else {
            loadMoreBox.classList.add('hidden');
            loadMoreBox.innerHTML = '';
        }
    }
}

/* ==========================================================================
   Search Event Handlers & Debounce
   ========================================================================== */

function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showFeedback('Please enter a username to search.', true);
        searchInput.focus();
        return;
    }
    getProfile(query);
}

function toggleClearBtn() {
    if (searchInput.value.length > 0) {
        clearInputBtn.classList.remove('hidden');
    } else {
        clearInputBtn.classList.add('hidden');
    }
}

const debouncedSearch = debounce(() => {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
        getProfile(query);
    }
}, 500);

searchBtn.addEventListener('click', () => {
    debouncedSearch.cancel();
    handleSearch();
});

searchInput.addEventListener('input', () => {
    toggleClearBtn();
    const query = searchInput.value.trim();
    if (query.length >= 2) {
        debouncedSearch();
    }
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        debouncedSearch.cancel();
        handleSearch();
    }
});

clearInputBtn.addEventListener('click', () => {
    searchInput.value = '';
    toggleClearBtn();
    debouncedSearch.cancel();
    searchInput.focus();
});

/* ==========================================================================
   Initialization
   ========================================================================== */

function init() {
    initTheme();
    renderRecentSearches();
    updateFavoritesBadge();

    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    if (userParam) {
        searchInput.value = userParam;
        toggleClearBtn();
        getProfile(userParam);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
