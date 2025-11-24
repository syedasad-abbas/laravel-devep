import axios from 'axios';

(() => {
const appRoot = document.getElementById('call-app');

if (!appRoot) {
    return;
}

const els = {
    dialInput: document.getElementById('dialInput'),
    startCallBtn: document.getElementById('startCallBtn'),
    joinCodeInput: document.getElementById('joinCodeInput'),
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
};

const state = {
    callCode: null,
    role: null,
    peer: null,
    pollTimer: null,
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
};

const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const THEME_KEY = 'call-console-theme';
let dialpadOpen = false;
let toneContext;

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

# Audio assets for demo call
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

function updateCallStatus(text, meta = '', variant = 'idle') {
    els.statusText.textContent = text;
    els.statusMeta.textContent = meta;
    els.statusDot.classList.remove('status-dot--idle', 'status-dot--online', 'status-dot--live');
    setSessionStateLabel(text);

    const variantClass =
        variant === 'active' ? 'status-dot--live' : variant === 'pending' ? 'status-dot--online' : 'status-dot--idle';
    els.statusDot.classList.add(variantClass);
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
        axios
            .post(`/call-sessions/${state.callCode}/candidate`, {
                candidate,
                role,
            })
            .catch(() => {
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
    if (!navigator.mediaDevices) {
        updateCallStatus('Unsupported browser', 'WebRTC requires secure context');
        return;
    }

    try {
        updateCallStatus('Creating session...', '', 'pending');
        const dialedNumber = els.dialInput.value.trim();
        setDialTargetLabel(dialedNumber || 'Share code only');
        const { data } = await axios.post('/call-sessions', {
            dialed_number: dialedNumber || null,
        });

        setCallCode(data.call_code);
        logEvent(`Session ${data.call_code} created`);

        await preparePeer('offer');

        const offer = await state.peer.createOffer();
        await state.peer.setLocalDescription(offer);
        await axios.post(`/call-sessions/${state.callCode}/offer`, {
            offer: {
                type: state.peer.localDescription.type,
                sdp: state.peer.localDescription.sdp,
            },
            dialed_number: dialedNumber || null,
        });

        updateCallStatus('Calling...', dialedNumber ? `Dialing ${dialedNumber}` : 'Waiting for partner', 'pending');
        startPolling();
    } catch (error) {
        updateCallStatus('Unable to start call', 'Check media permissions', 'idle');
        logEvent('Start call failed');
        resetSession();
    }
}

async function joinCall() {
    const code = clampCode(els.joinCodeInput.value || '');
    if (!code) {
        updateCallStatus('Code required', 'Enter a valid session code');
        return;
    }

    try {
        const { data } = await axios.get(`/call-sessions/${code}`);
        if (!data.offer) {
            updateCallStatus('No offer found', 'Creator has not started call yet');
            return;
        }

        setCallCode(code);
        setDialTargetLabel(data.dialed_number || `Code ${code}`);
        await preparePeer('answer');
        await state.peer.setRemoteDescription(data.offer);

        if (Array.isArray(data.offer_candidates)) {
            await applyCandidates('offer', data.offer_candidates);
        }

        const answer = await state.peer.createAnswer();
        await state.peer.setLocalDescription(answer);
        await axios.post(`/call-sessions/${code}/answer`, {
            answer: {
                type: state.peer.localDescription.type,
                sdp: state.peer.localDescription.sdp,
            },
        });

        updateCallStatus('Answer sent', 'Waiting for media', 'pending');
        startPolling();
    } catch (error) {
        updateCallStatus('Join failed', 'Confirm the code and try again');
        resetSession();
    }
}

function startPolling() {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
    }

    const poll = async () => {
        if (!state.callCode) {
            return;
        }

        try {
            const { data } = await axios.get(`/call-sessions/${state.callCode}`);
            reflectServerStatus(data);

            if (state.role === 'offer' && data.answer && !state.remoteDescriptionApplied) {
                await state.peer.setRemoteDescription(data.answer);
                state.remoteDescriptionApplied = true;
                logEvent('Answer applied');
            }

            if (state.role === 'offer' && Array.isArray(data.answer_candidates)) {
                await applyCandidates('answer', data.answer_candidates);
            }

            if (state.role === 'answer' && Array.isArray(data.offer_candidates)) {
                await applyCandidates('offer', data.offer_candidates);
            }

            if (data.status === 'ended') {
                updateCallStatus('Remote left', 'Session closed');
                resetSession(false);
            }
        } catch (error) {
            logEvent('Polling failed; retrying...');
        }
    };

    poll();
    state.pollTimer = setInterval(poll, 2500);
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
    const hadSession = state.isDemo || state.callCode || state.peer;
    if (!hadSession) {
        return;
    }

    if (state.isDemo) {
        logEvent('Demo call ended');
    } else if (state.callCode) {
        try {
            await axios.post(`/call-sessions/${state.callCode}/status`, {
                status: 'ended',
            });
        } catch (_) {
            // ignore
        }
    }

    if (state.recorder && state.isRecording) {
        state.recorder.stop();
    }

    updateCallStatus('Call ended', 'Session reset');
    logEvent('Call ended locally');
    resetSession();
    setDialTargetLabel('None');
    stopDemoAudio();
}

function resetSession(clearCode = true) {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }

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

    els.joinCodeInput.value = '';
    els.hangupBtn.disabled = true;
    setSessionStateLabel('Idle');
    if (!state.isRecording) {
        setRecordingStateLabel('Off');
    }
    if (!els.dialInput.value.trim()) {
        setDialTargetLabel('None');
    }

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
initDialpad();
initLocalMedia().catch(() => {
    // permission denied handled in initLocalMedia
});

setDialTargetLabel('None');
setRecordingStateLabel('Off');
setSessionStateLabel('Idle');
initTheme();

})();
