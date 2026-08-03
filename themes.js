// themes.js — Dynamic theme manager for Star Rewards
// Supported themes: classic, juanwa, juanziji

const THEME_CONFIG = {
    classic: { css: 'style.css', label: 'Classic' },
    juanwa: { css: 'style_juanwa.css', label: 'Juanwa' },
    juanziji: { css: 'style_juanziji.css', label: 'Juanziji' }
};

const DEFAULT_THEME = 'classic';
let currentTheme = DEFAULT_THEME;
let themeLinkEl = null;

// Initialize theme on page load
async function initTheme() {
    const saved = localStorage.getItem('selectedTheme');
    const urlTheme = new URLSearchParams(window.location.search).get('theme');

    // Priority: URL param > API > localStorage > default
    if (urlTheme && THEME_CONFIG[urlTheme]) {
        await applyTheme(urlTheme, /* saveToAPI */ false);
        return;
    }

    // Try to fetch from API if logged in
    try {
        const config = await loadConfigFromAPI();
        if (config && config.selected_theme && THEME_CONFIG[config.selected_theme]) {
            await applyTheme(config.selected_theme, /* saveToAPI */ false);
            return;
        }
    } catch (e) {
        // API not available, fall through to localStorage
    }

    if (saved && THEME_CONFIG[saved]) {
        await applyTheme(saved, /* saveToAPI */ false);
    } else {
        await applyTheme(DEFAULT_THEME, /* saveToAPI */ false);
    }
}

// Load user config from API
async function loadConfigFromAPI() {
    if (typeof api === 'undefined' || !api.getToken) return null;
    const token = api.getToken();
    if (!token) return null;

    try {
        const config = await api.getUserConfig();
        return config;
    } catch (e) {
        return null;
    }
}

// Apply a theme by loading its CSS file
async function applyTheme(themeName, saveToAPI = true) {
    if (!THEME_CONFIG[themeName]) {
        console.warn('Unknown theme:', themeName, 'falling back to', DEFAULT_THEME);
        themeName = DEFAULT_THEME;
    }

    const config = THEME_CONFIG[themeName];

    // Remove previous theme CSS link
    if (themeLinkEl) {
        themeLinkEl.remove();
        themeLinkEl = null;
    }

    // Default theme already loaded via style.css in HTML head, no extra CSS needed
    if (themeName !== DEFAULT_THEME) {
        themeLinkEl = document.createElement('link');
        themeLinkEl.rel = 'stylesheet';
        themeLinkEl.href = config.css + '?v=2';
        themeLinkEl.id = 'theme-stylesheet';
        document.head.appendChild(themeLinkEl);
    }

    // Set data-theme attribute on html for CSS variable scoping
    document.documentElement.setAttribute('data-theme', themeName);

    // Update body class for theme-specific overrides
    document.body.className = document.body.className
        .replace(/theme-\w+/g, '')
        .trim() + ' theme-' + themeName;

    currentTheme = themeName;
    localStorage.setItem('selectedTheme', themeName);

    // Persist to API
    if (saveToAPI && typeof api !== 'undefined' && api.getToken()) {
        try {
            await api.updateTheme(themeName);
            console.log('Theme saved to server:', themeName);
        } catch (e) {
            console.warn('Could not save theme to server:', e.message);
        }
    }

    console.log('Theme applied:', config.label, '(', themeName, ')');
    return themeName;
}

// Switch to a different theme
async function switchTheme(themeName) {
    return await applyTheme(themeName, /* saveToAPI */ true);
}

// Get current theme name
function getCurrentTheme() {
    return currentTheme;
}

// Set theme from theme-selector (saves to API then redirects)
async function selectAndGoToTheme(themeName) {
    if (!THEME_CONFIG[themeName]) return;

    // Save to API
    if (typeof api !== 'undefined' && api.getToken()) {
        try {
            await api.updateTheme(themeName);
        } catch (e) {
            // Non-critical
        }
    }

    localStorage.setItem('selectedTheme', themeName);
    window.location.href = 'index.html?theme=' + themeName;
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
