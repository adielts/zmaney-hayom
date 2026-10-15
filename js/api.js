/**
 * Zmanim API Service
 * Fetches Jewish prayer times from the Hebcal API
 * Calculations according to לוח אור החיים using seasonal minutes (דקות זמניות)
 */

const HEBCAL_API_BASE = 'https://www.hebcal.com/zmanim';
const HEBCAL_SHABBAT_API = 'https://www.hebcal.com/shabbat';

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
 * 1.25 seasonal hours before צאת הכוכבים
 * @param {Date} sunrise - Sunrise time
 * @param {Date} sunset - Sunset time
 * @returns {Date} Plag HaMincha time
 */
function calculatePlagHaMincha(sunrise, sunset) {
    const dayLengthMs = sunset.getTime() - sunrise.getTime();
    const seasonalMinute = dayLengthMs / 720;
    const seasonalHour = dayLengthMs / 12;
    // צאת הכוכבים = sunset + 13.5 seasonal minutes
    const tzeit = new Date(sunset.getTime() + (13.5 * seasonalMinute));
    // פלג המנחה = 1.25 seasonal hours before צאת הכוכבים
    return new Date(tzeit.getTime() - (1.25 * seasonalHour));
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
 * Get sunrise/sunset adjustments for אור החיים methodology
 * אור החיים uses:
 * - הנץ הנראה (visible sunrise) from לוח בכורי יוסף
 * - שקיעה from the highest point in the city
 * 
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Object} Adjustments in minutes
 */
function getOhrHachaimAdjustments(latitude, longitude) {
    // Jerusalem area - largest adjustments
    if (latitude >= 31.7 && latitude <= 31.85 && longitude >= 35.1 && longitude <= 35.25) {
        return {
            sunriseAdjust: -1.5,  // API sunrise is ~1.5 min later than אור החיים
            sunsetAdjust: 4       // API sunset is ~4 min earlier than אור החיים
        };
    }
    
    // Tel Aviv area
    if (latitude >= 32.0 && latitude <= 32.15 && longitude >= 34.7 && longitude <= 34.85) {
        return {
            sunriseAdjust: -2,
            sunsetAdjust: 3
        };
    }
    
    // Haifa area
    if (latitude >= 32.75 && latitude <= 32.85 && longitude >= 34.95 && longitude <= 35.05) {
        return {
            sunriseAdjust: -1.5,
            sunsetAdjust: 3
        };
    }
    
    // Default - no adjustment
    return {
        sunriseAdjust: 0,
        sunsetAdjust: 0
    };
}

/**
 * Format a Date as YYYY-MM-DD (local time)
 * @param {Date} date
 * @returns {string}
 */
function formatDateParam(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Fetch sunrise/sunset for a given day, adjusted to אור החיים methodology
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} timezone - IANA timezone identifier
 * @param {Date} date - Day to fetch
 * @returns {Promise<{sunrise: Date, sunset: Date}>}
 */
async function fetchSunTimes(latitude, longitude, timezone, date) {
    const url = new URL(HEBCAL_API_BASE);
    url.searchParams.set('cfg', 'json');
    url.searchParams.set('latitude', latitude);
    url.searchParams.set('longitude', longitude);
    url.searchParams.set('tzid', timezone);
    url.searchParams.set('date', formatDateParam(date));

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`Hebcal API error: ${response.status}`);
    }

    const data = await response.json();
    const times = data.times;

    // Get אור החיים adjustments for this location
    const adjustments = getOhrHachaimAdjustments(latitude, longitude);

    return {
        sunrise: new Date(new Date(times.sunrise).getTime() + (adjustments.sunriseAdjust * 60 * 1000)),
        sunset: new Date(new Date(times.sunset).getTime() + (adjustments.sunsetAdjust * 60 * 1000))
    };
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
    
    try {
        const { sunrise, sunset } = await fetchSunTimes(latitude, longitude, timezone, targetDate);
        
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
        
        return zmanim;
        
    } catch (error) {
        console.error('Hebcal API fetch error:', error);
        throw new Error('שגיאה בטעינת זמני התפילה. אנא נסה שוב.');
    }
}

/**
 * Get the Friday/Saturday of the relevant Shabbat for a given date
 * On Saturday the current Shabbat is returned, otherwise the upcoming one
 * @param {Date} fromDate - Reference date
 * @returns {{friday: Date, saturday: Date}}
 */
function getShabbatDates(fromDate) {
    const friday = new Date(fromDate.getTime());
    friday.setHours(12, 0, 0, 0);
    
    const dayOfWeek = friday.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    friday.setDate(friday.getDate() + (dayOfWeek === 6 ? -1 : 5 - dayOfWeek));
    
    const saturday = new Date(friday.getTime());
    saturday.setDate(saturday.getDate() + 1);
    
    return { friday, saturday };
}

/**
 * Fetch the parasha / holiday information for a specific Shabbat
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} timezone - IANA timezone identifier
 * @param {Date} saturday - The Shabbat day
 * @returns {Promise<{title: string, titleEnglish: string, tags: string[]}>}
 */
async function fetchShabbatInfo(latitude, longitude, timezone, saturday) {
    const url = new URL(HEBCAL_SHABBAT_API);
    url.searchParams.set('cfg', 'json');
    url.searchParams.set('latitude', latitude);
    url.searchParams.set('longitude', longitude);
    url.searchParams.set('tzid', timezone);
    url.searchParams.set('geo', 'pos');
    url.searchParams.set('lg', 'h');
    url.searchParams.set('gy', saturday.getFullYear());
    url.searchParams.set('gm', saturday.getMonth() + 1);
    url.searchParams.set('gd', saturday.getDate());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
        throw new Error(`Hebcal Shabbat API error: ${response.status}`);
    }
    
    const data = await response.json();
    const items = data.items || [];
    const saturdayStr = formatDateParam(saturday);
    const onSaturday = (item) => typeof item.date === 'string' && item.date.startsWith(saturdayStr);
    
    // פרשת השבוע, or the Yom Tov name when the Shabbat is a festival
    const parasha = items.find(item => item.category === 'parashat' && onSaturday(item))
        || items.find(item => item.category === 'parashat');
    const yomTov = items.find(item => item.category === 'holiday' && item.subcat !== 'shabbat' && onSaturday(item));
    
    // Extra labels such as שבת זכור / מברכים חודש ניסן
    const tags = items
        .filter(item => onSaturday(item) && (
            (item.category === 'holiday' && item.subcat === 'shabbat') ||
            item.category === 'mevarchim'
        ))
        .map(item => item.hebrew)
        .filter(Boolean);
    
    return {
        title: parasha?.hebrew || yomTov?.hebrew || 'שבת קודש',
        titleEnglish: parasha?.title_orig || yomTov?.title_orig || 'Shabbat',
        tags
    };
}

/**
 * Build the Shabbat times for a specific Friday/Saturday pair
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} timezone - IANA timezone identifier
 * @param {{friday: Date, saturday: Date}} dates
 * @returns {Promise<Object>} Shabbat data object
 */
async function buildShabbatTimes(latitude, longitude, timezone, dates) {
    const [fridayTimes, saturdayTimes, info] = await Promise.all([
        fetchSunTimes(latitude, longitude, timezone, dates.friday),
        fetchSunTimes(latitude, longitude, timezone, dates.saturday),
        fetchShabbatInfo(latitude, longitude, timezone, dates.saturday)
    ]);
    
    const inJerusalem = isJerusalemArea(latitude, longitude);
    const candleLighting = calculateCandleLighting(fridayTimes.sunset, inJerusalem);
    const havdalah = calculateTzeitShabbat(saturdayTimes.sunset);
    const havdalahRT = calculateTzeitRT(saturdayTimes.sunrise, saturdayTimes.sunset);
    
    const toZman = (key, date, hebrew, english, note) => ({
        key,
        time: date.toISOString(),
        formatted: formatTime(date),
        hebrew,
        english,
        note
    });
    
    const times = [
        toZman('candleLighting', candleLighting, 'הדלקת נרות', 'Candle Lighting', `${inJerusalem ? 40 : 20} דק׳ לפני השקיעה`)
    ];
    
    // In Jerusalem the custom is 40 minutes - show the common 20 minutes as well
    if (inJerusalem) {
        const candleLighting20 = calculateCandleLighting(fridayTimes.sunset, false);
        times.push(toZman('candleLighting20', candleLighting20, 'הדלקת נרות', 'Candle Lighting', '20 דק׳ לפני השקיעה'));
    }
    
    times.push(
        toZman('havdalah', havdalah, 'צאת השבת', 'Shabbat Ends', '30 דק׳ אחרי השקיעה'),
        toZman('havdalahRT', havdalahRT, 'צאת שבת ר"ת', 'Shabbat Ends (RT)', '72 דק׳ זמניות')
    );
    
    return {
        parasha: info.title,
        parashaEnglish: info.titleEnglish,
        tags: info.tags,
        fridayDate: dates.friday.toISOString(),
        saturdayDate: dates.saturday.toISOString(),
        times
    };
}

/**
 * Fetch the times of the upcoming (or current) Shabbat, including פרשת השבוע
 * Times are calculated according to אור החיים, like the rest of the app
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @param {string} timezone - IANA timezone identifier
 * @param {Date} baseDate - Optional reference date (default: current date)
 * @returns {Promise<Object>} Shabbat data object
 */
async function fetchShabbatTimes(latitude, longitude, timezone, baseDate = null) {
    try {
        const dates = getShabbatDates(baseDate || new Date());
        let shabbat = await buildShabbatTimes(latitude, longitude, timezone, dates);
        
        // On Saturday night the Shabbat is over - move on to the next one
        const havdalah = shabbat.times.find(zman => zman.key === 'havdalah');
        if (!baseDate && havdalah && new Date(havdalah.time) < new Date()) {
            dates.friday.setDate(dates.friday.getDate() + 7);
            dates.saturday.setDate(dates.saturday.getDate() + 7);
            shabbat = await buildShabbatTimes(latitude, longitude, timezone, dates);
        }
        
        return shabbat;
        
    } catch (error) {
        console.error('Hebcal Shabbat fetch error:', error);
        throw new Error('שגיאה בטעינת זמני השבת. אנא נסה שוב.');
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
        'sunset', 
        'tzeit'
    ];
    
    return keys
        .filter(key => zmanim[key])
        .map(key => ({
            key,
            ...zmanim[key]
        }));
}

// Export functions for use in other modules
export { fetchZmanim, fetchShabbatTimes, formatTime, getZmanimList };
