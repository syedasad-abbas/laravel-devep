import { Registerer, RegistererState, SessionState, UserAgent } from 'sip.js';

export default class SipClient {
    constructor(config = {}, iceServers = []) {
        this.config = config || {};
        this.iceServers = iceServers;
        this.userAgent = null;
        this.registerer = null;
        this.listeners = {};
        this.started = false;
        this.activeSession = null;
    }

    isEnabled() {
        return Boolean(this.config?.wssServer && this.config?.username && this.config?.domain);
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, payload) {
        (this.listeners[event] || []).forEach((callback) => {
            try {
                callback(payload);
            } catch (error) {
                console.error('[SipClient] listener error', error);
            }
        });
    }

    async start() {
        if (!this.isEnabled()) {
            throw new Error('SIP configuration incomplete');
        }
        if (this.started) {
            return;
        }

        this.setupUserAgent();

        await this.userAgent.start();
        this.registerer = new Registerer(this.userAgent);
        this.registerer.stateChange.addListener((newState) => {
            this.emit('registration', {
                state: newState,
                status: this.describeRegistererState(newState),
            });
        });

        await this.registerer.register();
        this.started = true;
    }

    async stop() {
        if (!this.started) {
            return;
        }

        try {
            if (this.registerer) {
                await this.registerer.unregister();
            }
        } catch (error) {
            this.emit('error', error);
        }

        await this.userAgent.stop();
        this.activeSession = null;
        this.started = false;
    }

    setupUserAgent() {
        if (this.userAgent) {
            return;
        }

        const baseUri =
            (this.config.uri && UserAgent.makeURI(this.config.uri)) ||
            UserAgent.makeURI(`sip:${this.config.username}@${this.config.domain}`);

        if (!baseUri) {
            throw new Error('Unable to build SIP URI from configuration.');
        }

        this.userAgent = new UserAgent({
            uri: baseUri,
            displayName: this.config.displayName || this.config.username,
            authorizationUsername: this.config.username,
            authorizationPassword: this.config.password,
            transportOptions: {
                server: this.config.wssServer,
            },
            sessionDescriptionHandlerFactoryOptions: {
                peerConnectionConfiguration: {
                    iceServers: this.iceServers,
                },
            },
        });

        this.userAgent.delegate = {
            onInvite: (invitation) => this.handleInvite(invitation),
            onConnect: () => this.emit('transport', { state: 'connected' }),
            onDisconnect: (error) => this.emit('transport', { state: 'disconnected', error }),
        };
    }

    handleInvite(invitation) {
        invitation.delegate = invitation.delegate || {};
        invitation.delegate.onRefer = (referral) => this.handleReferral(invitation, referral);

        invitation.stateChange.addListener((state) => {
            if (state === SessionState.Established) {
                this.activeSession = invitation;
            } else if (state === SessionState.Terminated && this.activeSession === invitation) {
                this.activeSession = null;
            }

            this.emit('sessionState', {
                invitation,
                state,
                status: this.describeSessionState(state),
            });
        });

        this.emit('invite', { invitation });
    }

    handleReferral(invitation, referral) {
        this.emit('refer', { invitation, referral });
    }

    async refer(target, options = {}) {
        if (!this.activeSession) {
            throw new Error('No active SIP session available for REFER');
        }
        return this.activeSession.refer(target, options);
    }

    describeRegistererState(state) {
        switch (state) {
            case RegistererState.Initial:
                return 'initial';
            case RegistererState.Registered:
                return 'registered';
            case RegistererState.Terminated:
                return 'terminated';
            case RegistererState.Unregistered:
                return 'unregistered';
            default:
                return 'unknown';
        }
    }

    describeSessionState(state) {
        switch (state) {
            case SessionState.Initial:
                return 'initial';
            case SessionState.Establishing:
                return 'establishing';
            case SessionState.Established:
                return 'established';
            case SessionState.Terminating:
                return 'terminating';
            case SessionState.Terminated:
                return 'terminated';
            default:
                return 'unknown';
        }
    }
}
