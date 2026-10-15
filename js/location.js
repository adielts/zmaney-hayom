/**
 * Location Service for Zmanim Web Application
 * Handles geolocation, timezone detection, and reverse geocoding
 */

const STORAGE_KEY = 'zmanim_last_location';
const PERMISSION_KEY = 'zmanim_location_permission_asked';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Checks whether the browser permission prompt was already shown once
 * @returns {boolean} True if the user was already asked for location access
 */
function hasAskedForPermission() {
    try {
        return localStorage.getItem(PERMISSION_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

/**
 * Remembers that the permission prompt was already shown, so it is never
 * triggered automatically a second time
 */
function markPermissionAsked() {
    try {
        localStorage.setItem(PERMISSION_KEY, 'true');
    } catch (error) {
        console.warn('Failed to persist location permission state:', error);
    }
}

/**
 * Reads the current geolocation permission state
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>} Permission state
 */
async function getPermissionState() {
    if (!navigator.permissions?.query) {
        return 'unknown';
    }
    
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state;
    } catch (error) {
        // Permissions API not supported for geolocation (older Safari)
        return 'unknown';
    }
}

/**
 * Subscribes to geolocation permission changes (e.g. the user grants access
 * from the browser settings after denying it)
 * @param {(state: string) => void} callback - Called with the new state
 */
async function onPermissionChange(callback) {
    if (!navigator.permissions?.query) return;
    
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        status.addEventListener('change', () => callback(status.state));
    } catch (error) {
        // Permission monitoring is not available - silently ignore
    }
}

/**
 * Gets the current geographic position using browser Geolocation API
 * @returns {Promise<{latitude: number, longitude: number}>} Coordinates object
 * @throws {Error} If geolocation fails or is denied
 */
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes cache
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Location permission denied. Please enable location access in your browser settings.'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Location information is unavailable. Please check your device settings.'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Location request timed out. Please try again.'));
                        break;
                    default:
                        reject(new Error('An unknown error occurred while getting location.'));
                        break;
                }
            },
            options
        );
    });
}

/**
 * Gets the timezone string for given coordinates
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<string>} Timezone string (e.g., "America/New_York")
 */
async function getTimezone(latitude, longitude) {
    try {
        // Try to use a timezone API if available
        // For now, use the browser's timezone as fallback
        // This is accurate for the user's current location
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        if (timezone) {
            return timezone;
        }
        
        // Fallback to UTC if no timezone detected
        return 'UTC';
    } catch (error) {
        console.warn('Failed to detect timezone, using UTC:', error);
        return 'UTC';
    }
}

/**
 * Gets the city name for given coordinates using reverse geocoding
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<string>} City/town name or "Unknown Location"
 */
async function getCityName(latitude, longitude) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'Accept-Language': 'en',
                'User-Agent': 'ZmanimWebApp/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Try to extract city name from address components
        const address = data.address || {};
        const cityName = address.city || 
                        address.town || 
                        address.village || 
                        address.municipality ||
                        address.county ||
                        address.state ||
                        data.display_name?.split(',')[0] ||
                        'Unknown Location';
        
        return cityName;
    } catch (error) {
        console.warn('Failed to get city name:', error);
        return 'Unknown Location';
    }
}

/**
 * Saves location data to local storage
 * @param {Object} locationData - Location data to cache
 */
function saveToCache(locationData) {
    try {
        const cacheData = {
            ...locationData,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        console.warn('Failed to save location to cache:', error);
    }
}

/**
 * Retrieves cached location data from local storage
 * @returns {Object|null} Cached location data or null if expired/missing
 */
function getFromCache() {
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (!cached) {
            return null;
        }

        const cacheData = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - cacheData.timestamp > CACHE_DURATION) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return {
            latitude: cacheData.latitude,
            longitude: cacheData.longitude,
            timezone: cacheData.timezone,
            cityName: cacheData.cityName,
            fromCache: true
        };
    } catch (error) {
        console.warn('Failed to read location from cache:', error);
        return null;
    }
}

/**
 * Clears the location cache
 */
function clearLocationCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear location cache:', error);
    }
}

/**
 * Main function to get complete location data
 * Combines geolocation, timezone, and city name
 *
 * The browser permission prompt is only triggered once: afterwards the app
 * relies on the granted permission (which never prompts again) or on the
 * cached location, unless the user explicitly asks for a fresh location.
 *
 * @param {Object} [options]
 * @param {boolean} [options.useCache=true] - Use cached data when still valid
 * @param {boolean} [options.allowPrompt=false] - Allow showing the permission
 *        prompt again following an explicit user action
 * @returns {Promise<{latitude: number, longitude: number, timezone: string, cityName: string, fromCache?: boolean}>}
 */
async function getLocationData({ useCache = true, allowPrompt = false } = {}) {
    // Try to get cached data first
    if (useCache) {
        const cachedData = getFromCache();
        if (cachedData) {
            console.log('Using cached location data');
            return cachedData;
        }
    }

    const permissionState = await getPermissionState();

    // Permission was denied - never prompt again, fall back to a known location
    if (permissionState === 'denied') {
        console.log('Geolocation permission denied, using cached or default');
        const cachedData = getFromCache();
        if (cachedData) return cachedData;
        throw new Error('Location permission denied');
    }

    // Permission not granted yet. Only prompt on the very first run, or when
    // the user explicitly asked for it (refresh / "use current location").
    if (permissionState !== 'granted' && hasAskedForPermission() && !allowPrompt) {
        console.log('Location permission already requested before, not asking again');
        const cachedData = getFromCache();
        if (cachedData) return cachedData;
        throw new Error('Location permission not granted');
    }

    markPermissionAsked();

    // Get fresh location data
    const { latitude, longitude } = await getCurrentLocation();
    
    // Fetch timezone and city name in parallel
    const [timezone, cityName] = await Promise.all([
        getTimezone(latitude, longitude),
        getCityName(latitude, longitude)
    ]);

    const locationData = {
        latitude,
        longitude,
        timezone,
        cityName,
        fromCache: false
    };

    // Save to cache for future use
    saveToCache(locationData);

    return locationData;
}

/**
 * Gets location data with fallback to default location
 * @param {Object} [options] - Same options as getLocationData
 * @returns {Promise<Object>} Location data
 */
async function getLocationDataWithFallback(options = {}) {
    try {
        return await getLocationData(options);
    } catch (error) {
        console.warn('Geolocation failed, checking cache or using default:', error.message);
        
        // Try cache even if expired
        const cached = getFromCache();
        if (cached) {
            return cached;
        }

        // Default to Jerusalem with a flag indicating it's a fallback
        return {
            latitude: 31.7683,
            longitude: 35.2137,
            timezone: 'Asia/Jerusalem',
            cityName: 'ירושלים (מיקום ברירת מחדל)',
            fromCache: false,
            isDefault: true
        };
    }
}

// Export functions for use in other modules
export {
    getCurrentLocation,
    getTimezone,
    getCityName,
    getLocationData,
    getLocationDataWithFallback,
    getPermissionState,
    onPermissionChange,
    hasAskedForPermission,
    saveToCache,
    getFromCache,
    clearLocationCache,
    STORAGE_KEY,
    CACHE_DURATION
};
