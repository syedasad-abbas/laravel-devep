import SignalingClient from './signaling';
import SipClient from './sip-client';

(() => {
const appRoot = document.getElementById('call-app');

if (!appRoot) {
    return;
}

window.__CALL_APP_ACTIVE__ = true;

const els = {
    dialInput: document.getElementById('dialInput'),
    startCallBtn: document.getElementById('startCallBtn'),
    hangupBtn: document.getElementById('hangupBtn'),
    callCodeDisplay: document.getElementById('callCodeDisplay'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    dialpadSelect: document.getElementById('dialpadSelect'),
    dialpadDropdown: document.getElementById('dialpadDropdown'),
    dialpadToggleBtn: document.getElementById('dialpadToggleBtn'),
    clearDialBtn: document.getElementById('clearDialBtn'),
    muteBtn: document.getElementById('muteBtn'),
    speakerBtn: document.getElementById('speakerBtn'),
    recordBtn: document.getElementById('recordBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    statusDot: document.getElementById('callStatusDot'),
    statusText: document.getElementById('callStatusText'),
    statusMeta: document.getElementById('callMetaText'),
    callLog: document.getElementById('callLog'),
    localVideo: document.getElementById('localVideo'),
    remoteVideo: document.getElementById('remoteVideo'),
    sessionStateLabel: document.getElementById('sessionStateLabel'),
    dialTargetLabel: document.getElementById('dialTargetLabel'),
    recordingStateLabel: document.getElementById('recordingStateLabel'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    demoCallBtn: document.getElementById('demoCallBtn'),
    statusPill: document.getElementById('statusPill'),
    callHistory: document.getElementById('callHistory'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    joinCodeInput: document.getElementById('joinCodeInput'),
    userPresenceIndicator: document.getElementById('userPresenceIndicator'),
    userPresenceText: document.getElementById('userPresenceText'),
    logoutForm: document.getElementById('logoutForm'),
    sipStatusIndicator: document.getElementById('sipStatusIndicator'),
    sipStatusText: document.getElementById('sipStatusText'),
    sipStatusMeta: document.getElementById('sipStatusMeta'),
    sipStatusDomain: document.getElementById('sipStatusDomain'),
    referBtn: document.getElementById('referBtn'),
};

const state = {
    callCode: null,
    role: null,
    peer: null,
    localStream: null,
    remoteStream: null,
    consumedCandidates: {
        offer: 0,
        answer: 0,
    },
    remoteDescriptionApplied: false,
    speakerEnabled: true,
    muted: false,
    cameraEnabled: true,
    recorder: null,
    recordedChunks: [],
    isRecording: false,
    isDemo: false,
    demoPeer: null,
    currentTarget: 'None',
    sipClient: null,
    sipRegistered: false,
    sipSession: null,
    isSipCall: false,
    sipTransportState: 'disconnected',
    sipStatus: 'offline',
    sipReferInProgress: false,
};

const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const sipConfig = window.__SIP_CLIENT_CONFIG__ || {};

function formatSipAddress() {
    if (!sipConfig?.username || !sipConfig?.domain) {
        return null;
    }
    return `${sipConfig.username}@${sipConfig.domain}`;
}

function missingSipConfigFields() {
    const missing = [];
    if (!sipConfig?.wssServer) {
        missing.push('WebSocket server (JAMBONZ_SIP_WSS)');
    }
    if (!sipConfig?.username) {
        missing.push('SIP username from login');
    }
    if (!sipConfig?.domain) {
        missing.push('SIP domain from login');
    }
    if (!sipConfig?.password) {
        missing.push('SIP password from login');
    }
    return missing;
}

function hasSipStack(logIssues = false) {
    const missing = missingSipConfigFields();
    if (missing.length === 0) {
        return true;
    }
    if (logIssues) {
        const message = `SIP disabled: missing ${missing.join(', ')}`;
        console.warn('[SIP]', message);
        logEvent(message);
        updateSipStatus('disabled', message);
    }
    return false;
}

const THEME_KEY = 'call-console-theme';
let dialpadOpen = false;
let toneContext;
let callHistory = [];
const CALL_HISTORY_KEY = 'call-history';
const MAX_CALL_HISTORY = 12;
const signaling = new SignalingClient();
signaling.on('session', handleSessionUpdate);
signaling.on('sessionError', () => {
    logEvent('Signaling update failed; retrying...');
});

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
    '*': 620,
    '#': 880,
};

// Audio assets for demo call
const demoRingAudio = new Audio('/audio/demo-ring.wav');
demoRingAudio.preload = 'auto';
const demoLoopAudio = new Audio('/audio/demo-loop.wav');
demoLoopAudio.preload = 'auto';
demoLoopAudio.loop = true;

function applyTheme(theme) {
    if (!document.body) {
        return;
    }

    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = normalized;
    document.body.dataset.theme = normalized;
    try {
        localStorage.setItem(THEME_KEY, normalized);
    } catch (_) {
        // ignore write errors
    }
    updateThemeButton(normalized);
}

function updateThemeButton(theme) {
    if (!els.themeToggleBtn) {
        return;
    }

    const label = els.themeToggleBtn.querySelector('.label');
    if (label) {
        label.textContent = theme === 'light' ? 'Light mode' : 'Dark mode';
    }
}

function initTheme() {
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
}

function toggleTheme() {
    const nextTheme = document.body?.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
}

function ensureToneContext() {
    if (toneContext) {
        if (toneContext.state === 'suspended') {
            toneContext.resume().catch(() => {});
        }
        return toneContext;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        return null;
    }

    toneContext = new AudioCtx();
    return toneContext;
}

function playDialTone(key) {
    const frequency = dialToneFrequencies[key];
    if (!frequency) {
        return;
    }

    const ctx = ensureToneContext();
    if (!ctx) {
        return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    oscillator.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.stop(now + 0.21);
}

function loadCallHistory() {
    if (!window.localStorage) {
        return [];
    }
    try {
        const raw = localStorage.getItem(CALL_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCallHistory() {
    if (!window.localStorage) {
        return;
    }
    try {
        localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(callHistory));
    } catch {
        // ignore quota issues
    }
}

function formatTimestamp(ts) {
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(new Date(ts));
    } catch {
        return ts;
    }
}

function renderCallHistory() {
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
                    <small>${formatTimestamp(entry.timestamp)} · ${entry.details || ''}</small>
                </div>`
        )
        .join('');
}

function addCallHistoryEntry(entry) {
    const payload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        ...entry,
    };
    callHistory = [payload, ...callHistory].slice(0, MAX_CALL_HISTORY);
    saveCallHistory();
    renderCallHistory();
}

function clearCallHistory() {
    callHistory = [];
    saveCallHistory();
    renderCallHistory();
}

function startDemoAudio() {
    stopDemoAudio();
    const startLoop = () => {
        demoLoopAudio.currentTime = 0;
        demoLoopAudio.play().catch(() => {});
    };
    demoRingAudio.currentTime = 0;
    demoRingAudio.onended = startLoop;
    demoRingAudio.play().catch(startLoop);
}

function stopDemoAudio() {
    demoRingAudio.pause();
    demoLoopAudio.pause();
    demoRingAudio.currentTime = 0;
    demoLoopAudio.currentTime = 0;
    demoRingAudio.onended = null;
}

function setSessionStateLabel(value) {
    if (els.sessionStateLabel) {
        els.sessionStateLabel.textContent = value;
    }
}

function setDialTargetLabel(value) {
    if (els.dialTargetLabel) {
        els.dialTargetLabel.textContent = value && value.trim().length ? value : 'None';
    }
}

function setRecordingStateLabel(value) {
    if (els.recordingStateLabel) {
        els.recordingStateLabel.textContent = value;
    }
}

function setButtonLabel(button, text) {
    if (!button) {
        return;
    }

    const label = button.querySelector('.label');
    if (label) {
        label.textContent = text;
    } else {
        button.textContent = text;
    }
}

function logEvent(message) {
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
}

function setUserPresence(state = 'online') {
    if (!els.userPresenceIndicator) {
        return;
    }

    const variants = {
        online: { className: 'status-dot--online', text: 'Online', label: 'User online' },
        away: { className: 'status-dot--away', text: 'Away', label: 'User away' },
        offline: { className: 'status-dot--offline', text: 'Offline', label: 'User offline' },
    };
    const next = variants[state] || variants.online;
    const dot = els.userPresenceIndicator;

    dot.classList.remove('status-dot--idle', 'status-dot--online', 'status-dot--away', 'status-dot--offline');
    dot.classList.add(next.className);
    dot.setAttribute('aria-label', next.label);
    dot.setAttribute('title', next.label);

    if (els.userPresenceText) {
        els.userPresenceText.textContent = next.text;
    }
}

function setReferButtonState(enabled) {
    if (els.referBtn) {
        els.referBtn.disabled = !enabled;
    }
}

function buildReferTarget(rawValue) {
    if (!rawValue) {
        return null;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
        return null;
    }
    if (/^sips?:/i.test(trimmed)) {
        return trimmed;
    }
    const referDomain = sipConfig?.referDomain || sipConfig?.domain || '';
    if (referDomain) {
        return `sip:${trimmed}@${referDomain}`;
    }
    return `sip:${trimmed}`;
}

function updateSipDomainLabel(status = 'offline') {
    if (!els.sipStatusDomain) {
        return;
    }
    const address = formatSipAddress();
    if (!address) {
        els.sipStatusDomain.textContent = 'No jambonz domain configured';
        return;
    }
    const prefix = status === 'registered' ? 'Registered as' : 'Target';
    els.sipStatusDomain.textContent = `${prefix} ${address}`;
}

function updateSipStatus(status = 'offline', metaText = '') {
    if (!els.sipStatusIndicator || !els.sipStatusText) {
        return;
    }

    const sipAddress = formatSipAddress();
    const variants = {
        disabled: { className: 'status-dot--offline', text: 'SIP disabled', meta: 'Provide SIP credentials to enable SIP' },
        connecting: {
            className: 'status-dot--idle',
            text: 'Registering...',
            meta: sipAddress ? `Registering ${sipAddress}` : 'Connecting to jambonz',
        },
        registered: {
            className: 'status-dot--online',
            text: 'Registered to jambonz',
            meta: sipAddress ? `Online as ${sipAddress}` : 'Ready for PSTN bridging',
        },
        reconnecting: { className: 'status-dot--idle', text: 'Re-registering...', meta: 'Retrying gateway connection' },
        offline: { className: 'status-dot--offline', text: 'SIP offline', meta: 'Transport disconnected' },
        error: { className: 'status-dot--away', text: 'Registration error', meta: 'Check SIP logs' },
    };

    const next = variants[status] || variants.offline;
    state.sipStatus = status;

    const dot = els.sipStatusIndicator;
    dot.classList.remove('status-dot--idle', 'status-dot--online', 'status-dot--live', 'status-dot--away', 'status-dot--offline');
    dot.classList.add(next.className);
    dot.setAttribute('aria-label', next.text);
    dot.setAttribute('title', next.text);

    els.sipStatusText.textContent = next.text;
    if (els.sipStatusMeta) {
        els.sipStatusMeta.textContent = metaText || next.meta;
    }
    updateSipDomainLabel(status);
}

async function initSipStack() {
    if (!hasSipStack() || state.sipClient) {
        return;
    }

    const sipAddress = formatSipAddress();
    const targetMessage = sipAddress
        ? `Registering ${sipAddress}`
        : 'Registering with jambonz...';
    console.info('[SIP] Starting registration', {
        address: sipAddress,
        wssServer: sipConfig?.wssServer,
    });
    logEvent(sipAddress ? `Attempting SIP registration for ${sipAddress}` : 'Attempting SIP registration');
    updateSipStatus('connecting', targetMessage);
    state.sipClient = new SipClient(sipConfig, iceServers);
    state.sipClient.on('registration', handleSipRegistration);
    state.sipClient.on('transport', handleSipTransport);
    state.sipClient.on('invite', handleSipInvite);
    state.sipClient.on('sessionState', handleSipSessionState);
    state.sipClient.on('refer', handleSipRefer);
    state.sipClient.on('error', () => {
        logEvent('SIP stack error');
        updateSipStatus('error', 'SIP stack error');
    });

    try {
        await state.sipClient.start();
    } catch (error) {
        console.error('SIP registration failed', error);
        logEvent('Unable to register with jambonz SIP gateway');
        updateCallStatus('SIP offline', 'Verify jambonz credentials', 'idle');
        updateSipStatus('error', 'Unable to register with jambonz');
    }
}

function handleSipRegistration(event) {
    const status = event?.status || 'unknown';
    state.sipRegistered = status === 'registered';
    logEvent(`SIP status: ${status}`);
    switch (status) {
        case 'registered':
            updateSipStatus('registered', formatSipAddress() ? `Online as ${formatSipAddress()}` : 'Ready for PSTN bridging');
            break;
        case 'unregistered':
            updateSipStatus('reconnecting', 'Awaiting next register');
            break;
        case 'terminated':
            updateSipStatus('offline', 'Registration terminated');
            break;
        default:
            updateSipStatus('connecting', `Status: ${status}`);
            break;
    }
}

function handleSipTransport(event) {
    state.sipTransportState = event?.state || 'unknown';
    if (event?.state === 'disconnected') {
        logEvent('SIP transport disconnected');
        state.sipRegistered = false;
        updateSipStatus('offline', 'Transport disconnected');
    } else if (event?.state === 'connected') {
        const status = state.sipRegistered ? 'registered' : 'connecting';
        const sipAddress = formatSipAddress();
        const meta = state.sipRegistered
            ? sipAddress
                ? `Online as ${sipAddress}`
                : 'Registered - Online'
            : sipAddress
                ? `Registering ${sipAddress}`
                : 'Registering with jambonz...';
        updateSipStatus(status, meta);
    }
}

async function handleSipInvite(payload) {
    if (!payload?.invitation) {
        return;
    }

    await hangUp();

    state.isSipCall = true;
    state.sipSession = payload.invitation;
    const caller = getSipIdentity(payload.invitation);
    state.currentTarget = caller;
    setDialTargetLabel(caller);
    setCallCode('SIP');
    updateCallStatus('Incoming SIP call', `From ${caller}`, 'pending');
    logEvent(`Incoming SIP call from ${caller}`);

    try {
        await answerSipInvitation(payload.invitation);
    } catch (error) {
        logEvent('Unable to accept SIP call');
        resetSipSession();
    }
}

function handleSipSessionState(event) {
    if (!event?.invitation || state.sipSession !== event.invitation) {
        return;
    }

    switch (event.status) {
        case 'established':
            attachSipMedia(event.invitation);
            updateCallStatus('Live SIP call', `Connected to ${state.currentTarget}`, 'active');
            logEvent('SIP call established');
            setReferButtonState(true);
            break;
        case 'terminated':
            logEvent('SIP call ended');
            updateCallStatus('SIP call ended', '', 'ended');
            resetSipSession();
            setReferButtonState(false);
            break;
        default:
            break;
    }
}

function handleSipRefer(event) {
    if (!event?.referral) {
        return;
    }
    const referTo = event.referral.referTo?.uri?.toString?.() || 'unknown target';
    logEvent(`SIP REFER received: ${referTo}`);
    updateCallStatus('Transfer requested', `Following REFER to ${referTo}`, 'pending');

    const inviterOptions = {
        sessionDescriptionHandlerOptions: {
            constraints: {
                audio: true,
                video: true,
            },
            peerConnectionConfiguration: {
                iceServers,
            },
        },
    };

    event.referral
        .accept()
        .then(() => event.referral.makeInviter(inviterOptions).invite())
        .then(() => {
            logEvent('REFER followed successfully');
        })
        .catch((error) => {
            console.error('Unable to follow REFER', error);
            updateCallStatus('Transfer failed', `Unable to follow REFER to ${referTo}`, 'pending');
        });
}

async function answerSipInvitation(invitation) {
    try {
        await initLocalMedia();
    } catch (error) {
        updateCallStatus('Mic/camera blocked', 'Cannot answer SIP call');
        await invitation.reject({});
        throw error;
    }

    invitation.delegate = invitation.delegate || {};
    invitation.delegate.onSessionDescriptionHandler = () => {
        attachSipMedia(invitation);
    };

    const options = {
        sessionDescriptionHandlerOptions: {
            constraints: {
                audio: true,
                video: true,
            },
            peerConnectionConfiguration: {
                iceServers,
            },
        },
    };

    await invitation.accept(options);
    els.hangupBtn.disabled = false;
}

function attachSipMedia(invitation) {
    const handler = invitation.sessionDescriptionHandler;
    if (!handler) {
        return;
    }

    if (handler.remoteMediaStream) {
        state.remoteStream = handler.remoteMediaStream;
        els.remoteVideo.srcObject = handler.remoteMediaStream;
    }

    if (handler.localMediaStream) {
        state.localStream = handler.localMediaStream;
        els.localVideo.srcObject = handler.localMediaStream;
    }
}

function resetSipSession(resetUi = true) {
    state.isSipCall = false;
    if (state.sipSession) {
        try {
            state.sipSession.dispose?.();
        } catch (_) {
            // ignore
        }
    }
    state.sipSession = null;
    if (resetUi) {
        setCallCode(null);
        setDialTargetLabel('None');
        stopDemoAudio();
        resetSession();
    }
}

async function terminateSipSession() {
    if (!state.sipSession) {
        return;
    }
    try {
        if (typeof state.sipSession.bye === 'function') {
            await state.sipSession.bye();
        } else if (typeof state.sipSession.cancel === 'function') {
            await state.sipSession.cancel();
        }
    } catch (error) {
        console.warn('SIP hangup failed', error);
    } finally {
        resetSipSession(false);
    }
}

async function sendSipRefer() {
    if (!state.sipSession) {
        updateCallStatus('No SIP session', 'Establish SIP call before transferring');
        return;
    }
    const referTarget = buildReferTarget(els.dialInput.value);
    if (!referTarget) {
        updateCallStatus('Refer target required', 'Provide a dial target before transferring');
        return;
    }

    try {
        state.sipReferInProgress = true;
        setReferButtonState(false);
        updateCallStatus('Transferring call', `REFER to ${referTarget}`, 'pending');
        await state.sipSession.refer(referTarget, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: true,
                    video: true,
                },
                peerConnectionConfiguration: {
                    iceServers,
                },
            },
        });
        logEvent(`Sent SIP REFER to ${referTarget}`);
    } catch (error) {
        console.error('SIP REFER failed', error);
        updateCallStatus('Transfer failed', 'REFER request rejected or failed');
    } finally {
        state.sipReferInProgress = false;
        setReferButtonState(Boolean(state.sipSession));
    }
}

function getSipIdentity(invitation) {
    const identity = invitation?.remoteIdentity;
    if (!identity) {
        return 'Unknown caller';
    }
    return identity.displayName || identity.uri?.user || 'Unknown caller';
}

function updateCallStatus(text, meta = '', variant = 'idle') {
    els.statusText.textContent = text;
    els.statusMeta.textContent = meta;
    els.statusDot.classList.remove('status-dot--idle', 'status-dot--online', 'status-dot--live');
    setSessionStateLabel(text);

    const variantClass =
        variant === 'active' ? 'status-dot--live' : variant === 'pending' ? 'status-dot--online' : 'status-dot--idle';
    els.statusDot.classList.add(variantClass);

    if (els.statusPill) {
        els.statusPill.textContent = text ? text.toUpperCase() : 'IDLE';
        els.statusPill.classList.remove('status-pill--idle', 'status-pill--pending', 'status-pill--active', 'status-pill--ended');
        const pillClass =
            variant === 'active'
                ? 'status-pill--active'
                : variant === 'pending'
                    ? 'status-pill--pending'
                    : variant === 'ended'
                        ? 'status-pill--ended'
                        : 'status-pill--idle';
        els.statusPill.classList.add(pillClass);
    }
}

function setCallCode(value) {
    state.callCode = value;
    if (value) {
        els.callCodeDisplay.textContent = value;
        els.copyCodeBtn.disabled = false;
        els.hangupBtn.disabled = false;
    } else {
        els.callCodeDisplay.textContent = 'No active session';
        els.copyCodeBtn.disabled = true;
        els.hangupBtn.disabled = true;
    }
}

function clampCode(value) {
    return value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
}

async function initLocalMedia() {
    if (state.localStream) {
        return state.localStream;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        state.localStream = stream;
        els.localVideo.srcObject = stream;
        els.localVideo.muted = true;
        logEvent('Media devices initialized');
        return stream;
    } catch (error) {
        updateCallStatus('Camera/mic blocked', 'Allow browser access to continue');
        throw error;
    }
}

function createPeerConnection(role) {
    if (state.peer) {
        state.peer.close();
    }

    state.remoteStream = new MediaStream();
    els.remoteVideo.srcObject = state.remoteStream;
    els.remoteVideo.muted = !state.speakerEnabled;

    const pc = new RTCPeerConnection({ iceServers });
    pc.ontrack = (event) => {
        event.streams[0]
            ? event.streams[0].getTracks().forEach((track) => state.remoteStream.addTrack(track))
            : state.remoteStream.addTrack(event.track);
    };

    pc.onicecandidate = (event) => {
        if (!event.candidate || !state.callCode) {
            return;
        }

        const candidate = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
        signaling.sendCandidate(state.callCode, role, candidate).catch(() => {
            logEvent('ICE candidate send failed');
        });
    };

    pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
            case 'connected':
                updateCallStatus('Connected', `Code ${state.callCode}`, 'active');
                logEvent('Call connected');
                break;
            case 'disconnected':
            case 'failed':
                updateCallStatus('Network issue', 'Trying to reconnect', 'pending');
                break;
            case 'closed':
                updateCallStatus('Call ended', 'Session closed');
                break;
        }
    };

    state.peer = pc;
    state.role = role;
    state.remoteDescriptionApplied = false;
    state.consumedCandidates = { offer: 0, answer: 0 };

    return pc;
}

async function preparePeer(role) {
    await initLocalMedia();
    const peer = createPeerConnection(role);
    state.localStream.getTracks().forEach((track) => peer.addTrack(track, state.localStream));
    return peer;
}

async function startCall() {
    if (state.isSipCall) {
        updateCallStatus('SIP call in progress', 'End SIP call before starting a session');
        return;
    }
    if (!navigator.mediaDevices) {
        updateCallStatus('Unsupported browser', 'WebRTC requires secure context');
        return;
    }

    try {
        updateCallStatus('Creating session...', '', 'pending');
        const dialedNumber = els.dialInput.value.trim();
        state.currentTarget = dialedNumber || 'Share code only';
        setDialTargetLabel(state.currentTarget);
        const data = await signaling.createSession({
            dialed_number: dialedNumber || null,
        });

        setCallCode(data.call_code);
        logEvent(`Session ${data.call_code} created`);

        await preparePeer('offer');

        const offer = await state.peer.createOffer();
        await state.peer.setLocalDescription(offer);
        await signaling.sendOffer(state.callCode, {
            offer: {
                type: state.peer.localDescription.type,
                sdp: state.peer.localDescription.sdp,
            },
            dialed_number: dialedNumber || null,
        });

        startDemoAudio();
        addCallHistoryEntry({
            label: 'Call started',
            details: `${state.currentTarget} · Code ${data.call_code}`,
        });
        updateCallStatus('Ringing', dialedNumber ? `Dialing ${dialedNumber}` : 'Waiting for partner', 'pending');
        await signaling.subscribe(state.callCode, state.role);
    } catch (error) {
        updateCallStatus('Unable to start call', 'Check media permissions', 'idle');
        logEvent('Start call failed');
        resetSession();
    }
}

async function joinCall() {
    if (state.isSipCall) {
        updateCallStatus('SIP call active', 'Hang up before joining another call');
        return;
    }
    if (!els.joinCodeInput) {
        updateCallStatus('Join disabled', 'No join input available');
        return;
    }
    const code = clampCode(els.joinCodeInput.value || '');
    if (!code) {
        updateCallStatus('Code required', 'Enter a valid session code');
        return;
    }

    try {
        const data = await signaling.fetchSession(code);
        if (!data.offer) {
            updateCallStatus('No offer found', 'Creator has not started call yet');
            return;
        }

        setCallCode(code);
        state.currentTarget = data.dialed_number || `Code ${code}`;
        setDialTargetLabel(state.currentTarget);
        await preparePeer('answer');
        await state.peer.setRemoteDescription(data.offer);

        if (Array.isArray(data.offer_candidates)) {
            await applyCandidates('offer', data.offer_candidates);
        }

        const answer = await state.peer.createAnswer();
        await state.peer.setLocalDescription(answer);
        await signaling.sendAnswer(code, {
            answer: {
                type: state.peer.localDescription.type,
                sdp: state.peer.localDescription.sdp,
            },
        });

        updateCallStatus('Answer sent', 'Waiting for media', 'pending');
        await signaling.subscribe(code, state.role);
    } catch (error) {
        updateCallStatus('Join failed', 'Confirm the code and try again');
        resetSession();
    }
}

async function applyCandidates(type, candidates) {
    const key = type === 'offer' ? 'offer' : 'answer';
    for (let i = state.consumedCandidates[key]; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        try {
            await state.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.warn('ICE candidate rejected', error);
        }
    }
    state.consumedCandidates[key] = candidates.length;
}

async function handleSessionUpdate(session) {
    reflectServerStatus(session);

    if (!state.peer) {
        return;
    }

    try {
        if (state.role === 'offer' && session.answer && !state.remoteDescriptionApplied) {
            await state.peer.setRemoteDescription(session.answer);
            state.remoteDescriptionApplied = true;
            logEvent('Answer applied');
        }

        if (state.role === 'offer' && Array.isArray(session.answer_candidates)) {
            await applyCandidates('answer', session.answer_candidates);
        }

        if (state.role === 'answer' && Array.isArray(session.offer_candidates)) {
            await applyCandidates('offer', session.offer_candidates);
        }

        if (!state.isDemo && session.status === 'ended') {
            updateCallStatus('Remote left', 'Session closed', 'ended');
            addCallHistoryEntry({
                label: 'Remote left',
                details: `Code ${state.callCode || ''}`,
            });
            resetSession();
        }
    } catch (error) {
        logEvent('Failed to process signaling update');
    }
}

function reflectServerStatus(session) {
    let statusText = 'Idle';
    let variant = 'idle';
    let meta = 'Awaiting actions';

    switch (session.status) {
        case 'pending':
            statusText = 'Session ready';
            variant = 'pending';
            meta = `Share code ${session.call_code}`;
            break;
        case 'calling':
            statusText = 'Calling...';
            variant = 'pending';
            meta = session.dialed_number ? `Dialing ${session.dialed_number}` : 'Waiting for remote answer';
            break;
        case 'in_progress':
            statusText = 'Live call';
            variant = 'active';
            meta = 'WebRTC connected';
            break;
        case 'ended':
            statusText = 'Ended';
            variant = 'idle';
            meta = 'Session closed';
            break;
    }

    updateCallStatus(statusText, meta, variant);
}

async function hangUp() {
    const wasSipCall = state.isSipCall || Boolean(state.sipSession);
    const hadSession = state.isDemo || state.callCode || state.peer || wasSipCall;
    if (!hadSession) {
        return;
    }

    if (wasSipCall && state.sipSession) {
        await terminateSipSession();
    }

    if (state.isDemo) {
        logEvent('Demo call ended');
    } else if (state.callCode) {
        try {
            await signaling.updateStatus(state.callCode, 'ended');
        } catch (_) {
            // ignore
        }
    }

    if (state.recorder && state.isRecording) {
        state.recorder.stop();
    }

    updateCallStatus('Call ended', 'Session reset', 'ended');
    logEvent('Call ended locally');
    if (state.isDemo) {
        addCallHistoryEntry({
            label: 'Demo call ended',
            details: 'Loopback closed',
        });
    } else if (wasSipCall) {
        addCallHistoryEntry({
            label: 'SIP call ended',
            details: `Caller ${state.currentTarget || ''}`,
        });
    } else if (state.callCode) {
        addCallHistoryEntry({
            label: 'Call ended',
            details: `${state.currentTarget || ''} · Code ${state.callCode}`,
        });
    }
    resetSession();
    setDialTargetLabel('None');
    stopDemoAudio();
}

function resetSession(clearCode = true) {
    signaling.unsubscribe();
    if (state.peer) {
        state.peer.ontrack = null;
        state.peer.onicecandidate = null;
        state.peer.close();
        state.peer = null;
    }

    if (state.demoPeer) {
        state.demoPeer.ontrack = null;
        state.demoPeer.onicecandidate = null;
        state.demoPeer.close();
        state.demoPeer = null;
    }

    if (state.remoteStream) {
        state.remoteStream.getTracks().forEach((track) => track.stop());
        state.remoteStream = null;
    }

    state.role = null;
    state.remoteDescriptionApplied = false;
    state.consumedCandidates = { offer: 0, answer: 0 };
    state.isDemo = false;

    if (clearCode) {
        setCallCode(null);
    }

    if (els.joinCodeInput) {
        els.joinCodeInput.value = '';
    }
    els.hangupBtn.disabled = true;
    setSessionStateLabel('Idle');
    if (!state.isRecording) {
        setRecordingStateLabel('Off');
    }
    if (!els.dialInput.value.trim()) {
        setDialTargetLabel('None');
    }
    setReferButtonState(false);

    if (state.localStream) {
        els.localVideo.srcObject = state.localStream;
    }
}

function initDialpad() {
    if (els.dialpadSelect) {
        els.dialpadSelect.addEventListener('change', (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }

            els.dialInput.value = (els.dialInput.value || '') + value;
            setDialTargetLabel(els.dialInput.value);
            playDialTone(value);
            event.target.value = '';
        });
    }

    els.clearDialBtn?.addEventListener('click', () => {
        els.dialInput.value = '';
        setDialTargetLabel('None');
    });

    if (els.dialpadToggleBtn) {
        els.dialpadToggleBtn.addEventListener('click', () => {
            setDialpadOpen(!dialpadOpen);
        });
    }

    document.addEventListener('click', (event) => {
        if (!dialpadOpen) {
            return;
        }
        const target = event.target;
        if (
            target === els.dialpadDropdown ||
            target === els.dialpadToggleBtn ||
            els.dialpadDropdown?.contains(target) ||
            els.dialpadToggleBtn?.contains(target)
        ) {
            return;
        }
        setDialpadOpen(false);
    });

    setDialpadOpen(false);
}

function setDialpadOpen(open) {
    dialpadOpen = open;
    if (els.dialpadDropdown) {
        els.dialpadDropdown.classList.toggle('open', open);
    }
    if (els.dialpadToggleBtn) {
        const label = els.dialpadToggleBtn.querySelector('.label');
        if (label) {
            label.textContent = open ? 'Hide dialpad' : 'Show dialpad';
        }
    }
}

function toggleMute() {
    if (!state.localStream) {
        return;
    }

    state.muted = !state.muted;
    state.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !state.muted;
    });

    els.muteBtn.classList.toggle('active', state.muted);
    setButtonLabel(els.muteBtn, state.muted ? 'Unmute mic' : 'Mute mic');
}

function toggleSpeaker() {
    state.speakerEnabled = !state.speakerEnabled;
    els.remoteVideo.muted = !state.speakerEnabled;
    els.speakerBtn.classList.toggle('active', state.speakerEnabled);
    setButtonLabel(els.speakerBtn, state.speakerEnabled ? 'Speaker on' : 'Speaker off');
}

function toggleCamera() {
    if (!state.localStream) {
        return;
    }

    state.cameraEnabled = !state.cameraEnabled;
    state.localStream.getVideoTracks().forEach((track) => {
        track.enabled = state.cameraEnabled;
    });

    els.cameraBtn.classList.toggle('active', state.cameraEnabled);
    setButtonLabel(els.cameraBtn, state.cameraEnabled ? 'Camera on' : 'Camera off');
}

function toggleRecording() {
    if (state.isRecording) {
        state.recorder.stop();
        state.isRecording = false;
        setButtonLabel(els.recordBtn, 'Start recording');
        els.recordBtn.classList.remove('active');
        setRecordingStateLabel('Off');
        return;
    }

    const mix = new MediaStream();
    if (state.localStream) {
        state.localStream.getTracks().forEach((track) => mix.addTrack(track));
    }
    if (state.remoteStream) {
        state.remoteStream.getTracks().forEach((track) => mix.addTrack(track));
    }

    if (!mix.getTracks().length) {
        updateCallStatus('No media to record', 'Join or start a call first');
        return;
    }

    try {
        state.recorder = new MediaRecorder(mix);
    } catch (error) {
        updateCallStatus('Recording unsupported', 'Check browser compatibility');
        return;
    }

    state.recordedChunks = [];
    state.recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
            state.recordedChunks.push(event.data);
        }
    };

    state.recorder.onstop = () => {
        state.isRecording = false;
        setRecordingStateLabel('Off');
        setButtonLabel(els.recordBtn, 'Start recording');
        els.recordBtn.classList.remove('active');

        if (!state.recordedChunks.length) {
            return;
        }

        const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `call-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        logEvent('Recording saved');
    };

    state.recorder.start();
    state.isRecording = true;
    setButtonLabel(els.recordBtn, 'Stop recording');
    els.recordBtn.classList.add('active');
    setRecordingStateLabel('Recording');
    logEvent('Recording started');
}

async function copyCallCode() {
    if (!state.callCode) {
        return;
    }

    try {
        await navigator.clipboard.writeText(state.callCode);
        updateCallStatus('Code copied', `Share ${state.callCode} with the remote user`, 'pending');
    } catch (_) {
        updateCallStatus('Copy failed', `Tell the code manually: ${state.callCode}`);
    }
}

async function startDemoCall() {
    if (state.isSipCall) {
        updateCallStatus('SIP call active', 'Hang up SIP call before starting demo');
        return;
    }
    try {
        await initLocalMedia();
    } catch (error) {
        updateCallStatus('Camera/mic blocked', 'Allow browser access for demo');
        return;
    }

    await hangUp();

        try {
            updateCallStatus('Starting demo call...', 'Loopback test', 'pending');
            state.isDemo = true;
            state.currentTarget = 'Demo loopback';
            startDemoAudio();

        const pc1 = new RTCPeerConnection({ iceServers });
        const pc2 = new RTCPeerConnection({ iceServers });

        state.peer = pc1;
        state.demoPeer = pc2;
        state.remoteStream = new MediaStream();
        els.remoteVideo.srcObject = state.remoteStream;
        els.remoteVideo.muted = true;

        pc2.ontrack = (event) => {
            const stream = event.streams && event.streams[0];
            if (stream) {
                state.remoteStream = stream;
                els.remoteVideo.srcObject = stream;
            } else {
                state.remoteStream.addTrack(event.track);
                els.remoteVideo.srcObject = state.remoteStream;
            }
        };

        pc1.onconnectionstatechange = () => {
            if (pc1.connectionState === 'connected') {
                updateCallStatus('Demo call active', 'Loopback connected', 'active');
                logEvent('Demo call connected');
            } else if (pc1.connectionState === 'disconnected' || pc1.connectionState === 'failed') {
                updateCallStatus('Demo call interrupted', 'Check media devices', 'pending');
            }
        };

        pc1.onicecandidate = (event) => {
            if (event.candidate) {
                pc2.addIceCandidate(event.candidate).catch(() => {});
            }
        };

        pc2.onicecandidate = (event) => {
            if (event.candidate) {
                pc1.addIceCandidate(event.candidate).catch(() => {});
            }
        };

        state.localStream.getTracks().forEach((track) => pc1.addTrack(track, state.localStream));

        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);

        setCallCode('DEMO');
        setDialTargetLabel('Self test');
        els.hangupBtn.disabled = false;
        addCallHistoryEntry({
            label: 'Demo call started',
            details: 'Loopback self test',
        });
        logEvent('Demo call initialized');
    } catch (error) {
        updateCallStatus('Demo call failed', 'Loopback error');
        state.isDemo = false;
        stopDemoAudio();
        if (state.peer) {
            state.peer.close();
            state.peer = null;
        }
        if (state.demoPeer) {
            state.demoPeer.close();
            state.demoPeer = null;
        }
    }
}

els.startCallBtn?.addEventListener('click', startCall);
els.hangupBtn?.addEventListener('click', hangUp);
els.muteBtn?.addEventListener('click', toggleMute);
els.speakerBtn?.addEventListener('click', toggleSpeaker);
els.cameraBtn?.addEventListener('click', toggleCamera);
els.recordBtn?.addEventListener('click', toggleRecording);
els.copyCodeBtn?.addEventListener('click', copyCallCode);
els.themeToggleBtn?.addEventListener('click', toggleTheme);
els.demoCallBtn?.addEventListener('click', startDemoCall);
els.clearHistoryBtn?.addEventListener('click', clearCallHistory);
els.referBtn?.addEventListener('click', sendSipRefer);
initDialpad();
initLocalMedia().catch(() => {
    // permission denied handled in initLocalMedia
});

setDialTargetLabel('None');
setRecordingStateLabel('Off');
setSessionStateLabel('Idle');
initTheme();
setUserPresence('online');
setReferButtonState(false);
if (hasSipStack(true)) {
    initSipStack();
} else {
    updateSipStatus('disabled', 'Provide SIP credentials to enable SIP calling');
}

callHistory = loadCallHistory();
renderCallHistory();

addCallHistoryEntry({
    label: 'Console ready',
    details: 'Dashboard booted',
});

document.addEventListener('visibilitychange', () => {
    setUserPresence(document.hidden ? 'away' : 'online');
});

window.addEventListener('beforeunload', () => {
    setUserPresence('offline');
});

els.logoutForm?.addEventListener('submit', () => {
    setUserPresence('offline');
});

})();
