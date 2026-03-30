// ==============================
// GitHub API wrapper
// ==============================

async function fetchData() {
  const url = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${CONFIG.dataFile}?t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchDataAdmin(token) {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataFile}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const result = await res.json();
  const content = result.content.replace(/\n/g, '');
  return {
    data: JSON.parse(decodeURIComponent(escape(atob(content)))),
    sha: result.sha
  };
}

async function saveData(token, data, sha) {
  data.lastUpdated = new Date().toISOString();
  const jsonStr = JSON.stringify(data, null, 2);
  const content = btoa(unescape(encodeURIComponent(jsonStr)));

  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataFile}`;
  const body = {
    message: 'עדכון נתוני לוח התוצאות',
    content,
    branch: CONFIG.branch
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'שגיאה בשמירה');
  }

  const result = await res.json();
  return result.content.sha;
}

async function validateToken(token) {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) throw new Error('טוקן לא תקין או אין גישה לריפו');
}
