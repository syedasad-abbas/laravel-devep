import axios from 'axios';

export default class SignalingClient {
    constructor(pollInterval = 2500) {
        this.listeners = {};
        this.pollInterval = pollInterval;
        this.pollTimer = null;
        this.callCode = null;
        this.role = null;
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
                console.error('[SignalingClient] listener error', error);
            }
        });
    }

    async createSession(payload) {
        const { data } = await axios.post('/call-sessions', payload);
        return data;
    }

    async sendOffer(callCode, payload) {
        return axios.post(`/call-sessions/${callCode}/offer`, payload);
    }

    async sendAnswer(callCode, payload) {
        return axios.post(`/call-sessions/${callCode}/answer`, payload);
    }

    async sendCandidate(callCode, role, candidate) {
        return axios.post(`/call-sessions/${callCode}/candidate`, {
            role,
            candidate,
        });
    }

    async updateStatus(callCode, status) {
        return axios.post(`/call-sessions/${callCode}/status`, { status });
    }

    async fetchSession(callCode) {
        const { data } = await axios.get(`/call-sessions/${callCode}`);
        return data;
    }

    async subscribe(callCode, role) {
        this.callCode = callCode;
        this.role = role;
        this.startPolling();
    }

    unsubscribe() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.callCode = null;
        this.role = null;
    }

    startPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }

        const poll = async () => {
            if (!this.callCode) {
                return;
            }
            try {
                const session = await this.fetchSession(this.callCode);
                this.emit('session', session);
            } catch (error) {
                this.emit('sessionError', error);
            }
        };

        poll();
        this.pollTimer = setInterval(poll, this.pollInterval);
    }
}
