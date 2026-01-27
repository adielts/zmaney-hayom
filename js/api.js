/**
 * Zmanim API Service
 * Fetches Jewish prayer times from the Hebcal API
 * Calculations according to לוח אור החיים using seasonal minutes (דקות זמניות)
 */

const HEBCAL_API_BASE = 'https://www.hebcal.com/zmanim';

/**
 * Formats a Date object or ISO time string to HH:MM format
 * @param {Date|string} time - Date object or ISO 8601 date-time string
 * @returns {string} Formatted time string in HH:MM format, or '--:--' if invalid
 */
function formatTime(time) {
    if (!time) {
        return '--:--';
    }
    
    try {
        const date = time instanceof Date ? time : new Date(time);
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
 * Calculate the length of a "seasonal minute" (דקה זמנית)
 * Based on the day length from sunrise to sunset
 * Day is divided into 12 seasonal hours = 720 seasonal minutes
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {number} Length of one seasonal minute in milliseconds
 */
function getSeasonalMinute(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    return dayLengthMs / 720;
}

/**
 * Calculate עלות השחר (Dawn) - אור החיים method
 * 72 seasonal minutes before sunrise = day length ÷ 10 before sunrise
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Dawn time
 */
function calculateAlotHashachar(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    // 72 seasonal minutes = 1/10 of day length
    const alotOffset = dayLengthMs / 10;
    return new Date(sunrise.getTime() - alotOffset);
}

/**
 * Calculate זמן טלית ותפילין - אור החיים method
 * 6 seasonal minutes after עלות השחר (כדעת הפרי מגדים)
 * @param {Date} alot - Dawn time
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Earliest time for Tallit and Tefillin
 */
function calculateTallitTefillin(alot, sunrise, sunset) {
    const seasonalMinute = getSeasonalMinute(sunrise, sunset);
    return new Date(alot.getTime() + (6 * seasonalMinute));
}

/**
 * Calculate סוף זמן קריאת שמע - מגן אברהם
 * 3 seasonal hours from עלות השחר to צאת הכוכבים ר"ת
 * @param {Date} alot - Dawn time
 * @param {Date} tzeitRT - Rabbeinu Tam nightfall
 * @returns {Date} Latest time for Shema (MGA)
 */
function calculateSofZmanShmaMGA(alot, tzeitRT) {
    const dayLengthMs = tzeitRT.getTime() - alot.getTime();
    const seasonalHour = dayLengthMs / 12;
    return new Date(alot.getTime() + (3 * seasonalHour));
}

/**
 * Calculate סוף זמן קריאת שמע - גר"א
 * 3 seasonal hours from sunrise to sunset
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Latest time for Shema (GRA)
 */
function calculateSofZmanShmaGRA(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    const seasonalHour = dayLengthMs / 12;
    return new Date(sunrise.getTime() + (3 * seasonalHour));
}

/**
 * Calculate סוף זמן תפילה - מגן אברהם
 * 4 seasonal hours from עלות השחר to צאת הכוכבים ר"ת
 * @param {Date} alot - Dawn time
 * @param {Date} tzeitRT - Rabbeinu Tam nightfall
 * @returns {Date} Latest time for Tefilla (MGA)
 */
function calculateSofZmanTfillaMGA(alot, tzeitRT) {
    const dayLengthMs = tzeitRT.getTime() - alot.getTime();
    const seasonalHour = dayLengthMs / 12;
    return new Date(alot.getTime() + (4 * seasonalHour));
}

/**
 * Calculate סוף זמן תפילה - גר"א
 * 4 seasonal hours from sunrise to sunset
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Latest time for Tefilla (GRA)
 */
function calculateSofZmanTfillaGRA(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    const seasonalHour = dayLengthMs / 12;
    return new Date(sunrise.getTime() + (4 * seasonalHour));
}

/**
 * Calculate חצות היום (Midday) - אור החיים method
 * Midpoint between sunrise and sunset
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Midday time
 */
function calculateChatzot(sunrise, sunset) {
    const midpoint = (sunrise.getTime() + sunset.getTime()) / 2;
    return new Date(midpoint);
}

/**
 * Calculate מנחה גדולה - אור החיים method
 * Half hour (regular or seasonal, whichever is later) after chatzot
 * @param {Date} chatzot - Midday time
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Earliest Mincha time
 */
function calculateMinchaGedola(chatzot, sunrise, sunset) {
    const seasonalMinute = getSeasonalMinute(sunrise, sunset);
    const seasonalHalfHour = 30 * seasonalMinute;
    const regularHalfHour = 30 * 60 * 1000; // 30 minutes in ms
    
    // Use the later of the two (לחומרא)
    const offset = Math.max(seasonalHalfHour, regularHalfHour);
    return new Date(chatzot.getTime() + offset);
}

/**
 * Calculate מנחה קטנה - אור החיים method
 * 9.5 seasonal hours from sunrise
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Mincha Ketana time
 */
function calculateMinchaKetana(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    const seasonalHour = dayLengthMs / 12;
    return new Date(sunrise.getTime() + (9.5 * seasonalHour));
}

/**
 * Calculate פלג המנחה - אור החיים method
 * 10.75 seasonal hours from sunrise (1.25 hours before sunset)
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Plag HaMincha time
 */
function calculatePlagHaMincha(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    const seasonalHour = dayLengthMs / 12;
    return new Date(sunrise.getTime() + (10.75 * seasonalHour));
}

/**
 * Calculate צאת הכוכבים - אור החיים method
 * 13.5 seasonal minutes after sunset (3/4 מיל)
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Nightfall time
 */
function calculateTzeitHakochavim(sunrise, sunset) {
    const seasonalMinute = getSeasonalMinute(sunrise, sunset);
    return new Date(sunset.getTime() + (13.5 * seasonalMinute));
}

/**
 * Calculate צאת שבת ר"ת (Rabbeinu Tam) - אור החיים method
 * 72 seasonal minutes after sunset = day length ÷ 10 after sunset
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Rabbeinu Tam nightfall time
 */
function calculateTzeitRT(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    // 72 seasonal minutes = 1/10 of day length
    const rtOffset = dayLengthMs / 10;
    return new Date(sunset.getTime() + rtOffset);
}

/**
 * Calculate הדלקת נרות - אור החיים method
 * 20 minutes before sunset (40 minutes in Jerusalem for מחמירים)
 * @param {Date} sunset - Sunset time
 * @param {boolean} isJerusalem - Is location in Jerusalem area
 * @returns {Date} Candle lighting time
 */
function calculateCandleLighting(sunset, isJerusalem = false) {
    const minutes = isJerusalem ? 40 : 20;
    return new Date(sunset.getTime() - (minutes * 60 * 1000));
}

/**
 * Calculate צאת השבת - אור החיים method
 * 30 minutes after sunset
 * @param {Date} sunset - Sunset time
 * @returns {Date} Shabbat end time
 */
function calculateTzeitShabbat(sunset) {
    return new Date(sunset.getTime() + (30 * 60 * 1000));
}

/**
 * Check if location is in Jerusalem area
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
function isJerusalemArea(latitude, longitude) {
    // Jerusalem approximate bounds
    return latitude >= 31.7 && latitude <= 31.85 && 
           longitude >= 35.1 && longitude <= 35.25;
}

/**
 * Fetch zmanim from Hebcal API and calculate according to אור החיים
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude  
 * @param {string} timezone - IANA timezone identifier
 * @param {Date} debugDate - Optional date for testing (default: current date)
 * @returns {Promise<Object>} Zmanim data object
 */
async function fetchZmanim(latitude, longitude, timezone, debugDate = null) {
    const targetDate = debugDate || new Date();
    
    // Format date as YYYY-MM-DD
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const url = new URL(HEBCAL_API_BASE);
    url.searchParams.set('cfg', 'json');
    url.searchParams.set('latitude', latitude);
    url.searchParams.set('longitude', longitude);
    url.searchParams.set('tzid', timezone);
    url.searchParams.set('date', dateStr);
    
    try {
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            throw new Error(`Hebcal API error: ${response.status}`);
        }
        
        const data = await response.json();
        const times = data.times;
        
        // Parse base times from API
        const sunrise = new Date(times.sunrise);
        const sunset = new Date(times.sunset);
        
        // Check if Jerusalem area for candle lighting
        const inJerusalem = isJerusalemArea(latitude, longitude);
        
        // Calculate צאת ר"ת first (needed for MGA calculations)
        const tzeitRT = calculateTzeitRT(sunrise, sunset);
        
        // Calculate עלות השחר (needed for MGA calculations)
        const alot = calculateAlotHashachar(sunrise, sunset);
        
        // Calculate all times according to אור החיים methodology
        const tallitTefillin = calculateTallitTefillin(alot, sunrise, sunset);
        const sofZmanShmaMGA = calculateSofZmanShmaMGA(alot, tzeitRT);
        const sofZmanShmaGRA = calculateSofZmanShmaGRA(sunrise, sunset);
        const sofZmanTfillaMGA = calculateSofZmanTfillaMGA(alot, tzeitRT);
        const sofZmanTfillaGRA = calculateSofZmanTfillaGRA(sunrise, sunset);
        const chatzot = calculateChatzot(sunrise, sunset);
        const minchaGedola = calculateMinchaGedola(chatzot, sunrise, sunset);
        const minchaKetana = calculateMinchaKetana(sunrise, sunset);
        const plagHaMincha = calculatePlagHaMincha(sunrise, sunset);
        const tzeit = calculateTzeitHakochavim(sunrise, sunset);
        
        // Get day of week (0 = Sunday, 5 = Friday, 6 = Saturday)
        const dayOfWeek = targetDate.getDay();
        
        // Build zmanim object
        const zmanim = {
            dawn: {
                time: alot.toISOString(),
                formatted: formatTime(alot),
                hebrew: 'עלות השחר',
                english: 'Dawn'
            },
            tallitTefillin: {
                time: tallitTefillin.toISOString(),
                formatted: formatTime(tallitTefillin),
                hebrew: 'זמן טלית ותפילין',
                english: 'Tallit & Tefillin'
            },
            sunrise: {
                time: sunrise.toISOString(),
                formatted: formatTime(sunrise),
                hebrew: 'הנץ החמה',
                english: 'Sunrise'
            },
            sofZmanShmaMGA: {
                time: sofZmanShmaMGA.toISOString(),
                formatted: formatTime(sofZmanShmaMGA),
                hebrew: 'סוף זמן ק"ש מג"א',
                english: 'Latest Shema (MGA)'
            },
            sofZmanShmaGRA: {
                time: sofZmanShmaGRA.toISOString(),
                formatted: formatTime(sofZmanShmaGRA),
                hebrew: 'סוף זמן ק"ש גר"א',
                english: 'Latest Shema (GRA)'
            },
            sofZmanTfillaMGA: {
                time: sofZmanTfillaMGA.toISOString(),
                formatted: formatTime(sofZmanTfillaMGA),
                hebrew: 'סוף זמן תפילה מג"א',
                english: 'Latest Tefilla (MGA)'
            },
            sofZmanTfillaGRA: {
                time: sofZmanTfillaGRA.toISOString(),
                formatted: formatTime(sofZmanTfillaGRA),
                hebrew: 'סוף זמן תפילה גר"א',
                english: 'Latest Tefilla (GRA)'
            },
            chatzot: {
                time: chatzot.toISOString(),
                formatted: formatTime(chatzot),
                hebrew: 'חצות היום',
                english: 'Midday'
            },
            minchaGedola: {
                time: minchaGedola.toISOString(),
                formatted: formatTime(minchaGedola),
                hebrew: 'מנחה גדולה',
                english: 'Earliest Mincha'
            },
            minchaKetana: {
                time: minchaKetana.toISOString(),
                formatted: formatTime(minchaKetana),
                hebrew: 'מנחה קטנה',
                english: 'Mincha Ketana'
            },
            plagHaMincha: {
                time: plagHaMincha.toISOString(),
                formatted: formatTime(plagHaMincha),
                hebrew: 'פלג המנחה',
                english: 'Plag HaMincha'
            },
            sunset: {
                time: sunset.toISOString(),
                formatted: formatTime(sunset),
                hebrew: 'שקיעה',
                english: 'Sunset'
            },
            tzeit: {
                time: tzeit.toISOString(),
                formatted: formatTime(tzeit),
                hebrew: 'צאת הכוכבים',
                english: 'Nightfall'
            }
        };
        
        // Add Shabbat times if Friday or Saturday
        if (dayOfWeek === 5) {
            // Friday - show candle lighting and צאת שבת for tomorrow
            const candleLighting = calculateCandleLighting(sunset, inJerusalem);
            zmanim.candleLighting = {
                time: candleLighting.toISOString(),
                formatted: formatTime(candleLighting),
                hebrew: inJerusalem ? 'הדלקת נרות (40 דק\')' : 'הדלקת נרות',
                english: 'Candle Lighting'
            };
            
            // Estimate Saturday's sunset (approximately same time)
            const saturdaySunset = new Date(sunset);
            saturdaySunset.setDate(saturdaySunset.getDate() + 1);
            
            const tzeitShabbat = calculateTzeitShabbat(saturdaySunset);
            zmanim.havdalah = {
                time: tzeitShabbat.toISOString(),
                formatted: formatTime(tzeitShabbat),
                hebrew: 'צאת השבת',
                english: 'Shabbat Ends'
            };
            
            // Calculate Saturday's ר"ת
            const saturdaySunrise = new Date(sunrise);
            saturdaySunrise.setDate(saturdaySunrise.getDate() + 1);
            const saturdayTzeitRT = calculateTzeitRT(saturdaySunrise, saturdaySunset);
            zmanim.havdalahRT = {
                time: saturdayTzeitRT.toISOString(),
                formatted: formatTime(saturdayTzeitRT),
                hebrew: 'צאת שבת ר"ת',
                english: 'Shabbat Ends (RT)'
            };
        }
        
        // Saturday - show צאת שבת
        if (dayOfWeek === 6) {
            const tzeitShabbat = calculateTzeitShabbat(sunset);
            zmanim.havdalah = {
                time: tzeitShabbat.toISOString(),
                formatted: formatTime(tzeitShabbat),
                hebrew: 'צאת השבת',
                english: 'Shabbat Ends'
            };
            
            zmanim.havdalahRT = {
                time: tzeitRT.toISOString(),
                formatted: formatTime(tzeitRT),
                hebrew: 'צאת שבת ר"ת',
                english: 'Shabbat Ends (RT)'
            };
        }
        
        return zmanim;
        
    } catch (error) {
        console.error('Hebcal API fetch error:', error);
        throw new Error('שגיאה בטעינת זמני התפילה. אנא נסה שוב.');
    }
}

/**
 * Get ordered list of zmanim for display
 * @param {Object} zmanim - Zmanim object from fetchZmanim
 * @returns {Array} Array of zman objects with key property
 */
function getZmanimList(zmanim) {
    const keys = [
        'dawn',
        'tallitTefillin',
        'sunrise', 
        'sofZmanShmaMGA', 
        'sofZmanShmaGRA', 
        'sofZmanTfillaMGA', 
        'sofZmanTfillaGRA',
        'chatzot', 
        'minchaGedola', 
        'minchaKetana',
        'plagHaMincha',
        'candleLighting',
        'sunset', 
        'tzeit',
        'havdalah',
        'havdalahRT'
    ];
    
    return keys
        .filter(key => zmanim[key])
        .map(key => ({
            key,
            ...zmanim[key]
        }));
}

// Export functions for use in other modules
export { fetchZmanim, formatTime, getZmanimList };
