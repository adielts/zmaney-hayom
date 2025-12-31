/**
 * Main Application - Zmaney HaYom
 * Coordinates all modules and handles UI
 */

import { fetchZmanim, getZmanimList } from './api.js';
import { getLocationData, getLocationDataWithFallback, clearLocationCache } from './location.js';
import { initSettingsPanel, applyFilters, isZmanVisible } from './settings.js';

// DOM Elements
const elements = {
    locationName: document.getElementById('location-name'),
    refreshBtn: document.getElementById('refresh-btn'),
    hebrewDate: document.getElementById('hebrew-date'),
    gregorianDate: document.getElementById('gregorian-date'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    zmanimContainer: document.getElementById('zmanim-container'),
    nextZman: document.getElementById('next-zman'),
    nextZmanName: document.getElementById('next-zman-name'),
    nextZmanCountdown: document.getElementById('next-zman-countdown')
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
    
    // Initialize settings panel
    initSettingsPanel();
    
    // Listen for filter changes
    window.addEventListener('zmanimFiltered', () => {
        updateNextZman();
    });
    
    // Display current date
    displayDates();
    
    // Load zmanim - don't use cache on initial load to request location permission
    await loadZmanim(false);
    
    // Update countdown every second
    startCountdown();
    
    // Refresh zmanim every hour
    setInterval(() => loadZmanim(false), 60 * 60 * 1000);
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
 * Display Hebrew and Gregorian dates
 */
function displayDates() {
    const now = new Date();
    
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
        
        // Fetch zmanim
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
    const now = new Date();
    
    const html = zmanimList.map((zman, index) => {
        const time = new Date(zman.time);
        const isPassed = time < now;
        const isNext = !isPassed && index === zmanimList.findIndex(z => new Date(z.time) > now);
        const isVisible = isZmanVisible(zman.key);
        
        // Determine special styling
        let cardClass = 'time-card';
        if (isPassed) cardClass += ' passed';
        if (isNext) cardClass += ' active';
        if (zman.key === 'sunrise') cardClass += ' sunrise';
        if (zman.key === 'sunset') cardClass += ' sunset';
        if (zman.key === 'tzeit') cardClass += ' tzeit';
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
        sunrise: '☀️',
        sofZmanShmaGRA: '📖',
        sofZmanShmaMGA: '📖',
        sofZmanTfillaGRA: '🙏',
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
    const now = new Date();
    
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
