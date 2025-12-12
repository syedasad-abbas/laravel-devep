(() => {
    if (typeof window !== 'undefined' && window.__CALL_CONSOLE_LOADED) {
        return;
    }
    if (typeof window !== 'undefined') {
        window.__CALL_CONSOLE_LOADED = true;
    }

    const dialToneFrequencies = {
        '1': 697,
        '2': 770,
        '3': 852,
        '4': 941,
        '5': 1040,
        '6': 1209,
        '7': 1336,
        '8': 1477,
        '9': 1633,
        '0': 700,
        '*': 650,
        '#': 880,
    };

    const initCallApp = () => {
    const appRoot = document.getElementById('call-app');
    if (!appRoot) {
        return;
    }

    const els = {
        dialInput: document.getElementById('dialInput'),
        audioCallBtn: document.getElementById('audioCallBtn'),
        videoCallBtn: document.getElementById('videoCallBtn'),
        clearDialBtn: document.getElementById('clearDialBtn'),
        callStatusDot: document.getElementById('callStatusDot'),
        callStatusText: document.getElementById('callStatusText'),
        callMetaText: document.getElementById('callMetaText'),
        statusPill: document.getElementById('statusPill'),
        callLog: document.getElementById('callLog'),
        callHistory: document.getElementById('callHistory'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        userPresenceIndicator: document.getElementById('userPresenceIndicator'),
        userPresenceText: document.getElementById('userPresenceText'),
        logoutForm: document.getElementById('logoutForm'),
    };
    const dialpadKeys = Array.from(appRoot.querySelectorAll('.dialpad-key'));

    const THEME_KEY = 'call-console-theme';
    const CALL_HISTORY_KEY = 'call-history';
    const MAX_CALL_HISTORY = 12;
    const callLaunchUrl = (appRoot.dataset.callLaunchUrl || '').trim();
    const fallbackLaunchUrl = (appRoot.dataset.fallbackLaunchUrl || '').trim();
    let callHistory = [];
    let toneContext;

    const getLaunchBaseUrl = () => callLaunchUrl || fallbackLaunchUrl || window.location.origin;

    const buildCallWindowUrl = (target, mode = 'audio') => {
        const base = getLaunchBaseUrl();
        try {
            const url = new URL(base, window.location.origin);
            if (target) {
                url.searchParams.set('dial', target);
            } else {
                url.searchParams.delete('dial');
            }
            url.searchParams.set('call_type', mode);
            url.searchParams.set('ts', Date.now().toString());
            return url.toString();
        } catch (_) {
            if (target) {
                const separator = base.includes('?') ? '&' : '?';
                return `${base}${separator}dial=${encodeURIComponent(target)}&call_type=${mode}&ts=${Date.now()}`;
            }
            return base;
        }
    };

    const updateCallStatus = (text, meta = '', variant = 'idle') => {
        if (els.callStatusText) {
            els.callStatusText.textContent = text;
        }
        if (els.callMetaText) {
            els.callMetaText.textContent = meta;
        }
        if (els.statusPill) {
            els.statusPill.textContent = text.toUpperCase();
            els.statusPill.className = `status-pill status-pill--${variant}`;
        }
        if (els.callStatusDot) {
            els.callStatusDot.classList.remove('status-dot--idle', 'status-dot--online', 'status-dot--live');
            const dotClass =
                variant === 'active'
                    ? 'status-dot--live'
                    : variant === 'pending'
                        ? 'status-dot--online'
                        : 'status-dot--idle';
            els.callStatusDot.classList.add(dotClass);
        }
    };

    const logEvent = (message) => {
        if (!els.callLog) {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('p');
        line.innerHTML = `<strong>${timestamp}</strong> — ${message}`;
        els.callLog.prepend(line);
        const entries = els.callLog.querySelectorAll('p');
        if (entries.length > 20) {
            entries[entries.length - 1].remove();
        }
    };

    const loadCallHistory = () => {
        try {
            const raw = localStorage.getItem(CALL_HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    };

    const saveCallHistory = () => {
        try {
            localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(callHistory));
        } catch (_) {
            // ignore write errors
        }
    };

    const renderCallHistory = () => {
        if (!els.callHistory) {
            return;
        }
        if (!callHistory.length) {
            els.callHistory.innerHTML = '<div class="call-history__empty">No call logs yet.</div>';
            return;
        }
        els.callHistory.innerHTML = callHistory
            .map(
                (entry) => `
                    <div class="call-history__entry">
                        <strong>${entry.label}</strong>
                        <small>${entry.timestamp} · ${entry.details || ''}</small>
                    </div>`
            )
            .join('');
    };

    const addCallHistoryEntry = (entry) => {
        const payload = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: new Date().toLocaleString(),
            ...entry,
        };
        callHistory = [payload, ...callHistory].slice(0, MAX_CALL_HISTORY);
        saveCallHistory();
        renderCallHistory();
    };

    const clearCallHistory = () => {
        callHistory = [];
        saveCallHistory();
        renderCallHistory();
    };

    const ensureToneContext = () => {
        if (!toneContext) {
            const AudioContextRef = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextRef) {
                return null;
            }
            toneContext = new AudioContextRef();
        }
        return toneContext;
    };

    const playDialTone = (value) => {
        const freq = dialToneFrequencies[value];
        if (!freq) {
            return;
        }
        const ctx = ensureToneContext();
        if (!ctx) {
            return;
        }
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gainNode.gain.value = 0.12;

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.18);
    };

    const appendDialDigit = (value) => {
        if (!value || !els.dialInput) {
            return;
        }
        els.dialInput.value = (els.dialInput.value || '') + value;
        playDialTone(value);
    };

    const startCall = (mode = 'audio') => {
        const target = (els.dialInput?.value || '').trim();
        if (!target) {
            updateCallStatus('Dial target required', 'Enter the number you want to call');
            logEvent('Dial attempt blocked: missing target');
            return;
        }

        const launchUrl = buildCallWindowUrl(target, mode);
        const callWindow = window.open(launchUrl, '_blank', 'noopener,noreferrer');
        if (!callWindow) {
            updateCallStatus('Popup blocked', 'Allow popups for this site to start calls');
            logEvent('Popup blocked by browser');
            return;
        }

        const modeLabel = mode === 'video' ? 'Video call' : 'Audio call';
        updateCallStatus(`${modeLabel} launching`, `Dialing ${target}`, 'pending');
        logEvent(`${modeLabel} window opened for ${target}`);
        addCallHistoryEntry({ label: modeLabel, details: `Dial ${target}` });
    };

    const clearDialInput = () => {
        if (els.dialInput) {
            els.dialInput.value = '';
        }
        updateCallStatus('Idle', 'Ready for next dial');
    };

    const applyTheme = (theme) => {
        if (!document.body) {
            return;
        }
        const normalized = theme === 'light' ? 'light' : 'dark';
        document.documentElement.dataset.theme = normalized;
        document.body.dataset.theme = normalized;
        try {
            localStorage.setItem(THEME_KEY, normalized);
        } catch (_) {
            // ignore
        }
        if (els.themeToggleBtn) {
            const label = els.themeToggleBtn.querySelector('.label');
            if (label) {
                label.textContent = normalized === 'light' ? 'Light mode' : 'Dark mode';
            }
        }
    };

    const initTheme = () => {
        let stored = null;
        try {
            stored = localStorage.getItem(THEME_KEY);
        } catch (_) {
            stored = null;
        }
        if (!stored) {
            stored = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        applyTheme(stored);
    };

    const toggleTheme = () => {
        const nextTheme = document.body?.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
    };

    const setUserPresence = (state = 'online') => {
        if (!els.userPresenceIndicator || !els.userPresenceText) {
            return;
        }
        const variants = {
            online: { className: 'status-dot--online', label: 'Online' },
            away: { className: 'status-dot--idle', label: 'Away' },
            offline: { className: 'status-dot--offline', label: 'Offline' },
        };
        const next = variants[state] || variants.offline;
        els.userPresenceIndicator.classList.remove('status-dot--online', 'status-dot--idle', 'status-dot--offline');
        els.userPresenceIndicator.classList.add(next.className);
        els.userPresenceIndicator.setAttribute('aria-label', next.label);
        els.userPresenceText.textContent = next.label;
    };

    els.audioCallBtn?.addEventListener('click', () => startCall('audio'));
    els.videoCallBtn?.addEventListener('click', () => startCall('video'));
    els.clearDialBtn?.addEventListener('click', clearDialInput);
    els.clearHistoryBtn?.addEventListener('click', clearCallHistory);
    els.themeToggleBtn?.addEventListener('click', toggleTheme);
    dialpadKeys.forEach((key) => {
        key.addEventListener('click', () => {
            appendDialDigit(key.dataset.digit || '');
        });
    });

    callHistory = loadCallHistory();
    renderCallHistory();
    initTheme();
    setUserPresence('online');
    updateCallStatus('Idle', 'Ready for next dial');

    document.addEventListener('visibilitychange', () => {
        setUserPresence(document.hidden ? 'away' : 'online');
    });

    window.addEventListener('beforeunload', () => {
        setUserPresence('offline');
    });

    els.logoutForm?.addEventListener('submit', () => {
        setUserPresence('offline');
    });

    addCallHistoryEntry({
        label: 'Console ready',
        details: 'Dashboard booted',
    });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCallApp);
    } else {
        initCallApp();
    }
})();
