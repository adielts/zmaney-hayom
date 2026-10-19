/**
 * Next zman reminder - Zmaney HaYom
 * A bell on the next zman box opens a small menu to pick when to be reminded.
 * One reminder, for that zman only - it fires once and is then cleared.
 *
 * The web can't schedule a notification for later, so the reminder fires
 * from the app's one-second tick, i.e. while the app is open.
 */

const STORAGE_KEY = 'zmaneyHayom_reminder';

// Not released yet - change to true to show the reminder bell to users
export const REMINDERS_ENABLED = false;

const OPTIONS = [
    { offset: 5, label: '5 דקות לפני' },
    { offset: 2, label: '2 דקות לפני' },
    { offset: 1, label: 'דקה לפני' },
    { offset: 0, label: 'בזמן עצמו' }
];

// How late a reminder may still fire (e.g. the app was reopened right after it was due)
const GRACE_MS = 2 * 60 * 1000;

let els = {};
let nextZman = null;

// ============================================
// Stored reminder: { key, time, name, formatted, offset }
// ============================================

function loadReminder() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
        return null;
    }
}

function saveReminder(reminder) {
    try {
        if (reminder) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(reminder));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (error) {
        console.warn('Failed to save the reminder:', error);
    }
}

function isFor(reminder, zman) {
    return Boolean(reminder && zman && reminder.key === zman.key && reminder.time === zman.time);
}

// ============================================
// Notifications permission
// ============================================

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

/**
 * @returns {'granted'|'default'|'denied'|'needs-install'|'unsupported'}
 */
function getNotificationStatus() {
    // On iPhone notifications exist only for apps added to the Home Screen
    if (isIOS() && !isStandalone()) return 'needs-install';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

// ============================================
// Bell & menu
// ============================================

/**
 * Wire up the bell button and its menu
 */
export function initReminderBell() {
    if (!REMINDERS_ENABLED) return;

    els = {
        wrap: document.getElementById('reminder'),
        bell: document.getElementById('reminder-bell'),
        label: document.getElementById('reminder-label'),
        menu: document.getElementById('reminder-menu')
    };
    if (!els.bell) return;

    els.bell.addEventListener('click', (event) => {
        event.stopPropagation();
        els.menu.hidden ? openMenu() : closeMenu();
    });

    els.menu.addEventListener('click', (event) => {
        const item = event.target.closest('button[data-offset]');
        if (!item || item.disabled) return;
        choose(item.dataset.offset === 'off' ? null : Number(item.dataset.offset));
    });

    document.addEventListener('click', (event) => {
        if (!els.menu.hidden && !els.wrap.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !els.menu.hidden) {
            closeMenu();
            els.bell.focus();
        }
    });
}

/**
 * Show the bell for the next zman (null hides it, e.g. while browsing another date)
 * @param {Object|null} zman - { key, time, hebrew, formatted }
 */
export function updateReminderBell(zman) {
    if (!els.bell) return;
    // The next zman moved on while the menu was open - its options are no longer valid
    if (zman?.key !== nextZman?.key) closeMenu();
    nextZman = zman;
    els.wrap.hidden = !zman;
    if (!zman) return;

    const reminder = loadReminder();
    const active = isFor(reminder, zman);
    const label = active ? OPTIONS.find(option => option.offset === reminder.offset)?.label : '';

    els.bell.classList.toggle('active', active);
    els.bell.setAttribute('aria-label', active ? `תזכורת: ${label}` : 'הזכר לי');
    els.label.textContent = label || '';
    els.label.hidden = !active;
}

function openMenu() {
    if (!nextZman) return;

    const reminder = loadReminder();
    const msLeft = new Date(nextZman.time).getTime() - Date.now();

    const items = OPTIONS.map(({ offset, label }) => {
        const checked = isFor(reminder, nextZman) && reminder.offset === offset;
        // A moment that already passed can't be chosen
        const passed = offset > 0 && msLeft <= offset * 60 * 1000;
        return `<button type="button" role="menuitemradio" data-offset="${offset}"
            aria-checked="${checked}" ${passed ? 'disabled' : ''}>${label}</button>`;
    });

    if (isFor(reminder, nextZman)) {
        items.push('<button type="button" role="menuitem" data-offset="off" class="reminder-menu-off">ביטול התזכורת</button>');
    }

    const note = statusNote();
    els.menu.innerHTML = items.join('') + (note ? `<p class="reminder-menu-note">${note}</p>` : '');
    els.menu.hidden = false;
    els.bell.setAttribute('aria-expanded', 'true');
    els.menu.querySelector('button:not([disabled])')?.focus();
}

function closeMenu() {
    if (!els.menu || els.menu.hidden) return;
    els.menu.hidden = true;
    els.bell.setAttribute('aria-expanded', 'false');
}

function statusNote() {
    switch (getNotificationStatus()) {
        case 'needs-install':
            return 'באייפון, כדי לקבל התראה גם כשהאפליקציה ברקע - הוסיפו אותה למסך הבית.';
        case 'denied':
        case 'unsupported':
            return 'ההתראות חסומות - התזכורת תופיע רק כשהאפליקציה פתוחה.';
        default:
            return '';
    }
}

function choose(offset) {
    closeMenu();

    if (offset === null || !nextZman) {
        saveReminder(null);
    } else {
        saveReminder({
            key: nextZman.key,
            time: nextZman.time,
            name: nextZman.hebrew,
            formatted: nextZman.formatted,
            offset
        });
        // Still inside the tap, so the browser may show its permission prompt
        if (getNotificationStatus() === 'default') {
            Promise.resolve(Notification.requestPermission()).catch(() => {});
        }
    }

    updateReminderBell(nextZman);
    els.bell.focus();
}

// ============================================
// Firing
// ============================================

/**
 * Fire the reminder when its moment comes - called every second
 */
export function checkReminder() {
    if (!REMINDERS_ENABLED) return;

    const reminder = loadReminder();
    if (!reminder) return;

    const now = Date.now();
    const zmanMs = new Date(reminder.time).getTime();

    if (now >= zmanMs + GRACE_MS) {
        // Missed (the app was closed) - drop it quietly
        saveReminder(null);
        updateReminderBell(nextZman);
        return;
    }

    if (now < zmanMs - reminder.offset * 60 * 1000) return;

    saveReminder(null);
    updateReminderBell(nextZman);

    const minutesLeft = Math.ceil((zmanMs - now) / 60000);
    const body = minutesLeft > 0
        ? `${minutesLeft === 1 ? 'בעוד דקה' : `בעוד ${minutesLeft} דקות`} · ${reminder.formatted}`
        : `הגיע הזמן · ${reminder.formatted}`;

    notify(reminder.name, body);
}

function notify(title, body) {
    const appInFront = document.visibilityState === 'visible' && document.hasFocus();

    if (!appInFront && getNotificationStatus() === 'granted') {
        showSystemNotification(`🔔 ${title}`, body);
    } else {
        showBanner(title, body);
    }
}

async function showSystemNotification(title, body) {
    const options = { body, lang: 'he', dir: 'rtl', icon: 'icons/icon-192.svg', tag: 'zman-reminder' };
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) {
            await registration.showNotification(title, options);
        } else {
            new Notification(title, options);
        }
    } catch (error) {
        console.warn('System notification failed:', error);
        showBanner(title, body);
    }
}

let bannerTimer = null;

function showBanner(title, body) {
    let banner = document.getElementById('reminder-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'reminder-banner';
        banner.className = 'reminder-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML = '<span aria-hidden="true">🔔</span><span><strong></strong><span></span></span>';
        banner.addEventListener('click', () => banner.classList.remove('visible'));
        document.body.appendChild(banner);
    }

    banner.querySelector('strong').textContent = title;
    banner.querySelector('strong + span').textContent = body;
    banner.classList.add('visible');

    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('visible'), 10000);
}
