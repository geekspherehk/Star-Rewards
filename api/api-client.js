// Hostinger MySQL API Client
const API_BASE_URL = 'api';

class ApiClient {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getToken() {
        return this.token;
    }

    async request(action, data = {}) {
        const url = `${this.baseUrl}/index.php?action=${action}`;
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Request failed');
        }

        return result;
    }

    async register(email, password) {
        const result = await this.request('register', { email, password });
        if (result.token) {
            this.setToken(result.token);
            localStorage.setItem('user_id', result.user_id);
            localStorage.setItem('user_email', email);
        }
        return result;
    }

    async login(email, password) {
        const result = await this.request('login', { email, password });
        if (result.token) {
            this.setToken(result.token);
            localStorage.setItem('user_id', result.user_id);
            localStorage.setItem('user_email', result.email);
        }
        return result;
    }

    async logout() {
        this.setToken(null);
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('auth_token');
    }

    async getProfile() {
        return await this.request('getProfile');
    }

    async getBehaviors() {
        return await this.request('getBehaviors');
    }

    async addBehavior(description, points) {
        return await this.request('addBehavior', { description, points });
    }

    async getGifts() {
        return await this.request('getGifts');
    }

    async addGift(name, points, description = '') {
        return await this.request('addGift', { name, points, description });
    }

    async redeemGift(giftId) {
        return await this.request('redeemGift', { gift_id: giftId });
    }

    async getRedeemedGifts() {
        return await this.request('getRedeemedGifts');
    }

    async updateTheme(theme) {
        return await this.request('updateTheme', { theme });
    }

    async getUserConfig() {
        return await this.request('getUserConfig');
    }
}

const api = new ApiClient();
