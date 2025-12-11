<!DOCTYPE html>
<html lang="en" data-theme="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>WebRTC Command Console</title>
        <script>
            window.__SIP_CLIENT_CONFIG__ = @json($sipConfig ?? []);
        </script>
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body>
        <div
            id="call-app"
            data-sip-login-endpoint="{{ route('sip.login') }}"
            data-sbc-domain="{{ $sipDomain ?? '' }}"
            data-domain-reachable="{{ $sipDomainReachable ? '1' : '0' }}"
            data-domain-status="{{ $sipDomainStatus['code'] ?? 'unknown' }}"
            data-domain-message="{{ $sipDomainStatus['message'] ?? '' }}"
        >
            <div class="call-shell">
                <header class="meeting-header">
                    <div class="meeting-meta">
                        <div>
                            <h1>Secure WebRTC Console</h1>
                            <p class="user-presence">
                                <span class="status-dot status-dot--idle" id="userPresenceIndicator" aria-label="User offline"></span>
                                <span class="presence-text" id="userPresenceText">Offline</span>
                                <span class="presence-name">{{ $user->name ?: $user->email }}</span>
                            </p>
                        </div>
                        <div class="sip-status-card" id="sipStatusPanel">
                            <span class="status-dot status-dot--offline" id="sipStatusIndicator" aria-label="SIP offline"></span>
                            <div class="sip-status-copy">
                                <span class="sip-status-label" id="sipStatusText">SIP offline</span>
                                <span class="sip-status-meta" id="sipStatusMeta">Awaiting registration</span>
                                <span class="sip-status-domain" id="sipStatusDomain">
                                    {{ $sipIdentity ? 'Target ' . $sipIdentity : 'No jambonz credentials configured' }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="meeting-actions">
                        <span class="status-pill status-pill--idle" id="statusPill">IDLE</span>
                        <button type="button" class="theme-toggle button-with-icon" id="themeToggleBtn">
                            <span class="icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                    <path
                                        d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-14.5a1 1 0 0 1 1 .9l.02.1V6a1 1 0 0 1-2 0V4.5a1 1 0 0 1 1-1ZM12 16a1 1 0 0 1 1 .88V19.5a1 1 0 0 1-2 .12V17a1 1 0 0 1 1-1Zm6-4a1 1 0 0 1 .12 2H17a1 1 0 0 1-.12-2H18Zm-10 0a1 1 0 0 1 .12 2H5a1 1 0 0 1-.12-2H8Zm9-5.66.08.07 1.06 1.06a1 1 0 0 1-1.32 1.5l-.08-.07-1.06-1.06a1 1 0 0 1 1.32-1.5Zm-9.9.08a1 1 0 0 1 1.32 1.5l-.08.07-1.06 1.06a1 1 0 0 1-1.32-1.5l.08-.07L7.1 6.42ZM16.95 16.95l1.06 1.06a1 1 0 0 1-1.32 1.5l-.08-.07-1.06-1.06a1 1 0 1 1 1.4-1.42Zm-9.9.08 1.06 1.06a1 1 0 0 1-1.32 1.5l-.08-.07-1.06-1.06a1 1 0 0 1 1.32-1.5l.08.07Z" />
                                </svg>
                            </span>
                            <span class="label">Theme</span>
                        </button>
                        <form method="POST" action="{{ route('logout') }}" id="logoutForm">
                            @csrf
                            <button type="submit" class="btn-secondary">Log out</button>
                        </form>
                    </div>
                </header>

                <div class="meeting-body">
                    <section class="stage">
                        <div class="stage-top">
                            <div class="meeting-code">
                                <span>Session code</span>
                                <div class="code-chip">
                                    <span class="tag" id="callCodeDisplay">No active session</span>
                                    <button type="button" class="btn-secondary" id="copyCodeBtn" disabled>Copy</button>
                                </div>
                            </div>
                            <div class="status-bar status-bar--overlay">
                                <span class="status-dot status-dot--idle" id="callStatusDot"></span>
                                <div>
                                    <strong id="callStatusText">Idle</strong>
                                    <div id="callMetaText">No active call</div>
                                </div>
                            </div>
                        </div>
                        <div class="video-grid">
                            <div class="video-tile video-tile--remote">
                                <video id="remoteVideo" playsinline autoplay></video>
                                <div class="video-label">Remote participant</div>
                            </div>
                            <div class="video-tile video-tile--local">
                                <video id="localVideo" playsinline autoplay muted></video>
                                <div class="video-label">You</div>
                            </div>
                        </div>
                        <div class="toolbar-floating">
                            <button type="button" class="toolbar-btn" id="muteBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M11 5.5c0-.78-.45-1.48-1.15-1.81a1.9 1.9 0 0 0-2.03.31L4.44 7.12H2.25A1.25 1.25 0 0 0 1 8.37v7.25A1.25 1.25 0 0 0 2.25 16.87h2.19l3.38 3.12a1.9 1.9 0 0 0 2.03.32c.7-.33 1.15-1.03 1.15-1.81V5.5ZM13 8v8.5a3.5 3.5 0 0 0 7 0V8h-2v8.5a1.5 1.5 0 0 1-3 0V8h-2Z" />
                                    </svg>
                                </span>
                                <span class="label">Mute</span>
                            </button>
                            <button type="button" class="toolbar-btn active" id="speakerBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M4.5 9.5h2.53L10 6.35a1 1 0 0 1 1.7.71v9.88a1 1 0 0 1-1.7.7L7.03 14.5H4.5A1.5 1.5 0 0 1 3 13v-2a1.5 1.5 0 0 1 1.5-1.5Zm12.02-5.86a1 1 0 0 1 1.41.09A9 9 0 0 1 20.5 10a9 9 0 0 1-2.57 6.27 1 1 0 1 1-1.46-1.37A7 7 0 0 0 18.5 10a7 7 0 0 0-2.03-4.9 1 1 0 0 1 .05-1.46Zm-2.83 2.83a1 1 0 0 1 1.41.1A5 5 0 0 1 16.5 10a5 5 0 0 1-1.4 3.42 1 1 0 0 1-1.46-1.38 3 3 0 0 0 0-4.08 1 1 0 0 1 .05-1.46Z" />
                                    </svg>
                                </span>
                                <span class="label">Speaker</span>
                            </button>
                            <button type="button" class="toolbar-btn" id="cameraBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M4.75 7A2.75 2.75 0 0 0 2 9.75v4.5A2.75 2.75 0 0 0 4.75 17h9.5A2.75 2.75 0 0 0 17 14.25v-1.55l2.87 1.53a1 1 0 0 0 1.47-.88V10.65a1 1 0 0 0-1.47-.88L17 11.3V9.75A2.75 2.75 0 0 0 14.25 7h-9.5ZM8 9.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
                                    </svg>
                                </span>
                                <span class="label">Camera</span>
                            </button>
                            <button type="button" class="toolbar-btn" id="recordBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M5 12a7 7 0 1 1 14 0 7 7 0 0 1-14 0Zm7-3.5A3.5 3.5 0 1 0 12 16a3.5 3.5 0 0 0 0-7Z" />
                                    </svg>
                                </span>
                                <span class="label">Record</span>
                            </button>
                            <button type="button" class="toolbar-btn toolbar-btn--solid" id="startCallBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M3 5.25C3 4 4 3 5.25 3h2.5C9 3 10 4 10 5.25v2C10 8.5 9 9.5 7.75 9.5H6.5c.2 2.4 1.2 4.4 3 6.2 1.8 1.8 3.8 2.8 6.2 3v-1.25C15.5 16.25 16.5 15.25 17.75 15.25h2c1.25 0 2.25 1 2.25 2.25v2.5C22 21.75 21 22.75 19.75 22.75 9.1 22.75 3 13.88 3 5.25Z" />
                                    </svg>
                                </span>
                                <span class="label">Start</span>
                            </button>
                            <button type="button" class="toolbar-btn toolbar-btn--demo" id="demoCallBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M12 5a7 7 0 1 1-7 7 1 1 0 0 0-2 0 9 9 0 1 0 9-9 1 1 0 0 0 0 2Zm-2.293 5.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0-1.414-1.414L11 11.586Z" />
                                    </svg>
                                </span>
                                <span class="label">Demo</span>
                            </button>
                            <button type="button" class="toolbar-btn" id="referBtn" disabled>
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M8.59 5.59 13.17 10H4a1 1 0 0 0 0 2h9.17l-4.58 4.41A1 1 0 0 0 10 18a1 1 0 0 0 .7-.29l6-6a1 1 0 0 0 0-1.42l-6-6A1 1 0 0 0 8.59 5.59Z" />
                                    </svg>
                                </span>
                                <span class="label">Transfer</span>
                            </button>
                            <button type="button" class="toolbar-btn toolbar-btn--danger" id="hangupBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M3.4 15c-.9.2-1.53 1.05-1.38 1.96l.42 2.68c.19 1.2 1.35 2.04 2.53 1.78l2.44-.54c.89-.2 1.49-1.04 1.41-1.95l-.19-2.22c2.11-.54 4.34-.54 6.45 0l-.19 2.22c-.08.91.52 1.75 1.41 1.95l2.44.54c1.18.26 2.34-.58 2.53-1.78l.42-2.68c.15-.91-.48-1.76-1.38-1.96-5.22-1.19-10.78-1.19-15.8 0Z" />
                                    </svg>
                                </span>
                                <span class="label">End</span>
                            </button>
                        </div>
                    </section>

                    <aside class="control-sidebar">
                        <div class="panel-card panel-card--warning" id="sipDomainWarning" @if ($sipDomainReachable) hidden @endif>
                            <h3>
                                @if (($sipDomainStatus['code'] ?? '') === 'missing')
                                    SIP domain missing
                                @else
                                    SBC address unavailable
                                @endif
                            </h3>
                            <p>{{ $sipDomainStatus['message'] ?? 'Unable to resolve SBC endpoint.' }}</p>
                        </div>

                        <div class="panel-card" id="sipLoginPanel">
                            <h3>Jambonz login</h3>
                            <p>Provide the email and SIP username that should register with <strong>{{ $sipDomain ?? 'sbc.jambonz.local' }}</strong>.</p>
                            <form id="sipLoginForm" class="input-stack">
                                <label for="sipEmailInput">Agent email</label>
                                <input id="sipEmailInput" type="email" placeholder="agent@example.com" value="{{ $user->email }}" required>
                                <label for="sipUsernameInput">SIP username</label>
                                <input id="sipUsernameInput" type="text" placeholder="agent01" required>
                                <button type="submit" class="btn-primary" id="sipLoginSubmitBtn">Connect to jambonz</button>
                                <p class="sip-login-message" id="sipLoginMessage">
                                    {{ $sipDomainStatus['message'] ?? 'Domain: ' . ($sipDomain ?? 'sbc.jambonz.local') }}
                                </p>
                            </form>
                        </div>

                        <div class="panel-card">
                            <h3>Meeting details</h3>
                            <p>Set the dial target and monitor session info.</p>
                            <div class="input-stack">
                                <label for="dialInput">Dial target</label>
                                <input id="dialInput" type="text" placeholder="+15551234567 or extension">
                            </div>
                            <div class="call-chips">
                                <div class="chip chip--teal">
                                    <span>Session</span>
                                    <strong id="sessionStateLabel">Idle</strong>
                                </div>
                                <div class="chip chip--purple">
                                    <span>Dial target</span>
                                    <strong id="dialTargetLabel">None</strong>
                                </div>
                                <div class="chip chip--pink">
                                    <span>Recording</span>
                                    <strong id="recordingStateLabel">Off</strong>
                                </div>
                            </div>
                        </div>

                        <div class="panel-card">
                            <h3>SIP credentials</h3>
                            <p>Logged in as <strong>{{ $sipIdentity ?? 'unknown user' }}</strong>. Logout to change credentials.</p>
                            <ul class="sip-credentials-list">
                                <li><span>Username:</span> <strong>{{ $sipConfig['username'] ?? 'n/a' }}</strong></li>
                                <li><span>Domain:</span> <strong>{{ $sipConfig['domain'] ?? 'n/a' }}</strong></li>
                                <li><span>WebSocket SBC:</span> <strong>{{ $sipConfig['wssServer'] ?? 'n/a' }}</strong></li>
                            </ul>
                        </div>

                        <div class="panel-card dialpad-card">
                            <h3>Dialpad</h3>
                            <p>Use the dotted dropdown to reveal a keypad-like selector.</p>
                            <button type="button" class="dialpad-toggle button-with-icon" id="dialpadToggleBtn">
                                <span class="icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <g fill="currentColor">
                                            <circle cx="6" cy="6" r="1.25" />
                                            <circle cx="12" cy="6" r="1.25" />
                                            <circle cx="18" cy="6" r="1.25" />
                                            <circle cx="6" cy="12" r="1.25" />
                                            <circle cx="12" cy="12" r="1.25" />
                                            <circle cx="18" cy="12" r="1.25" />
                                            <circle cx="6" cy="18" r="1.25" />
                                            <circle cx="12" cy="18" r="1.25" />
                                            <circle cx="18" cy="18" r="1.25" />
                                        </g>
                                    </svg>
                                </span>
                                <span class="label">Show dialpad</span>
                            </button>
                            <div class="dialpad-dropdown" id="dialpadDropdown">
                                <label class="sr-only" for="dialpadSelect">Dialpad digits</label>
                                <select id="dialpadSelect" class="dialpad-select">
                                    <option value="">Select digit</option>
                                    <option value="1">1 — &nbsp;</option>
                                    <option value="2">2 — ABC</option>
                                    <option value="3">3 — DEF</option>
                                    <option value="4">4 — GHI</option>
                                    <option value="5">5 — JKL</option>
                                    <option value="6">6 — MNO</option>
                                    <option value="7">7 — PQRS</option>
                                    <option value="8">8 — TUV</option>
                                    <option value="9">9 — WXYZ</option>
                                    <option value="0">0 — +</option>
                                    <option value="*">* — tone</option>
                                    <option value="#"># — menu</option>
                                </select>
                                <div class="dialpad-actions">
                                    <button type="button" class="btn-secondary" id="clearDialBtn">Clear dial</button>
                                </div>
                            </div>
                        </div>

                        <div class="panel-card">
                            <h3>Live console</h3>
                            <p>Realtime call events.</p>
                            <div class="call-log" id="callLog"></div>
                        </div>

                        <div class="panel-card call-history-card">
                            <h3>Call logs</h3>
                            <p>Recent activity (local to this browser).</p>
                            <div class="call-history" id="callHistory">
                                <div class="call-history__empty">No call logs yet.</div>
                            </div>
                            <button type="button" class="btn-secondary call-history__clear" id="clearHistoryBtn">
                                Clear logs
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
        <script>
            (() => {
                if (window.__CALL_INLINE_BOOTSTRAP__) {
                    return;
                }
                window.__CALL_INLINE_BOOTSTRAP__ = true;

                const ready = (fn) => {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', fn);
                    } else {
                        fn();
                    }
                };

                ready(() => {
                    const dialInput = document.getElementById('dialInput');
                    const dialpadToggleBtn = document.getElementById('dialpadToggleBtn');
                    const dialpadDropdown = document.getElementById('dialpadDropdown');
                    const dialpadSelect = document.getElementById('dialpadSelect');
                    const clearDialBtn = document.getElementById('clearDialBtn');
                    const dialTargetLabel = document.getElementById('dialTargetLabel');
                    const themeToggleBtn = document.getElementById('themeToggleBtn');
                    const startCallBtn = document.getElementById('startCallBtn');
                    const demoCallBtn = document.getElementById('demoCallBtn');
                    const hangupBtn = document.getElementById('hangupBtn');
                    const callCodeDisplay = document.getElementById('callCodeDisplay');
                    const copyCodeBtn = document.getElementById('copyCodeBtn');
                    const callStatusText = document.getElementById('callStatusText');
                    const callMetaText = document.getElementById('callMetaText');
                    const callStatusDot = document.getElementById('callStatusDot');
                    const localVideo = document.getElementById('localVideo');
                    const remoteVideo = document.getElementById('remoteVideo');
                    const statusPill = document.getElementById('statusPill');
                    const muteBtn = document.getElementById('muteBtn');
                    const speakerBtn = document.getElementById('speakerBtn');
                    const cameraBtn = document.getElementById('cameraBtn');
                    const THEME_KEY = 'call-console-theme';
                    const ringAudio = new Audio('/audio/demo-ring.wav');
                    ringAudio.preload = 'auto';
                    const loopAudio = new Audio('/audio/demo-loop.wav');
                    loopAudio.preload = 'auto';
                    loopAudio.loop = true;
                    const CALL_HISTORY_KEY = 'call-history';
                    let callHistory = [];
                    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

                    const updateDialTarget = () => {
                        if (dialTargetLabel) {
                            const value = (dialInput?.value || '').trim();
                            dialTargetLabel.textContent = value || 'None';
                        }
                    };

                    const updateCallStatus = (text, meta, variant = 'idle') => {
                        if (callStatusText) {
                            callStatusText.textContent = text;
                        }
                        if (callMetaText) {
                            callMetaText.textContent = meta;
                        }
                        if (callStatusDot) {
                            callStatusDot.classList.remove('status-dot--idle', 'status-dot--online', 'status-dot--live');
                            const cls =
                                variant === 'active'
                                    ? 'status-dot--live'
                                    : variant === 'pending'
                                        ? 'status-dot--online'
                                        : 'status-dot--idle';
                            callStatusDot.classList.add(cls);
                        }
                        if (statusPill) {
                            statusPill.textContent = (text || 'Idle').toUpperCase();
                            statusPill.classList.remove('status-pill--idle', 'status-pill--pending', 'status-pill--active', 'status-pill--ended');
                            const pillCls =
                                variant === 'active'
                                    ? 'status-pill--active'
                                    : variant === 'pending'
                                        ? 'status-pill--pending'
                                        : variant === 'ended'
                                            ? 'status-pill--ended'
                                            : 'status-pill--idle';
                            statusPill.classList.add(pillCls);
                        }
                    };

                    const setButtonLabel = (button, text) => {
                        if (!button) {
                            return;
                        }
                        const label = button.querySelector('.label');
                        if (label) {
                            label.textContent = text;
                        } else {
                            button.textContent = text;
                        }
                    };

                    const setCallCodeText = (value) => {
                        if (callCodeDisplay) {
                            callCodeDisplay.textContent = value || 'No active session';
                        }
                        if (copyCodeBtn) {
                            copyCodeBtn.disabled = !value;
                        }
                    };

                    const loadCallHistory = () => {
                        try {
                            const raw = localStorage.getItem(CALL_HISTORY_KEY);
                            return raw ? JSON.parse(raw) : [];
                        } catch {
                            return [];
                        }
                    };

                    const saveCallHistory = () => {
                        try {
                            localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(callHistory));
                        } catch {
                            /* ignore */
                        }
                    };

                    const renderCallHistory = () => {
                        const container = document.getElementById('callHistory');
                        if (!container) {
                            return;
                        }
                        if (!callHistory.length) {
                            container.innerHTML = '<div class="call-history__empty">No call logs yet.</div>';
                            return;
                        }
                        container.innerHTML = callHistory
                            .map(
                                (entry) => `
                                <div class="call-history__entry">
                                    <strong>${entry.label}</strong>
                                    <small>${entry.time} · ${entry.details || ''}</small>
                                </div>`
                            )
                            .join('');
                    };

                    const addHistoryEntry = (label, details) => {
                        const timestamp = new Date();
                        let formatted;
                        try {
                            formatted = new Intl.DateTimeFormat(undefined, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                            }).format(timestamp);
                        } catch (_) {
                            formatted = timestamp.toISOString();
                        }
                        callHistory = [{ label, details, time: formatted }, ...callHistory].slice(0, 12);
                        saveCallHistory();
                        renderCallHistory();
                    };

                    const inlineDemo = {
                        active: false,
                        stream: null,
                        remoteStream: null,
                        muted: false,
                        speakerOn: true,
                        cameraOn: true,
                    };

                    const stopInlineDemo = () => {
                        if (!inlineDemo.active) {
                            return;
                        }
                        inlineDemo.active = false;
                        inlineDemo.stream?.getTracks().forEach((track) => track.stop());
                        inlineDemo.remoteStream?.getTracks().forEach((track) => track.stop());
                        inlineDemo.stream = null;
                        inlineDemo.remoteStream = null;
                        if (remoteVideo) {
                            remoteVideo.srcObject = null;
                        }
                        ringAudio.pause();
                        ringAudio.currentTime = 0;
                        loopAudio.pause();
                        loopAudio.currentTime = 0;
                        ringAudio.onended = null;
                        inlineDemo.muted = false;
                        inlineDemo.speakerOn = true;
                        inlineDemo.cameraOn = true;
                        muteBtn?.classList.remove('active');
                        speakerBtn?.classList.add('active');
                        cameraBtn?.classList.add('active');
                        setButtonLabel(muteBtn, 'Mute mic');
                        setButtonLabel(speakerBtn, 'Speaker on');
                        setButtonLabel(cameraBtn, 'Camera on');
                        updateCallStatus('Call ended', 'Session reset', 'ended');
                        setCallCodeText(null);
                        updateDialTarget();
                        addHistoryEntry('Demo call ended', 'Loopback closed');
                    };

                    const ensureAudioCtx = (() => {
                        let ctx = null;
                        return () => {
                            if (ctx) {
                                if (ctx.state === 'suspended') {
                                    ctx.resume().catch(() => {});
                                }
                                return ctx;
                            }
                            const AudioCtx = window.AudioContext || window.webkitAudioContext;
                            if (!AudioCtx) {
                                return null;
                            }
                            ctx = new AudioCtx();
                            return ctx;
                        };
                    })();

                    const frequencies = {
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
                        '*': 620,
                        '#': 880,
                    };

                    const playTone = (digit) => {
                        const freq = frequencies[digit];
                        if (!freq) {
                            return;
                        }
                        const ctx = ensureAudioCtx();
                        if (!ctx) {
                            return;
                        }
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.value = freq;
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        const now = ctx.currentTime;
                        gain.gain.setValueAtTime(0.0001, now);
                        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
                        osc.start(now);
                        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
                        osc.stop(now + 0.21);
                    };

                    if (dialpadSelect) {
                        dialpadSelect.addEventListener('change', (event) => {
                            const digit = event.target.value;
                            if (!digit) {
                                return;
                            }
                            if (dialInput) {
                                dialInput.value = (dialInput.value || '') + digit;
                            }
                            updateDialTarget();
                            playTone(digit);
                            event.target.value = '';
                        });
                    }

                    clearDialBtn?.addEventListener('click', () => {
                        if (dialInput) {
                            dialInput.value = '';
                        }
                        updateDialTarget();
                    });

                    let dialpadOpen = false;
                    const setDialpadState = (open) => {
                        dialpadOpen = open;
                        dialpadDropdown?.classList.toggle('open', open);
                        const label = dialpadToggleBtn?.querySelector('.label');
                        if (label) {
                            label.textContent = open ? 'Hide dialpad' : 'Show dialpad';
                        }
                    };

                    dialpadToggleBtn?.addEventListener('click', () => {
                        setDialpadState(!dialpadOpen);
                    });

                    document.addEventListener('click', (event) => {
                        if (!dialpadOpen) {
                            return;
                        }
                        const target = event.target;
                        if (
                            target === dialpadDropdown ||
                            target === dialpadToggleBtn ||
                            dialpadDropdown?.contains(target) ||
                            dialpadToggleBtn?.contains(target)
                        ) {
                            return;
                        }
                        setDialpadState(false);
                    });

                    const applyTheme = (theme) => {
                        const normalized = theme === 'light' ? 'light' : 'dark';
                        document.documentElement.dataset.theme = normalized;
                        document.body.dataset.theme = normalized;
                        try {
                            localStorage.setItem(THEME_KEY, normalized);
                        } catch (_) {
                            /* ignore */
                        }
                        const label = themeToggleBtn?.querySelector('.label');
                        if (label) {
                            label.textContent = normalized === 'light' ? 'Light mode' : 'Dark mode';
                        }
                    };

                    const storedTheme = (() => {
                        try {
                            return localStorage.getItem(THEME_KEY);
                        } catch (_) {
                            return null;
                        }
                    })();

                    const initialTheme =
                        storedTheme ||
                        (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
                            ? 'light'
                            : 'dark');
                    applyTheme(initialTheme);

                    themeToggleBtn?.addEventListener('click', () => {
                        const current = document.body.dataset.theme === 'light' ? 'light' : 'dark';
                        applyTheme(current === 'light' ? 'dark' : 'light');
                    });

                    if (!window.__CALL_APP_ACTIVE__) {
                        startCallBtn?.addEventListener('click', (event) => {
                            event.preventDefault();
                            demoCallBtn?.click();
                        });
                    }

                    demoCallBtn?.addEventListener('click', async () => {
                        if (inlineDemo.active) {
                            return;
                        }
                        updateCallStatus('Ringing', 'Demo loopback', 'pending');
                        try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                            inlineDemo.stream = stream;
                            inlineDemo.remoteStream = new MediaStream();
                            stream.getTracks().forEach((track) => {
                                inlineDemo.remoteStream.addTrack(track.clone ? track.clone() : track);
                            });
                            if (localVideo) {
                                localVideo.srcObject = stream;
                                localVideo.muted = true;
                            }
                            if (remoteVideo) {
                                remoteVideo.srcObject = inlineDemo.remoteStream;
                                remoteVideo.muted = !inlineDemo.speakerOn;
                            }
                            const startLoop = () => {
                                loopAudio.currentTime = 0;
                                loopAudio.play().catch(() => {});
                            };
                            ringAudio.currentTime = 0;
                            ringAudio.onended = startLoop;
                            ringAudio.play().catch(startLoop);
                            setCallCodeText('DEMO');
                            inlineDemo.active = true;
                            updateCallStatus('Demo call active', 'Loopback ready', 'active');
                            addHistoryEntry('Demo call started', 'Loopback self test');
                        } catch (error) {
                            updateCallStatus('Demo call failed', 'Allow camera/mic access');
                        }
                    });

                    hangupBtn?.addEventListener('click', () => {
                        if (inlineDemo.active) {
                            stopInlineDemo();
                        }
                    });

                    muteBtn?.addEventListener('click', (event) => {
                        if (!inlineDemo.active || !inlineDemo.stream) {
                            return;
                        }
                        event.preventDefault();
                        inlineDemo.muted = !inlineDemo.muted;
                        inlineDemo.stream.getAudioTracks().forEach((track) => {
                            track.enabled = !inlineDemo.muted;
                        });
                        muteBtn.classList.toggle('active', inlineDemo.muted);
                        setButtonLabel(muteBtn, inlineDemo.muted ? 'Unmute mic' : 'Mute mic');
                    });

                    speakerBtn?.addEventListener('click', (event) => {
                        if (!inlineDemo.active || !inlineDemo.remoteStream) {
                            return;
                        }
                        event.preventDefault();
                        inlineDemo.speakerOn = !inlineDemo.speakerOn;
                        if (remoteVideo) {
                            remoteVideo.muted = !inlineDemo.speakerOn;
                        }
                        speakerBtn.classList.toggle('active', inlineDemo.speakerOn);
                        setButtonLabel(speakerBtn, inlineDemo.speakerOn ? 'Speaker on' : 'Speaker off');
                    });

                    cameraBtn?.addEventListener('click', (event) => {
                        if (!inlineDemo.active || !inlineDemo.stream) {
                            return;
                        }
                        event.preventDefault();
                        inlineDemo.cameraOn = !inlineDemo.cameraOn;
                        inlineDemo.stream.getVideoTracks().forEach((track) => {
                            track.enabled = inlineDemo.cameraOn;
                        });
                        cameraBtn.classList.toggle('active', inlineDemo.cameraOn);
                        setButtonLabel(cameraBtn, inlineDemo.cameraOn ? 'Camera on' : 'Camera off');
                    });

                    updateDialTarget();
                    setDialpadState(false);
                    setCallCodeText(null);
                    callHistory = loadCallHistory();
                    renderCallHistory();
                    addHistoryEntry('Console ready', 'Dashboard booted');
                    clearHistoryBtn?.addEventListener('click', () => {
                        callHistory = [];
                        saveCallHistory();
                        renderCallHistory();
                    });
                });
            })();
        </script>
    </body>
</html>
