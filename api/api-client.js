// Hostinger MySQL API Client v2 (security hardening)
const API_BASE_URL = 'api';
const TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';
const USER_ID_KEY = 'user_id';
const USER_EMAIL_KEY = 'user_email';
const REFRESH_THRESHOLD = 5 * 60 * 1000;

class ApiClient {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem(TOKEN_KEY);
        this.tokenExpiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
        this._refreshPromise = null;
        this.selectedProfileId = parseInt(localStorage.getItem('selected_profile_id') || '0', 10) || null;
    }

    setSelectedProfileId(id) {
        this.selectedProfileId = id ? parseInt(id, 10) : null;
        if (this.selectedProfileId) {
            localStorage.setItem('selected_profile_id', String(this.selectedProfileId));
        } else {
            localStorage.removeItem('selected_profile_id');
        }
    }

    setToken(token, expiresIn = null) {
        this.token = token;
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
            if (expiresIn) {
                this.tokenExpiry = Date.now() + expiresIn * 1000;
                localStorage.setItem(TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
            }
        } else {
            this.tokenExpiry = 0;
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(TOKEN_EXPIRY_KEY);
        }
    }

    getToken() {
        return this.token;
    }

    _isTokenExpiringSoon() {
        if (!this.token || !this.tokenExpiry) return false;
        return Date.now() + REFRESH_THRESHOLD >= this.tokenExpiry;
    }

    _decodeTokenPayload(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padding = '='.repeat((4 - payloadB64.length % 4) % 4);
            return JSON.parse(atob(payloadB64 + padding));
        } catch (e) {
            return null;
        }
    }

    async refreshTokenIfNeeded() {
        if (!this.token) return false;
        if (!this._isTokenExpiringSoon()) return false;

        if (this._refreshPromise) {
            return this._refreshPromise;
        }

        this._refreshPromise = (async () => {
            try {
                const url = `${this.baseUrl}/index.php?action=refreshToken`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({})
                });
                if (!response.ok) throw new Error('Refresh failed');
                const result = await response.json();
                if (result.token) {
                    this.setToken(result.token, result.expires_in);
                }
                return true;
            } catch (e) {
                this.setToken(null);
                return false;
            } finally {
                this._refreshPromise = null;
            }
        })();

        return this._refreshPromise;
    }

    async request(action, data = {}) {
        if (action !== 'login' && action !== 'register') {
            await this.refreshTokenIfNeeded();
        }

        const url = `${this.baseUrl}/index.php?action=${action}`;
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
        } catch (networkErr) {
            throw new Error('Network error. Please check your connection.');
        }

        let result;
        try {
            result = await response.json();
        } catch (parseErr) {
            if (!response.ok) {
                if (response.status === 401) {
                    this.setToken(null);
                    throw new Error('Session expired. Please log in again.');
                }
                throw new Error(`Request failed (${response.status})`);
            }
            throw new Error('Invalid server response');
        }

        if (!response.ok) {
            if (response.status === 401) {
                this.setToken(null);
                localStorage.removeItem(USER_ID_KEY);
                localStorage.removeItem(USER_EMAIL_KEY);
            }
            throw new Error(result.error || 'Request failed');
        }

        return result;
    }

    async register(email, password) {
        const result = await this.request('register', { email, password });
        if (result.token) {
            this.setToken(result.token, result.expires_in);
            localStorage.setItem(USER_ID_KEY, String(result.user_id));
            localStorage.setItem(USER_EMAIL_KEY, email);
        }
        return result;
    }

    async login(email, password) {
        const result = await this.request('login', { email, password });
        if (result.token) {
            this.setToken(result.token, result.expires_in);
            localStorage.setItem(USER_ID_KEY, String(result.user_id));
            localStorage.setItem(USER_EMAIL_KEY, result.email || email);
        }
        return result;
    }

    async logout() {
        try {
            if (this.token) {
                await this.request('logout');
            }
        } catch (e) {
        } finally {
            this.setToken(null);
            localStorage.removeItem(USER_ID_KEY);
            localStorage.removeItem(USER_EMAIL_KEY);
        }
    }

    async getProfile() {
        return await this.request('getProfile', { profile_id: this.selectedProfileId });
    }

    async getProfiles() {
        return await this.request('getProfiles');
    }

    async addProfile(name, avatar = '⭐', color = '#FFB300') {
        return await this.request('addProfile', { name, avatar, color });
    }

    async updateProfile(profileId, fields = {}) {
        return await this.request('updateProfile', Object.assign({ profile_id: profileId }, fields));
    }

    async deleteProfile(profileId) {
        return await this.request('deleteProfile', { profile_id: profileId });
    }

    async setSelectedProfile(profileId) {
        const result = await this.request('setSelectedProfile', { profile_id: profileId });
        if (result && result.success) {
            this.setSelectedProfileId(profileId);
        }
        return result;
    }

    async getBehaviors() {
        return await this.request('getBehaviors', { profile_id: this.selectedProfileId });
    }

    async addBehavior(description, points) {
        return await this.request('addBehavior', { description, points, profile_id: this.selectedProfileId });
    }

    async getGifts() {
        return await this.request('getGifts', { profile_id: this.selectedProfileId });
    }

    async addGift(name, points, description = '', imageUrl = '', originalUrl = '') {
        return await this.request('addGift', {
            name,
            points,
            description,
            image_url: imageUrl,
            original_url: originalUrl,
            profile_id: this.selectedProfileId
        });
    }

    async redeemGift(giftId) {
        return await this.request('redeemGift', { gift_id: giftId, profile_id: this.selectedProfileId });
    }

    async getRedeemedGifts() {
        return await this.request('getRedeemedGifts', { profile_id: this.selectedProfileId });
    }

    async deleteBehavior(behaviorId) {
        return await this.request('deleteBehavior', { id: behaviorId });
    }

    async deleteGift(giftId) {
        return await this.request('deleteGift', { id: giftId });
    }

    async fetchProductInfo(url) {
        return await this.request('fetchProductInfo', { url });
    }

    async updateTheme(theme) {
        return await this.request('updateTheme', { theme });
    }

    async getUserConfig() {
        return await this.request('getUserConfig');
    }

    async resendConfirmation(email) {
        return { success: true, message: 'Email confirmation is not required in this version' };
    }
}

const api = new ApiClient();
