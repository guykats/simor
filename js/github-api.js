// ==============================
// Hostinger API wrapper
// Replaces GitHub Contents API — no token needed
// ==============================

const API_URL = 'https://guykats.com/simor/api.php';

// Public read — used by leaderboard page
async function fetchData() {
  const res = await fetch(API_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Admin save — password checked server-side in PHP
async function saveData(password, data) {
  data.lastUpdated = new Date().toISOString();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, data })
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(result.error || `HTTP ${res.status}`);
  }

  return result;
}

// Validate admin password against the server
async function validatePassword(password) {
  // Send an empty data object — server will reject wrong password with 401
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, data: null })
  });

  if (res.status === 401) throw new Error('סיסמה שגויה');
  // 400 (null data) means password was accepted — that's fine for validation
}
