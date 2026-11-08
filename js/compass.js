/**
 * Tfila Compass - points toward the place of the Mikdash
 * (Shulchan Aruch OC 94: outside Israel toward Eretz Yisrael, in Israel
 * toward Jerusalem, in Jerusalem toward the Kodesh HaKodashim)
 */

import { isJerusalemArea } from './api.js';

// Even HaShtiya / Kodesh HaKodashim
const TARGET = { latitude: 31.7780, longitude: 35.2354 };
const NEAR_KOTEL_KM = 0.5;
const ALIGN_TOLERANCE_DEG = 5;
const NO_SENSOR_TIMEOUT_MS = 1500;
const SMOOTHING = 0.2;
const METHOD_STORAGE_KEY = 'zmaneyHayom_compassMethod';
const DIRECTIONS = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];

const DIAL_SIZE = 300;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 132;

const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;
const norm360 = (deg) => ((deg % 360) + 360) % 360;
const norm180 = (deg) => {
    const n = norm360(deg);
    return n > 180 ? n - 360 : n;
};
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Initial bearing along the great circle (shortest path on the globe)
 */
export function greatCircleBearing(from, to) {
    const φ1 = toRad(from.latitude);
    const φ2 = toRad(to.latitude);
    const Δλ = toRad(to.longitude - from.longitude);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return norm360(toDeg(Math.atan2(y, x)));
}

/**
 * Constant bearing along the rhumb line (the "Mizrach" custom)
 */
export function rhumbBearing(from, to) {
    const φ1 = toRad(from.latitude);
    const φ2 = toRad(to.latitude);
    let Δλ = toRad(to.longitude - from.longitude);
    if (Math.abs(Δλ) > Math.PI) Δλ = Δλ > 0 ? Δλ - 2 * Math.PI : Δλ + 2 * Math.PI;
    const Δψ = Math.log(Math.tan(Math.PI / 4 + φ2 / 2) / Math.tan(Math.PI / 4 + φ1 / 2));
    return norm360(toDeg(Math.atan2(Δλ, Δψ)));
}

/**
 * Haversine distance in kilometers
 */
export function distanceKm(from, to) {
    const φ1 = toRad(from.latitude);
    const φ2 = toRad(to.latitude);
    const Δφ = φ2 - φ1;
    const Δλ = toRad(to.longitude - from.longitude);
    const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Rough bounding box - inside it both bearing methods agree to a fraction of a degree
function isInIsrael(latitude, longitude) {
    return latitude >= 29.45 && latitude <= 33.35 && longitude >= 34.2 && longitude <= 35.9;
}

function directionName(bearing) {
    return DIRECTIONS[Math.round(norm360(bearing) / 45) % 8];
}

function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} מ׳`;
    if (km < 10) return `${km.toFixed(1)} ק״מ`;
    return `${Math.round(km).toLocaleString('he-IL')} ק״מ`;
}

function getMethod() {
    try {
        return localStorage.getItem(METHOD_STORAGE_KEY) === 'rhumb' ? 'rhumb' : 'greatCircle';
    } catch (error) {
        return 'greatCircle';
    }
}

function setMethod(method) {
    try {
        localStorage.setItem(METHOD_STORAGE_KEY, method);
    } catch (error) {
        console.warn('Failed to save compass method:', error);
    }
}

/**
 * Stylised Western Wall - rows of offset ashlar stones
 */
function kotelSvg(x, y, width) {
    const height = width * 0.7;
    const rows = 3;
    const rowHeight = height / rows;
    let svg = `<g class="kotel" transform="translate(${round1(x - width / 2)},${round1(y - height / 2)})">`;
    svg += `<rect width="${width}" height="${round1(height)}" rx="2"></rect>`;
    for (let i = 1; i < rows; i++) {
        svg += `<line x1="0" y1="${round1(i * rowHeight)}" x2="${width}" y2="${round1(i * rowHeight)}"></line>`;
    }
    for (let i = 0; i < rows; i++) {
        const offset = i % 2 ? width / 4 : width / 2;
        for (let bx = offset; bx < width; bx += width / 2) {
            svg += `<line x1="${round1(bx)}" y1="${round1(i * rowHeight)}" x2="${round1(bx)}" y2="${round1((i + 1) * rowHeight)}"></line>`;
        }
    }
    return svg + '</g>';
}

function polar(radius, angle) {
    return {
        x: round1(DIAL_CENTER + radius * Math.sin(toRad(angle))),
        y: round1(DIAL_CENTER - radius * Math.cos(toRad(angle)))
    };
}

function buildDialSvg(bearing) {
    const c = DIAL_CENTER;
    const R = DIAL_RADIUS;
    let ticks = '';
    for (let a = 0; a < 360; a += 5) {
        const major = a % 30 === 0;
        const p1 = polar(R - 6, a);
        const p2 = polar(R - (major ? 20 : 12), a);
        ticks += `<line class="${major ? 'dial-tick-major' : 'dial-tick'}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"></line>`;
    }

    const labels = [['צפון', 0], ['מזרח', 90], ['דרום', 180], ['מערב', 270]].map(([text, angle]) => {
        const p = polar(R - 38, angle);
        return `<g class="dial-label${angle === 0 ? ' dial-label-north' : ''}" data-x="${p.x}" data-y="${p.y}">
            <text x="${p.x}" y="${p.y}" dy="0.35em" text-anchor="middle">${text}</text></g>`;
    }).join('');

    const needleEnd = polar(R - 82, bearing);
    const marker = polar(R - 60, bearing);

    return `<svg viewBox="0 0 ${DIAL_SIZE} ${DIAL_SIZE}" role="img" aria-label="מצפן כיוון תפילה">
        <circle class="dial-face" cx="${c}" cy="${c}" r="${R}"></circle>
        <circle class="dial-inner" cx="${c}" cy="${c}" r="${R - 26}"></circle>
        <g class="dial-rotor">
            ${ticks}${labels}
            <line class="dial-needle" x1="${c}" y1="${c}" x2="${needleEnd.x}" y2="${needleEnd.y}"></line>
            <g class="dial-target" data-x="${marker.x}" data-y="${marker.y}">${kotelSvg(marker.x, marker.y, 36)}</g>
        </g>
        <circle class="dial-hub" cx="${c}" cy="${c}" r="8"></circle>
        <path class="dial-lubber" d="M${c - 10} 2 L${c + 10} 2 L${c} 20 Z"></path>
    </svg>`;
}

// ============================================
// State
// ============================================
let elements = {};
let currentLocation = null;
let isOpen = false;
let bearing = null;
let sensorMode = 'pending'; // 'pending' | 'live' | 'none'
let iosPermission = null;   // null | 'granted' | 'denied' | 'skipped'
let listeningEvent = null;
let sensorTimer = null;
let frameRequest = null;
let headingX = null;
let headingY = null;
let wasAligned = false;
let lastHint = '';
let lastStatus = '';
let alignedText = '';
let dialParts = null;

const needsIosPermission = () =>
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

function screenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    return typeof window.orientation === 'number' ? window.orientation : 0;
}

function handleOrientation(event) {
    let raw;
    if (typeof event.webkitCompassHeading === 'number') {
        raw = event.webkitCompassHeading;
    } else if (event.absolute && typeof event.alpha === 'number') {
        raw = 360 - event.alpha;
    } else {
        // A relative alpha has no link to north
        return;
    }

    const heading = toRad(norm360(raw + screenAngle()));
    if (headingX === null) {
        headingX = Math.cos(heading);
        headingY = Math.sin(heading);
    } else {
        // Smooth on the unit circle so 359° -> 1° does not spin the dial
        headingX += (Math.cos(heading) - headingX) * SMOOTHING;
        headingY += (Math.sin(heading) - headingY) * SMOOTHING;
    }

    if (sensorMode !== 'live') {
        sensorMode = 'live';
        clearTimeout(sensorTimer);
    }
    scheduleDraw();
}

function startSensor() {
    if (listeningEvent) return;

    listeningEvent = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(listeningEvent, handleOrientation);

    sensorTimer = setTimeout(() => {
        if (sensorMode !== 'live') {
            sensorMode = 'none';
            scheduleDraw();
        }
    }, NO_SENSOR_TIMEOUT_MS);
}

function stopSensor() {
    if (listeningEvent) {
        window.removeEventListener(listeningEvent, handleOrientation);
        listeningEvent = null;
    }
    clearTimeout(sensorTimer);
    cancelAnimationFrame(frameRequest);
    frameRequest = null;
    sensorMode = 'pending';
    headingX = null;
    headingY = null;
    wasAligned = false;
}

function scheduleDraw() {
    if (frameRequest || !isOpen) return;
    frameRequest = requestAnimationFrame(() => {
        frameRequest = null;
        draw();
    });
}

// ============================================
// Rendering
// ============================================
function showSection(name) {
    elements.permission.hidden = name !== 'permission';
    elements.near.hidden = name !== 'near';
    elements.main.hidden = name !== 'main';
}

function getSubtitle(inJerusalem, inIsrael) {
    if (inJerusalem) return 'בירושלים – לעבר הכותל המערבי והר הבית';
    if (inIsrael) return 'לעבר ירושלים והר הבית';
    return 'לעבר ארץ ישראל וירושלים';
}

function render() {
    if (!currentLocation) {
        elements.subtitle.textContent = 'מאתר מיקום...';
        elements.place.textContent = '—';
        elements.distance.textContent = '—';
        showSection('none');
        stopSensor();
        return;
    }

    const { latitude, longitude } = currentLocation;
    const inJerusalem = isJerusalemArea(latitude, longitude);
    const inIsrael = isInIsrael(latitude, longitude);
    const km = distanceKm(currentLocation, TARGET);

    elements.subtitle.textContent = km < NEAR_KOTEL_KM ? 'אתה ליד הכותל המערבי' : getSubtitle(inJerusalem, inIsrael);
    elements.place.textContent = currentLocation.cityName || currentLocation.name || '';
    elements.distance.textContent = formatDistance(km);
    alignedText = inJerusalem ? 'אתה מכוון להר הבית' : 'אתה מכוון לירושלים';

    if (km < NEAR_KOTEL_KM) {
        stopSensor();
        showSection('near');
        return;
    }

    const method = inIsrael ? 'greatCircle' : getMethod();
    bearing = method === 'rhumb' ? rhumbBearing(currentLocation, TARGET) : greatCircleBearing(currentLocation, TARGET);

    elements.method.hidden = inIsrael;
    elements.methodButtons.forEach((btn) => {
        const active = btn.dataset.method === method;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    elements.dial.innerHTML = buildDialSvg(bearing);
    dialParts = {
        root: elements.dial,
        rotor: elements.dial.querySelector('.dial-rotor'),
        counterRotated: [...elements.dial.querySelectorAll('.dial-label, .dial-target')]
    };
    elements.deg.textContent = `${Math.round(bearing)}°`;
    elements.dir.textContent = directionName(bearing);
    lastHint = '';
    lastStatus = '';

    if (needsIosPermission() && iosPermission === null) {
        showSection('permission');
        return;
    }

    showSection('main');
    if (iosPermission === 'denied' || iosPermission === 'skipped') {
        sensorMode = 'none';
    } else {
        startSensor();
    }
    draw();
}

function draw() {
    if (!dialParts || bearing === null) return;

    const live = sensorMode === 'live';
    const heading = live ? norm360(toDeg(Math.atan2(headingY, headingX))) : 0;

    dialParts.rotor.setAttribute('transform', `rotate(${round1(-heading)} ${DIAL_CENTER} ${DIAL_CENTER})`);
    dialParts.counterRotated.forEach((el) => {
        el.setAttribute('transform', `rotate(${round1(heading)} ${el.dataset.x} ${el.dataset.y})`);
    });
    dialParts.root.classList.toggle('north-up', !live);

    let hint;
    let status;
    let aligned = false;

    if (live) {
        const delta = norm180(bearing - heading);
        aligned = Math.abs(delta) <= ALIGN_TOLERANCE_DEG;
        if (aligned) {
            hint = `✓ ${alignedText}`;
            status = alignedText;
        } else {
            const turn = delta > 0 ? 'ימינה' : 'שמאלה';
            hint = `${delta > 0 ? '↻' : '↺'} סובב ${turn} ${Math.round(Math.abs(delta))}°`;
            status = `סובב ${turn}`;
        }
    } else if (sensorMode === 'none') {
        hint = 'אין מצפן במכשיר – הכיוון ביחס לצפון';
        status = hint;
    } else {
        hint = 'מכייל מצפן...';
        status = '';
    }

    dialParts.root.classList.toggle('aligned', aligned);
    elements.hint.classList.toggle('aligned', aligned);

    if (hint !== lastHint) {
        elements.hint.textContent = hint;
        lastHint = hint;
    }
    // Screen readers only hear state changes, not every degree
    if (status !== lastStatus) {
        elements.status.textContent = status;
        lastStatus = status;
    }

    if (aligned && !wasAligned && navigator.vibrate) {
        navigator.vibrate(60);
    }
    wasAligned = aligned;
}

// ============================================
// Modal
// ============================================
function openCompass() {
    isOpen = true;
    elements.modal.classList.add('active');
    elements.overlay.classList.add('active');
    elements.fab.setAttribute('aria-expanded', 'true');
    render();
    elements.close.focus();
}

function closeCompass() {
    isOpen = false;
    elements.modal.classList.remove('active');
    elements.overlay.classList.remove('active');
    elements.fab.setAttribute('aria-expanded', 'false');
    stopSensor();
    elements.fab.focus();
}

async function requestIosPermission() {
    try {
        const state = await DeviceOrientationEvent.requestPermission();
        iosPermission = state === 'granted' ? 'granted' : 'denied';
    } catch (error) {
        console.warn('Compass permission failed:', error);
        iosPermission = 'denied';
    }
    if (isOpen) render();
}

/**
 * Wire up the compass button and bottom sheet
 */
export function initCompass() {
    elements = {
        fab: document.getElementById('compass-btn'),
        modal: document.getElementById('compass-modal'),
        overlay: document.getElementById('compass-overlay'),
        close: document.getElementById('compass-close'),
        subtitle: document.getElementById('compass-subtitle'),
        permission: document.getElementById('compass-permission'),
        permissionBtn: document.getElementById('compass-permission-btn'),
        skipBtn: document.getElementById('compass-skip-btn'),
        near: document.getElementById('compass-near'),
        nearArt: document.getElementById('compass-near-art'),
        main: document.getElementById('compass-main'),
        method: document.getElementById('compass-method'),
        methodButtons: [...document.querySelectorAll('.compass-method-btn')],
        dial: document.getElementById('compass-dial'),
        deg: document.getElementById('compass-deg'),
        dir: document.getElementById('compass-dir'),
        hint: document.getElementById('compass-hint'),
        status: document.getElementById('compass-status'),
        place: document.getElementById('compass-place'),
        distance: document.getElementById('compass-distance')
    };

    if (!elements.fab || !elements.modal) return;

    elements.nearArt.innerHTML = `<svg viewBox="0 0 200 140" aria-hidden="true" focusable="false">${kotelSvg(100, 70, 180)}</svg>`;

    elements.fab.addEventListener('click', openCompass);
    elements.close.addEventListener('click', closeCompass);
    elements.overlay.addEventListener('click', closeCompass);
    elements.modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeCompass();
    });

    elements.permissionBtn.addEventListener('click', requestIosPermission);
    elements.skipBtn.addEventListener('click', () => {
        iosPermission = 'skipped';
        render();
    });

    elements.methodButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            setMethod(btn.dataset.method);
            render();
        });
    });

    window.addEventListener('orientationchange', scheduleDraw);
}

/**
 * Update the location the direction is calculated from
 * @param {{latitude: number, longitude: number, cityName?: string}} location
 */
export function setCompassLocation(location) {
    currentLocation = location;
    if (isOpen) render();
}
