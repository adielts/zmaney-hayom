/**
 * Geocoding Service - Location Search
 * Uses OpenStreetMap Nominatim API for free geocoding
 */

const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for locations by name
 * @param {string} query - Search query (city name)
 * @returns {Promise<Array>} Array of location results
 */
export async function searchLocations(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const url = new URL(NOMINATIM_API);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '10');
    url.searchParams.set('accept-language', 'he,en');

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'ZmaneyHayom/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const results = await response.json();

        return results.map(result => {
            const address = result.address || {};
            const suburb = address.suburb || address.neighbourhood || '';
            const city = address.city || address.town || address.village || '';
            const country = address.country || '';
            
            // Build display name: city, country
            const parts = [];
            if (city) parts.push(city);
            if (country) parts.push(country);
            const displayName = parts.join(', ');
            
            return {
                name: suburb || city || result.display_name.split(',')[0],
                displayName: displayName || result.display_name,
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                country: country,
                countryCode: address.country_code?.toUpperCase() || ''
            };
        });

    } catch (error) {
        console.error('Location search error:', error);
        return [];
    }
}

/**
 * Get timezone for coordinates
 */
export function getTimezoneFromCoords(latitude, longitude) {
    // Israel
    if (latitude > 29 && latitude < 34 && longitude > 34 && longitude < 36) {
        return 'Asia/Jerusalem';
    }
    // USA East Coast
    if (latitude > 25 && latitude < 48 && longitude > -85 && longitude < -65) {
        return 'America/New_York';
    }
    // Europe
    if (latitude > 35 && latitude < 70 && longitude > -10 && longitude < 40) {
        return 'Europe/Paris';
    }
    
    const offset = Math.round(longitude / 15);
    return `Etc/GMT${offset >= 0 ? '-' : '+'}${Math.abs(offset)}`;
}

/**
 * Storage keys
 */
const STORAGE_KEYS = {
    FAVORITES: 'zmaneyHayom_favorites',
    RECENT: 'zmaneyHayom_recent',
    MODE: 'zmaneyHayom_locationMode',
    CURRENT: 'zmaneyHayom_currentLocation'
};

/**
 * Save favorite location
 */
export function saveFavorite(location) {
    const favorites = getFavorites();
    
    const exists = favorites.some(fav => 
        fav.latitude === location.latitude && 
        fav.longitude === location.longitude
    );
    
    if (!exists) {
        favorites.unshift(location);
        if (favorites.length > 5) {
            favorites.pop();
        }
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    }
}

/**
 * Remove favorite location
 */
export function removeFavorite(latitude, longitude) {
    const favorites = getFavorites();
    const filtered = favorites.filter(fav => 
        fav.latitude !== latitude || fav.longitude !== longitude
    );
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(filtered));
}

/**
 * Get favorite locations
 */
export function getFavorites() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.FAVORITES);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Save to recent searches
 */
export function saveRecent(location) {
    const recent = getRecent();
    
    const filtered = recent.filter(r => 
        r.latitude !== location.latitude || 
        r.longitude !== location.longitude
    );
    
    filtered.unshift(location);
    
    if (filtered.length > 5) {
        filtered.pop();
    }
    
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(filtered));
}

/**
 * Get recent searches
 */
export function getRecent() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.RECENT);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Save current location
 */
export function saveCurrentLocation(location) {
    localStorage.setItem(STORAGE_KEYS.CURRENT, JSON.stringify(location));
}

/**
 * Get current saved location
 */
export function getCurrentSavedLocation() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

/**
 * Set location mode (auto/manual)
 */
export function setLocationMode(mode) {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
}

/**
 * Get location mode
 */
export function getLocationMode() {
    return localStorage.getItem(STORAGE_KEYS.MODE) || 'auto';
}
