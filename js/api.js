/**
 * Zmanim API Service
 * Fetches Jewish prayer times from the Hebcal API
 * Calculations according to לוח אור החיים
 */

const HEBCAL_API_BASE = 'https://www.hebcal.com/zmanim';

/**
 * Formats an ISO time string to HH:MM format
 * @param {string} isoString - ISO 8601 date-time string
 * @returns {string} Formatted time string in HH:MM format, or '--:--' if invalid
 */
function formatTime(isoString) {
    if (!isoString) {
        return '--:--';
    }
    
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            return '--:--';
        }
        
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (error) {
        console.error('Error formatting time:', error);
        return '--:--';
    }
}

/**
 * Calculate צאת הכוכבים according to אור החיים
 * Adjusted for Hebcal API base times
 * @param {string} sunsetTime - ISO timestamp of sunset
 * @param {number} latitude - Location latitude
 * @returns {string} ISO timestamp for tzeit
 */
function calculateTzeitOhrHachaim(sunsetTime, latitude) {
    const sunset = new Date(sunsetTime);
    const month = sunset.getMonth();
    
    // אור החיים times adjusted for Hebcal API:
    // Winter (Dec-Jan): 16 minutes (API sunset + 16 = אור החיים tzeit)
    // Late Winter (Nov, Feb): ~17-18 minutes
    // Spring/Fall: ~20-22 minutes  
    // Summer (May-Aug): ~26-28 minutes
    
    let minutesAfterSunset;
    
    if (month === 0 || month === 11) {
        // December-January
        minutesAfterSunset = 16;
    } else if (month === 1 || month === 10) {
        // November, February
        minutesAfterSunset = 18;
    } else if (month >= 4 && month <= 7) {
        // Summer (May-Aug)
        minutesAfterSunset = 27;
    } else {
        // Spring/Fall (Mar-Apr, Sep-Oct)
        minutesAfterSunset = 21;
    }
    
    // Adjust for latitude (higher latitude = longer twilight)
    const latitudeAdjustment = Math.abs(latitude - 31.78) * 0.3; // Base: Jerusalem
    minutesAfterSunset += latitudeAdjustment;
    
    const tzeit = new Date(sunset.getTime() + minutesAfterSunset * 60 * 1000);
    return tzeit.toISOString();
}

/**
 * Calculate צאת השבת according to אור החיים
 * Adjusted for Hebcal API base times
 * @param {string} sunsetTime - ISO timestamp of sunset
 * @param {number} latitude - Location latitude
 * @returns {string} ISO timestamp for tzeitShabbat
 */
function calculateTzeitShabbat(sunsetTime, latitude) {
    const sunset = new Date(sunsetTime);
    const month = sunset.getMonth();
    
    // אור החיים times for צאת השבת adjusted for Hebcal API:
    // Winter (Dec-Jan): 34 minutes (API sunset + 34 = אור החיים tzeitShabbat)
    // November, February: ~32 minutes
    // Spring/Fall: ~30 minutes
    // Summer: ~36-38 minutes
    
    let minutesAfterSunset;
    
    if (month === 0 || month === 11) {
        // December-January
        minutesAfterSunset = 34;
    } else if (month === 1 || month === 10) {
        // November, February
        minutesAfterSunset = 32;
    } else if (month >= 4 && month <= 7) {
        // Summer (May-Aug)
        minutesAfterSunset = 37;
    } else {
        // Spring/Fall (Mar-Apr, Sep-Oct)
        minutesAfterSunset = 30;
    }
    
    // Adjust for latitude (higher latitude = longer twilight)
    const latitudeAdjustment = Math.abs(latitude - 31.78) * 0.3; // Base: Jerusalem
    minutesAfterSunset += latitudeAdjustment;
    
    const tzeitShabbat = new Date(sunset.getTime() + minutesAfterSunset * 60 * 1000);
    return tzeitShabbat.toISOString();
}

/**
 * Calculate עלות השחר according to אור החיים
 * Adjusted for Hebcal API base times
 * @param {string} sunriseTime - ISO timestamp of sunrise
 * @param {number} latitude - Location latitude
 * @returns {string} ISO timestamp for alot
 */
function calculateAlotOhrHachaim(sunriseTime, latitude) {
    const sunrise = new Date(sunriseTime);
    const month = sunrise.getMonth();
    
    // אור החיים times for עלות השחר adjusted for Hebcal API:
    // Winter (Dec-Jan): 68 minutes (API sunrise - 68 = אור החיים alot)
    // November, February: ~70 minutes
    // Spring/Fall: ~78-80 minutes
    // Summer: ~88-90 minutes
    
    let minutesBeforeSunrise;
    
    if (month === 0 || month === 11) {
        // December-January
        minutesBeforeSunrise = 68;
    } else if (month === 1 || month === 10) {
        // November, February
        minutesBeforeSunrise = 70;
    } else if (month >= 4 && month <= 7) {
        // Summer (May-Aug)
        minutesBeforeSunrise = 89;
    } else {
        // Spring/Fall (Mar-Apr, Sep-Oct)
        minutesBeforeSunrise = 79;
    }
    
    // Adjust for latitude
    const latitudeAdjustment = Math.abs(latitude - 31.78) * 0.5;
    minutesBeforeSunrise += latitudeAdjustment;
    
    const alot = new Date(sunrise.getTime() - minutesBeforeSunrise * 60 * 1000);
    return alot.toISOString();
}

/**
 * Fetches Zmanim (Jewish prayer times) from the Hebcal API
 * @param {number} latitude - Geographic latitude
 * @param {number} longitude - Geographic longitude
 * @param {string} timezone - IANA timezone identifier (e.g., 'Asia/Jerusalem')
 * @param {Date} debugDate - Optional date for testing (default: current date)
 * @returns {Promise<Object>} Object containing formatted zmanim times
 * @throws {Error} If the API request fails or returns invalid data
 * 
 * @example
 * const zmanim = await fetchZmanim(31.7683, 35.2137, 'Asia/Jerusalem');
 * console.log(zmanim.sunrise); // "06:45"
 */
async function fetchZmanim(latitude, longitude, timezone, debugDate = null) {
    // Validate parameters
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error('Latitude and longitude must be numbers');
    }
    
    if (!timezone || typeof timezone !== 'string') {
        throw new Error('Timezone must be a valid string');
    }
    
    const targetDate = debugDate || new Date();
    
    // Format date as YYYY-MM-DD
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Build API URL
    const url = new URL(HEBCAL_API_BASE);
    url.searchParams.set('cfg', 'json');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('tzid', timezone);
    url.searchParams.set('date', dateStr);
    
    try {
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data || !data.times) {
            throw new Error('Invalid API response: missing times data');
        }
        
        const times = data.times;
        
        // Calculate אור החיים specific times
        const tzeitOhrHachaim = calculateTzeitOhrHachaim(times.sunset, latitude);
        const alotOhrHachaim = calculateAlotOhrHachaim(times.sunrise, latitude);
        
        // Get day of week (0 = Sunday, 5 = Friday, 6 = Saturday)
        const dayOfWeek = targetDate.getDay();
        
        // Extract and format the main zmanim times according to לוח אור החיים
        const zmanim = {
            // עלות השחר - Dawn (אור החיים - 16.1° below horizon)
            dawn: {
                time: alotOhrHachaim,
                formatted: formatTime(alotOhrHachaim),
                hebrew: 'עלות השחר',
                english: 'Dawn'
            },
            // הנץ החמה - Sunrise
            sunrise: {
                time: times.sunrise,
                formatted: formatTime(times.sunrise),
                hebrew: 'הנץ החמה',
                english: 'Sunrise'
            },
            // סוף זמן ק"ש - Latest Shema (GR"A - used by אור החיים)
            sofZmanShmaGRA: {
                time: times.sofZmanShma,
                formatted: formatTime(times.sofZmanShma),
                hebrew: 'סוף זמן ק"ש גר"א',
                english: 'Latest Shema GRA'
            },
            // סוף זמן ק"ש - Latest Shema (MG"A)
            sofZmanShmaMGA: {
                time: times.sofZmanShmaMGA,
                formatted: formatTime(times.sofZmanShmaMGA),
                hebrew: 'סוף זמן ק"ש מגן אברהם',
                english: 'Latest Shema MGA'
            },
            // סוף זמן תפילה - Latest Shacharit (GR"A - used by אור החיים)
            sofZmanTfillaGRA: {
                time: times.sofZmanTfilla,
                formatted: formatTime(times.sofZmanTfilla),
                hebrew: 'סוף זמן תפילה גר"א',
                english: 'Latest Shacharit GRA'
            },
            // סוף זמן תפילה - Latest Shacharit (MG"A)
            sofZmanTfillaMGA: {
                time: times.sofZmanTfillaMGA,
                formatted: formatTime(times.sofZmanTfillaMGA),
                hebrew: 'סוף זמן תפילה מגן אברהם',
                english: 'Latest Shacharit MGA'
            },
            // חצות היום - Midday
            chatzot: {
                time: times.chatzot,
                formatted: formatTime(times.chatzot),
                hebrew: 'חצות היום',
                english: 'Midday'
            },
            // מנחה גדולה - Earliest Mincha
            minchaGedola: {
                time: times.minchaGedola,
                formatted: formatTime(times.minchaGedola),
                hebrew: 'מנחה גדולה',
                english: 'Earliest Mincha'
            },
            // מנחה קטנה - Mincha Ketana
            minchaKetana: {
                time: times.minchaKetana,
                formatted: formatTime(times.minchaKetana),
                hebrew: 'מנחה קטנה',
                english: 'Mincha Ketana'
            },
            // פלג המנחה - Plag HaMincha
            plagHaMincha: {
                time: times.plagHaMincha,
                formatted: formatTime(times.plagHaMincha),
                hebrew: 'פלג המנחה',
                english: 'Plag HaMincha'
            },
            // שקיעה - Sunset
            sunset: {
                time: times.sunset,
                formatted: formatTime(times.sunset),
                hebrew: 'שקיעה',
                english: 'Sunset'
            },
            // צאת הכוכבים - Nightfall (אור החיים - 8.5° below horizon)
            tzeit: {
                time: tzeitOhrHachaim,
                formatted: formatTime(tzeitOhrHachaim),
                hebrew: 'צאת הכוכבים',
                english: 'Nightfall'
            }
        };
        
        // Add Shabbat times based on day of week
        if (dayOfWeek === 5) {
            // Friday - show both Candle Lighting and צאת השבת
            if (times.sunset) {
                // הדלקת נרות - 18 minutes before API sunset (adjusted for אור החיים)
                const candleTime = new Date(times.sunset);
                candleTime.setMinutes(candleTime.getMinutes() - 18);
                zmanim.candleLighting = {
                    time: candleTime.toISOString(),
                    formatted: formatTime(candleTime.toISOString()),
                    hebrew: 'הדלקת נרות',
                    english: 'Candle Lighting'
                };
            }
            
            // צאת השבת - calculated for Saturday evening using Saturday's sunset
            // For now, estimate Saturday sunset as ~1 minute later than Friday
            const saturdaySunset = new Date(times.sunset);
            saturdaySunset.setDate(saturdaySunset.getDate() + 1);
            saturdaySunset.setMinutes(saturdaySunset.getMinutes() + 1);
            const tzeitShabbat = calculateTzeitShabbat(saturdaySunset.toISOString(), latitude);
            zmanim.havdalah = {
                time: tzeitShabbat,
                formatted: formatTime(tzeitShabbat),
                hebrew: 'צאת השבת',
                english: 'Shabbat Ends'
            };
            
            // צאת שבת ר"ת - Rabbeinu Tam (68 minutes after API sunset = אור החיים 18:02)
            const tzeitShabbatRT = new Date(saturdaySunset.getTime() + 68 * 60 * 1000);
            zmanim.havdalahRT = {
                time: tzeitShabbatRT.toISOString(),
                formatted: formatTime(tzeitShabbatRT.toISOString()),
                hebrew: 'צאת שבת ר"ת',
                english: 'Shabbat Ends RT'
            };
        } else if (dayOfWeek === 6) {
            // Saturday - show צאת השבת and צאת שבת ר"ת
            const tzeitShabbat = calculateTzeitShabbat(times.sunset, latitude);
            zmanim.havdalah = {
                time: tzeitShabbat,
                formatted: formatTime(tzeitShabbat),
                hebrew: 'צאת השבת',
                english: 'Shabbat Ends'
            };
            
            // צאת שבת ר"ת - Rabbeinu Tam (68 minutes after API sunset = אור החיים)
            const tzeitShabbatRT = new Date(new Date(times.sunset).getTime() + 68 * 60 * 1000);
            zmanim.havdalahRT = {
                time: tzeitShabbatRT.toISOString(),
                formatted: formatTime(tzeitShabbatRT.toISOString()),
                hebrew: 'צאת שבת ר"ת',
                english: 'Shabbat Ends RT'
            };
        }
        
        // Add metadata
        zmanim.meta = {
            date: data.date || new Date().toISOString().split('T')[0],
            location: {
                latitude,
                longitude,
                timezone
            },
            fetchedAt: new Date().toISOString()
        };
        
        return zmanim;
        
    } catch (error) {
        // Re-throw with more context if it's a network error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to Hebcal API');
        }
        throw error;
    }
}

/**
 * Gets a simple array of zmanim for display purposes
 * @param {Object} zmanim - Zmanim object returned from fetchZmanim
 * @returns {Array<Object>} Array of zmanim with time, hebrew, and english properties
 */
function getZmanimList(zmanim) {
    const keys = [
        'dawn', 
        'sunrise', 
        'sofZmanShmaMGA', 
        'sofZmanShmaGRA', 
        'sofZmanTfillaMGA', 
        'sofZmanTfillaGRA',
        'chatzot', 
        'minchaGedola', 
        'minchaKetana',
        'plagHaMincha',
        'candleLighting',  // Friday evening
        'sunset', 
        'tzeit',
        'havdalah',        // צאת השבת
        'havdalahRT'       // צאת שבת ר"ת
    ];
    
    return keys
        .filter(key => zmanim[key]) // Only include times that exist
        .map(key => ({
            key,
            ...zmanim[key]
        }));
}

// Export functions for use in other modules
export { fetchZmanim, formatTime, getZmanimList };
