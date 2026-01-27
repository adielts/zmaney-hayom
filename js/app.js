/**
 * Main Application - Zmaney HaYom
 * Coordinates all modules and handles UI
 */

import { fetchZmanim, getZmanimList } from './api.js';
import { getLocationData, getLocationDataWithFallback, clearLocationCache } from './location.js';
import { initSettingsPanel, applyFilters, isZmanVisible } from './settings.js';
import { 
    searchLocations, 
    getTimezoneFromCoords,
    getFavorites,
    getRecent,
    saveFavorite,
    removeFavorite,
    saveRecent,
    saveCurrentLocation,
    getCurrentSavedLocation,
    getLocationMode,
    setLocationMode
} from './geocoding.js';

// ============================================
// DATE SELECTION
// ============================================
// Selected date - null means today
let selectedDate = null;

// Helper to get current date (respects selected date)
function getCurrentDate() {
    return selectedDate || new Date();
}
// ============================================

// DOM Elements
const elements = {
    locationName: document.getElementById('location-name'),
    refreshBtn: document.getElementById('refresh-btn'),
    hebrewDate: document.getElementById('hebrew-date'),
    gregorianDate: document.getElementById('gregorian-date'),
    datePickerBtn: document.getElementById('date-picker-btn'),
    dateInput: document.getElementById('date-input'),
    todayBtn: document.getElementById('today-btn'),
    dateSection: document.querySelector('.date-section'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    zmanimContainer: document.getElementById('zmanim-container'),
    nextZman: document.getElementById('next-zman'),
    nextZmanName: document.getElementById('next-zman-name'),
    nextZmanCountdown: document.getElementById('next-zman-countdown'),
    nextZmanTime: document.getElementById('next-zman-time'),
    
    // Location Modal elements
    locationModal: document.getElementById('location-modal'),
    locationOverlay: document.getElementById('location-overlay'),
    locationClose: document.getElementById('location-close'),
    locationSearchInput: document.getElementById('location-search-input'),
    searchClear: document.getElementById('search-clear'),
    searchResults: document.getElementById('search-results'),
    useCurrentLocation: document.getElementById('use-current-location'),
    favoritesList: document.getElementById('favorites-list'),
    recentList: document.getElementById('recent-list')
};

// App State
let currentZmanim = null;
let countdownInterval = null;

/**
 * Initialize the application
 */
async function init() {
    console.log('🕐 Zmaney HaYom - Initializing...');
    
    // Set up event listeners
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.retryBtn.addEventListener('click', handleRetry);
    
    // Initialize date picker
    initDatePicker();
    
    // Initialize settings panel
    initSettingsPanel();
    
    // Initialize location picker
    initLocationPicker();
    
    // Listen for filter changes
    window.addEventListener('zmanimFiltered', () => {
        updateNextZman();
    });
    
    // Display current date
    displayDates();
    
    // Load zmanim - USE cache on initial load to avoid repeated permission requests
    // Fresh location only requested when user explicitly clicks refresh
    await loadZmanim(true);
    
    // Update countdown every second
    startCountdown();
    
    // Refresh zmanim every hour (use cache for location)
    setInterval(() => loadZmanim(true), 60 * 60 * 1000);
}

/**
 * Convert number to Hebrew letters (Gematria)
 */
function toHebrewNumber(num) {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
    const thousands = ['', 'א', 'ב', 'ג', 'ד', 'ה'];
    
    if (num >= 1000) {
        const thousandsPart = Math.floor(num / 1000);
        const remainder = num % 1000;
        return thousands[thousandsPart] + '\u05F3' + toHebrewNumber(remainder);
    }
    
    let result = '';
    
    // Hundreds - handle values above 400 with combinations
    if (num >= 100) {
        let hundredsValue = Math.floor(num / 100);
        
        // For hundreds > 400, use combinations (e.g., 700 = 400+300 = תש)
        while (hundredsValue > 0) {
            if (hundredsValue >= 4) {
                result += 'ת'; // 400
                hundredsValue -= 4;
            } else {
                result += hundreds[hundredsValue];
                hundredsValue = 0;
            }
        }
        
        num %= 100;
    }
    
    // Special cases: 15 and 16 (avoid using God's name)
    if (num === 15) return result + 'טו';
    if (num === 16) return result + 'טז';
    
    // Tens
    if (num >= 10) {
        result += tens[Math.floor(num / 10)];
        num %= 10;
    }
    
    // Ones
    if (num > 0) {
        result += ones[num];
    }
    
    // Add geresh (׳) for single letter or gershayim (״) for multiple
    if (result.length === 1) {
        result += '\u05F3'; // geresh
    } else if (result.length > 1) {
        result = result.slice(0, -1) + '\u05F4' + result.slice(-1); // gershayim before last letter
    }
    
    return result;
}

/**
 * Initialize date picker functionality
 */
function initDatePicker() {
    // Set default date input to today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    elements.dateInput.value = todayStr;
    
    // Open native date picker when button clicked
    elements.datePickerBtn.addEventListener('click', () => {
        elements.dateInput.showPicker();
    });
    
    // Handle date selection
    elements.dateInput.addEventListener('change', async (e) => {
        const selectedDateStr = e.target.value;
        if (selectedDateStr) {
            // Parse the selected date (set time to noon to avoid timezone issues)
            selectedDate = new Date(selectedDateStr + 'T12:00:00');
            
            // Check if it's today
            const today = new Date();
            const isToday = selectedDate.toDateString() === today.toDateString();
            
            if (isToday) {
                selectedDate = null; // Use real-time for today
            }
            
            // Update UI
            updateDateUI();
            displayDates();
            
            // Reload zmanim with new date
            await loadZmanim(true);
        }
    });
    
    // Handle "Today" button
    elements.todayBtn.addEventListener('click', async () => {
        selectedDate = null;
        elements.dateInput.value = new Date().toISOString().split('T')[0];
        
        updateDateUI();
        displayDates();
        await loadZmanim(true);
    });
}

/**
 * Update date UI based on selected date
 */
function updateDateUI() {
    const isCustomDate = selectedDate !== null;
    
    // Show/hide "Today" button
    elements.todayBtn.style.display = isCustomDate ? 'block' : 'none';
    
    // Add visual indicator for custom date
    if (isCustomDate) {
        elements.dateSection.classList.add('custom-date');
    } else {
        elements.dateSection.classList.remove('custom-date');
    }
}

/**
 * Display Hebrew and Gregorian dates
 */
function displayDates() {
    const now = getCurrentDate();
    
    // Gregorian date
    const gregorianOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    elements.gregorianDate.textContent = now.toLocaleDateString('he-IL', gregorianOptions);
    
    // Hebrew date with Hebrew letters
    try {
        // Get Hebrew date components using Intl
        const hebrewCalendar = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        const parts = hebrewCalendar.formatToParts(now);
        const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parseInt(parts.find(p => p.type === 'year')?.value || '5786');
        
        // Convert to Hebrew letters
        const hebrewDay = toHebrewNumber(day);
        const hebrewYear = toHebrewNumber(year);
        
        // Format: "י׳ בטבת התשפ״ו"
        elements.hebrewDate.textContent = `${hebrewDay} ב${month} ${hebrewYear}`;
    } catch (e) {
        console.error('Error formatting Hebrew date:', e);
        elements.hebrewDate.textContent = '';
    }
    
    // Custom date indicator
    if (selectedDate) {
        elements.hebrewDate.style.color = 'var(--color-accent)';
    } else {
        elements.hebrewDate.style.color = '';
    }
}

/**
 * Load zmanim data
 */
async function loadZmanim(useCache = false) {
    showLoading();
    hideError();
    
    try {
        // Get location - don't use cache on first load to ensure we request permission
        const location = await getLocationDataWithFallback(useCache);
        elements.locationName.textContent = location.cityName;
        
        // Show a hint if using default location
        if (location.isDefault) {
            elements.locationName.style.color = 'var(--color-warning)';
            elements.locationName.title = 'לחץ על כפתור הרענון לאיתור מיקום מדויק';
        } else {
            elements.locationName.style.color = '';
            elements.locationName.title = '';
        }
        
        // Fetch zmanim (pass selected date if available)
        const zmanim = await fetchZmanim(
            location.latitude,
            location.longitude,
            location.timezone,
            selectedDate
        );
        
        currentZmanim = zmanim;
        displayZmanim(zmanim);
        updateNextZman();
        
        hideLoading();
        showZmanim();
        
        console.log('✅ Zmanim loaded successfully', zmanim);
        
    } catch (error) {
        console.error('❌ Error loading zmanim:', error);
        hideLoading();
        showError(error.message || 'שגיאה בטעינת הזמנים');
    }
}

/**
 * Display zmanim in the grid
 */
function displayZmanim(zmanim) {
    const zmanimList = getZmanimList(zmanim);
    const now = getCurrentDate();
    
    const html = zmanimList.map((zman, index) => {
        const time = new Date(zman.time);
        const isPassed = time < now;
        const isNext = !isPassed && index === zmanimList.findIndex(z => new Date(z.time) > now);
        const isVisible = isZmanVisible(zman.key);
        
        // Determine special styling
        let cardClass = 'time-card';
        if (isPassed) cardClass += ' time-card-passed';
        if (isNext) cardClass += ' active';
        if (zman.key === 'sunrise') cardClass += ' sunrise';
        if (zman.key === 'sunset') cardClass += ' sunset';
        if (zman.key === 'tzeit') cardClass += ' tzeit';
        if (zman.key === 'candleLighting') cardClass += ' shabbat candle-lighting';
        if (zman.key === 'havdalah') cardClass += ' shabbat havdalah';
        if (zman.key === 'havdalahRT') cardClass += ' shabbat havdalah-rt';
        if (!isVisible) cardClass += ' filtered-out';
        
        return `
            <div class="${cardClass}" data-key="${zman.key}" style="animation-delay: ${index * 0.05}s">
                <div class="time-card-header">
                    <span class="time-icon">${getZmanIcon(zman.key)}</span>
                </div>
                <div class="time-card-body">
                    <h3 class="time-name">${zman.hebrew}</h3>
                    <p class="time-value">${zman.formatted}</p>
                </div>
            </div>
        `;
    }).join('');
    
    elements.zmanimContainer.innerHTML = html;
}

/**
 * Get icon for zman type
 */
function getZmanIcon(key) {
    const icons = {
        dawn: '🌅',
        tallitTefillin: '🧣',
        sunrise: '☀️',
        sofZmanShmaGRA: '📖',
        sofZmanShmaMGA: '📖',
        sofZmanTfillaGRA: '🙏',
        candleLighting: '🕯️',
        havdalah: '✨',
        havdalahRT: '✨',
        sofZmanTfillaMGA: '🙏',
        chatzot: '🕛',
        minchaGedola: '🕐',
        minchaKetana: '🕓',
        plagHaMincha: '🌤️',
        sunset: '🌅',
        tzeit: '🌙'
    };
    return icons[key] || '⏰';
}

/**
 * Update next zman countdown
 */
function updateNextZman() {
    if (!currentZmanim) return;
    
    const zmanimList = getZmanimList(currentZmanim);
    const now = getCurrentDate();
    
    // Find next zman that is visible
    const nextZman = zmanimList.find(zman => {
        if (new Date(zman.time) <= now) return false;
        if (!isZmanVisible(zman.key)) return false;
        return true;
    });
    
    if (nextZman) {
        elements.nextZman.style.display = 'block';
        elements.nextZmanName.textContent = nextZman.hebrew;
        
        const timeUntil = new Date(nextZman.time) - now;
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
        
        if (hours > 0) {
            elements.nextZmanCountdown.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            elements.nextZmanCountdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Show the actual time
        elements.nextZmanTime.textContent = `(${nextZman.formatted})`;
    } else {
        elements.nextZman.style.display = 'none';
    }
}

/**
 * Start countdown timer
 */
function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    countdownInterval = setInterval(updateNextZman, 1000);
}

/**
 * Handle refresh button click
 */
async function handleRefresh() {
    elements.refreshBtn.classList.add('spinning');
    clearLocationCache();
    await loadZmanim(false);
    elements.refreshBtn.classList.remove('spinning');
}

/**
 * Handle retry button click
 */
async function handleRetry() {
    await loadZmanim(true);
}

// UI Helper Functions
function showLoading() {
    elements.loading.style.display = 'flex';
}

function hideLoading() {
    elements.loading.style.display = 'none';
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.error.style.display = 'flex';
}

function hideError() {
    elements.error.style.display = 'none';
}

function showZmanim() {
    elements.zmanimContainer.style.display = 'grid';
}

// Location Picker Functions
function initLocationPicker() {
    // Open location modal when clicking location name
    elements.locationName.addEventListener('click', openLocationModal);
    
    // Close modal
    elements.locationClose.addEventListener('click', closeLocationModal);
    elements.locationOverlay.addEventListener('click', closeLocationModal);
    
    // Search input
    let searchTimeout;
    elements.locationSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Show/hide clear button
        elements.searchClear.style.display = query ? 'block' : 'none';
        
        // Debounce search
        clearTimeout(searchTimeout);
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => performSearch(query), 300);
        } else {
            elements.searchResults.style.display = 'none';
        }
    });
    
    // Clear search
    elements.searchClear.addEventListener('click', () => {
        elements.locationSearchInput.value = '';
        elements.searchClear.style.display = 'none';
        elements.searchResults.style.display = 'none';
    });
    
    // Use current location
    elements.useCurrentLocation.addEventListener('click', async () => {
        closeLocationModal();
        setLocationMode('auto');
        clearLocationCache();
        await loadZmanim(false);
    });
}

function openLocationModal() {
    elements.locationModal.classList.add('active');
    elements.locationOverlay.classList.add('active');
    renderFavorites();
    renderRecent();
    elements.locationSearchInput.focus();
}

function closeLocationModal() {
    elements.locationModal.classList.remove('active');
    elements.locationOverlay.classList.remove('active');
    elements.locationSearchInput.value = '';
    elements.searchClear.style.display = 'none';
    elements.searchResults.style.display = 'none';
}

async function performSearch(query) {
    elements.searchResults.innerHTML = '<div class="search-loading">🔍 מחפש...</div>';
    elements.searchResults.style.display = 'block';
    
    const results = await searchLocations(query);
    
    if (results.length === 0) {
        elements.searchResults.innerHTML = '<div class="search-no-results">לא נמצאו תוצאות</div>';
        return;
    }
    
    elements.searchResults.innerHTML = results.map(location => `
        <div class="search-result-item" data-location='${JSON.stringify(location)}'>
            <span class="search-result-name">${location.name}</span>
            <span class="search-result-details">${location.displayName}</span>
        </div>
    `).join('');
    
    // Add click handlers
    elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const location = JSON.parse(item.dataset.location);
            selectLocation(location);
        });
    });
}

async function selectLocation(location) {
    // Add timezone if not present
    if (!location.timezone) {
        location.timezone = getTimezoneFromCoords(location.latitude, location.longitude);
    }
    
    // Save to recent
    saveRecent(location);
    saveCurrentLocation(location);
    setLocationMode('manual');
    
    // Close modal
    closeLocationModal();
    
    // Update location display
    elements.locationName.textContent = location.name;
    elements.locationName.style.color = '';
    elements.locationName.title = '';
    
    // Fetch new zmanim
    showLoading();
    try {
        const zmanim = await fetchZmanim(
            location.latitude,
            location.longitude,
            location.timezone
        );
        
        currentZmanim = zmanim;
        displayZmanim(zmanim);
        updateNextZman();
        hideLoading();
        showZmanim();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function renderFavorites() {
    const favorites = getFavorites();
    
    if (favorites.length === 0) {
        elements.favoritesList.innerHTML = '<p class="location-empty">אין מיקומים שמורים</p>';
        return;
    }
    
    elements.favoritesList.innerHTML = favorites.map(loc => `
        <div class="location-item">
            <span class="location-item-icon">⭐</span>
            <div class="location-item-info">
                <span class="location-item-name">${loc.name}</span>
                <span class="location-item-details">${loc.displayName || loc.country}</span>
            </div>
            <div class="location-item-actions">
                <button class="location-item-btn delete" data-lat="${loc.latitude}" data-lng="${loc.longitude}" title="הסר">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    elements.favoritesList.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('location-item-btn')) return;
            const loc = favorites.find(f => f.name === item.querySelector('.location-item-name').textContent);
            selectLocation(loc);
        });
    });
    
    // Delete handlers
    elements.favoritesList.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFavorite(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng));
            renderFavorites();
        });
    });
}

function renderRecent() {
    const recent = getRecent();
    
    if (recent.length === 0) {
        elements.recentList.innerHTML = '<p class="location-empty">אין חיפושים אחרונים</p>';
        return;
    }
    
    elements.recentList.innerHTML = recent.map(loc => `
        <div class="location-item">
            <span class="location-item-icon">🕐</span>
            <div class="location-item-info">
                <span class="location-item-name">${loc.name}</span>
                <span class="location-item-details">${loc.displayName || loc.country}</span>
            </div>
            <div class="location-item-actions">
                <button class="location-item-btn favorite" data-location='${JSON.stringify(loc)}' title="הוסף למועדפים">⭐</button>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    elements.recentList.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('location-item-btn')) return;
            const loc = recent.find(f => f.name === item.querySelector('.location-item-name').textContent);
            selectLocation(loc);
        });
    });
    
    // Favorite handlers
    elements.recentList.querySelectorAll('.favorite').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const loc = JSON.parse(btn.dataset.location);
            saveFavorite(loc);
            renderFavorites();
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '⭐', 1000);
        });
    });
}

// Register Service Worker for PWA
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ ServiceWorker registered:', registration.scope);
        } catch (error) {
            console.log('⚠️ ServiceWorker registration failed:', error);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        registerServiceWorker();
    });
} else {
    init();
    registerServiceWorker();
}
