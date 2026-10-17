// In-memory cache shared across SPA route mounts. It prevents the admin
// dashboard from falling back to an empty loading state when users navigate
// away and back, while a full browser reload still starts with fresh data.
const state = {
  requests: [],
  loaded: false,
  lastUpdated: '',
};

export function getAdminDashboardState() {
  return state;
}

export function updateAdminDashboardState(requests, lastUpdated = new Date().toISOString()) {
  state.requests = Array.isArray(requests) ? requests : [];
  state.loaded = true;
  state.lastUpdated = lastUpdated;
}
