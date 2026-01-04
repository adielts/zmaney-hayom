/**
 * Settings Manager - Zmaney HaYom
 * Handles user preferences for filtering zmanim display
 */

const STORAGE_KEY = 'zmaneyHayom_settings';

// Default settings - all zmanim visible
const DEFAULT_SETTINGS = {
    visibleZmanim: {
        dawn: true,
        sunrise: true,
        sofZmanShmaMGA: true,
        sofZmanShmaGRA: true,
        sofZmanTfillaMGA: true,
        sofZmanTfillaGRA: true,
        chatzot: true,
        minchaGedola: true,
        minchaKetana: true,
        plagHaMincha: true,
        candleLighting: true,
        sunset: true,
        tzeit: true,
        havdalah: true
    }
};

// Zmanim metadata for settings panel
const ZMANIM_METADATA = [
    { key: 'dawn', hebrew: 'עלות השחר', english: 'Dawn', icon: '🌅' },
    { key: 'sunrise', hebrew: 'הנץ החמה', english: 'Sunrise', icon: '☀️' },
    { key: 'sofZmanShmaMGA', hebrew: 'סוף זמן ק"ש מג"א', english: 'Latest Shema (MGA)', icon: '📖' },
    { key: 'sofZmanShmaGRA', hebrew: 'סוף זמן ק"ש גר"א', english: 'Latest Shema (GRA)', icon: '📖' },
    { key: 'sofZmanTfillaMGA', hebrew: 'סוף זמן תפילה מג"א', english: 'Latest Tefilla (MGA)', icon: '🙏' },
    { key: 'sofZmanTfillaGRA', hebrew: 'סוף זמן תפילה גר"א', english: 'Latest Tefilla (GRA)', icon: '🙏' },
    { key: 'chatzot', hebrew: 'חצות היום', english: 'Midday', icon: '🕛' },
    { key: 'minchaGedola', hebrew: 'מנחה גדולה', english: 'Earliest Mincha', icon: '🕐' },
    { key: 'minchaKetana', hebrew: 'מנחה קטנה', english: 'Mincha Ketana', icon: '🕓' },
    { key: 'plagHaMincha', hebrew: 'פלג המנחה', english: 'Plag HaMincha', icon: '🌤️' },
    { key: 'candleLighting', hebrew: 'הדלקת נרות', english: 'Candle Lighting', icon: '🕯️' },
    { key: 'sunset', hebrew: 'שקיעת החמה', english: 'Sunset', icon: '🌅' },
    { key: 'tzeit', hebrew: 'צאת הכוכבים', english: 'Nightfall', icon: '🌙' },
    { key: 'havdalah', hebrew: 'צאת השבת', english: 'Havdalah', icon: '🍷' }
];

/**
 * Load settings from localStorage
 */
export function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to handle new zmanim
            return {
                ...DEFAULT_SETTINGS,
                visibleZmanim: {
                    ...DEFAULT_SETTINGS.visibleZmanim,
                    ...parsed.visibleZmanim
                }
            };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

/**
 * Check if a zman is visible
 */
export function isZmanVisible(key) {
    const settings = loadSettings();
    return settings.visibleZmanim[key] !== false;
}

/**
 * Toggle a zman's visibility
 */
export function toggleZman(key) {
    const settings = loadSettings();
    settings.visibleZmanim[key] = !settings.visibleZmanim[key];
    saveSettings(settings);
    return settings.visibleZmanim[key];
}

/**
 * Set all zmanim visibility
 */
export function setAllZmanim(visible) {
    const settings = loadSettings();
    Object.keys(settings.visibleZmanim).forEach(key => {
        settings.visibleZmanim[key] = visible;
    });
    saveSettings(settings);
    return settings;
}

/**
 * Get zmanim metadata for settings panel
 */
export function getZmanimMetadata() {
    return ZMANIM_METADATA;
}

/**
 * Apply filters to zmanim cards
 */
export function applyFilters() {
    const settings = loadSettings();
    const cards = document.querySelectorAll('.time-card[data-key]');
    
    cards.forEach(card => {
        const key = card.dataset.key;
        if (settings.visibleZmanim[key] === false) {
            card.classList.add('filtered-out');
        } else {
            card.classList.remove('filtered-out');
        }
    });

    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('zmanimFiltered', { detail: settings }));
}

/**
 * Render toggle switches in settings panel
 */
function renderToggles() {
    const zmanimToggles = document.getElementById('zmanim-toggles');
    if (!zmanimToggles) return;
    
    const settings = loadSettings();
    zmanimToggles.innerHTML = ZMANIM_METADATA.map(zman => `
        <div class="settings-item" data-key="${zman.key}">
            <div class="settings-item-info">
                <span class="settings-item-icon">${zman.icon}</span>
                <div class="settings-item-text">
                    <span class="settings-item-name">${zman.hebrew}</span>
                    <span class="settings-item-english">${zman.english}</span>
                </div>
            </div>
            <div class="toggle-switch ${settings.visibleZmanim[zman.key] ? 'active' : ''}" 
                 data-key="${zman.key}" 
                 role="switch" 
                 aria-checked="${settings.visibleZmanim[zman.key]}"
                 tabindex="0">
            </div>
        </div>
    `).join('');

    // Add click handlers
    zmanimToggles.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const key = toggle.dataset.key;
            const isVisible = toggleZman(key);
            toggle.classList.toggle('active', isVisible);
            toggle.setAttribute('aria-checked', isVisible);
            applyFilters();
        });

        // Keyboard support
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle.click();
            }
        });
    });
}

/**
 * Initialize settings panel UI
 */
export function initSettingsPanel() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsClose = document.getElementById('settings-close');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');

    if (!settingsBtn || !settingsModal) {
        console.warn('Settings panel elements not found');
        return;
    }

    // Generate toggle switches
    renderToggles();

    // Open settings
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        settingsOverlay.classList.add('active');
    });

    // Close settings
    const closeSettings = () => {
        settingsModal.classList.remove('active');
        settingsOverlay.classList.remove('active');
    };

    settingsClose.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', closeSettings);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('active')) {
            closeSettings();
        }
    });

    // Select/Deselect all
    selectAllBtn.addEventListener('click', () => {
        setAllZmanim(true);
        renderToggles();
        applyFilters();
    });

    deselectAllBtn.addEventListener('click', () => {
        setAllZmanim(false);
        renderToggles();
        applyFilters();
    });
}
