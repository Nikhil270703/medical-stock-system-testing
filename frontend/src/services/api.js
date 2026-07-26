let apiBase =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';
let gatewayHeaders = {};

const api = axios.create({
  baseURL: apiBase
});

// Interceptor to inject tokens dynamically
api.interceptors.request.use((config) => {
  // 1. If we are running in standalone mode (no gateway token), look for MERN JWT token
  if (!gatewayHeaders.authToken) {
    const token = localStorage.getItem('sis_jwt_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // 2. If we have host gateway headers, attach them
  if (gatewayHeaders.authToken) {
    config.headers['X-Internal-Token'] = gatewayHeaders.authToken;
  }
  if (gatewayHeaders.tenantCode) {
    config.headers['X-Tenant-Id'] = gatewayHeaders.tenantCode;
    config.headers['X-Tenant-Code'] = gatewayHeaders.tenantCode;
  }
  if (gatewayHeaders.permissions) {
    config.headers['X-Permissions'] = gatewayHeaders.permissions.join(',');
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Initialize with host environment context
export const initApi = (runtimeCtx) => {
  if (runtimeCtx) {
    if (runtimeCtx.apiBaseUrl) {
      api.defaults.baseURL = runtimeCtx.apiBaseUrl;
    }
    gatewayHeaders = {
      authToken: runtimeCtx.authToken,
      tenantCode: runtimeCtx.tenant?.code,
      permissions: runtimeCtx.permissions || ['result_analysis.view', 'result_analysis.create', 'result_analysis.update', 'result_analysis.delete', 'result_analysis.admin'],
    };
  }
};

export default api;
