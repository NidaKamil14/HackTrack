/**
 * HackTrack Frontend API Client
 *
 * Provides a unified interface for all frontend-to-backend API calls.
 * Automatically attaches JWT Bearer tokens and handles errors.
 *
 * When the backend is unreachable, the frontend continues to operate
 * with its existing localStorage-based mock services for development.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api/v1';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    try {
      const stored = localStorage.getItem('hacktrack_jwt_token');
      return stored || null;
    } catch {
      return null;
    }
  }

  setToken(token) {
    try {
      localStorage.setItem('hacktrack_jwt_token', token);
    } catch (err) {
      console.error('Failed to store auth token:', err);
    }
  }

  clearToken() {
    try {
      localStorage.removeItem('hacktrack_jwt_token');
    } catch {
      // Ignore storage errors on clear
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || `API Error: ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err; // Re-throw structured API errors

      // Network error — backend is unreachable
      console.warn(`[API] Backend unreachable at ${url}:`, err.message);
      const networkError = new Error('Backend server is not available. Using offline mode.');
      networkError.status = 0;
      networkError.isNetworkError = true;
      throw networkError;
    }
  }

  // ── Auth (FR-1 to FR-5) ──────────────────────────────────────────────

  async register({ email, password, fullName, role, university, memberId }) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, role, university, memberId }),
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async login({ email, password }) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  logout() {
    this.clearToken();
  }

  // ── Hackathons (FR-6 to FR-11) ───────────────────────────────────────

  async getHackathons(status = null) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/hackathons${query}`);
  }

  async getHackathon(id) {
    return this.request(`/hackathons/${id}`);
  }

  async createHackathon(data) {
    return this.request('/hackathons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHackathon(id, updates) {
    return this.request(`/hackathons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteHackathon(id) {
    return this.request(`/hackathons/${id}`, {
      method: 'DELETE',
    });
  }

  async publishHackathon(id) {
    return this.request(`/hackathons/${id}/publish`, {
      method: 'POST',
    });
  }

  async updateCriteria(hackathonId, criteria) {
    return this.request(`/hackathons/${hackathonId}/criteria`, {
      method: 'POST',
      body: JSON.stringify({ criteria }),
    });
  }

  // ── Teams (FR-12 to FR-16) ───────────────────────────────────────────

  async getTeams(hackathonId) {
    return this.request(`/teams?hackathonId=${hackathonId}`);
  }

  async getTeam(teamId) {
    return this.request(`/teams/${teamId}`);
  }

  async createTeam({ hackathonId, teamName, track }) {
    return this.request('/teams', {
      method: 'POST',
      body: JSON.stringify({ hackathonId, teamName, track }),
    });
  }

  async joinTeam(teamCode) {
    return this.request('/teams/join', {
      method: 'POST',
      body: JSON.stringify({ teamCode }),
    });
  }

  async respondToJoinRequest(teamId, requestId, action) {
    return this.request(`/teams/${teamId}/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    });
  }

  // ── Submissions (FR-17 to FR-21) ─────────────────────────────────────

  async getSubmissions(hackathonId) {
    return this.request(`/submissions?hackathonId=${hackathonId}`);
  }

  async getSubmission(id) {
    return this.request(`/submissions/${id}`);
  }

  async getSubmissionByTeam(teamId) {
    return this.request(`/submissions/team/${teamId}`);
  }

  async submitProject(data) {
    return this.request('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Evaluations (FR-22 to FR-31) ─────────────────────────────────────

  async assignJudge({ hackathonId, judgeId, submissionId }) {
    return this.request('/evaluations/assign', {
      method: 'POST',
      body: JSON.stringify({ hackathonId, judgeId, submissionId }),
    });
  }

  async getAssignedSubmissions() {
    return this.request('/evaluations/assigned');
  }

  async submitEvaluation({ hackathonId, submissionId, scores, remarks }) {
    return this.request('/evaluations', {
      method: 'POST',
      body: JSON.stringify({ hackathonId, submissionId, scores, remarks }),
    });
  }

  async getLeaderboard(hackathonId) {
    return this.request(`/evaluations/leaderboard/${hackathonId}`);
  }

  async publishResults(hackathonId) {
    return this.request(`/evaluations/publish-results/${hackathonId}`, {
      method: 'POST',
    });
  }

  // ── Certificates (FR-32 to FR-34) ────────────────────────────────────

  async getMyCertificates() {
    return this.request('/certificates/my-certificates');
  }

  async verifyCertificate(code) {
    return this.request(`/certificates/verify/${code}`);
  }

  // ── Admin (FR-40 to FR-46) ───────────────────────────────────────────

  async getUsers() {
    return this.request('/admin/users');
  }

  async updateUserRole(userId, role) {
    return this.request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async getSystemStats() {
    return this.request('/admin/stats');
  }

  async getHackathonReport(hackathonId) {
    return this.request(`/admin/reports/hackathon/${hackathonId}`);
  }

  async getAnnouncements(hackathonId = null) {
    const query = hackathonId ? `?hackathonId=${hackathonId}` : '';
    return this.request(`/admin/announcements${query}`);
  }

  async createAnnouncement({ hackathonId, title, content, targetRole }) {
    return this.request('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ hackathonId, title, content, targetRole }),
    });
  }

  // ── Utility ──────────────────────────────────────────────────────────

  async checkHealth() {
    try {
      const data = await this.request('/health');
      return { online: true, ...data };
    } catch {
      return { online: false };
    }
  }
}

// Singleton API client instance
export const api = new ApiClient();
export default api;
