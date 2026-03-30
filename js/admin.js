// ==============================
// Admin panel logic
// ==============================

let token = null;
let appData = null;
let dataSha = null;
let editingAvatarData = undefined; // undefined = not changed, null = removed, string = new image

// ===== AUTH =====

async function login() {
  const t = document.getElementById('tokenInput').value.trim();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');

  if (!t) return;

  btn.disabled = true;
  btn.textContent = 'מתחבר...';
  err.style.display = 'none';

  try {
    await validateToken(t);

    try {
      const result = await fetchDataAdmin(t);
      appData = result.data;
      dataSha = result.sha;
    } catch (e) {
      // data.json doesn't exist yet — initialize empty
      appData = { players: [], matches: [], lastUpdated: null };
      dataSha = null;
    }

    token = t;
    sessionStorage.setItem('bgToken', t);

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';

    renderPlayersList();
    renderMatchesList();
    updatePlayerSelects();
    setDefaultDate();
  } catch (e) {
    err.textContent = e.message || 'שגיאה בכניסה. בדוק את הטוקן.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'כניסה';
  }
}

function logout() {
  token = null;
  appData = null;
  dataSha = null;
  sessionStorage.removeItem('bgToken');
  document.getElementById('mainPanel').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('tokenInput').value = '';
}

async function persist() {
  const indicator = document.getElementById('saveIndicator');
  indicator.style.display = 'block';
  try {
    // Retry up to 3 times on SHA mismatch
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Always fetch the latest SHA before each attempt
        try {
          const fresh = await fetchDataAdmin(token);
          dataSha = fresh.sha;
        } catch (_) {
          // File doesn't exist yet (first save) — dataSha stays null
        }
        dataSha = await saveData(token, appData, dataSha);
        return; // success
      } catch (e) {
        const isShaConflict = e.message && (
          e.message.includes('does not match') ||
          e.message.includes('409') ||
          e.message.includes('conflict')
        );
        if (isShaConflict && attempt < 3) {
          await new Promise(r => setTimeout(r, 600 * attempt));
          continue; // retry
        }
        throw e;
      }
    }
  } catch (e) {
    alert(`שגיאה בשמירה: ${e.message}`);
    throw e;
  } finally {
    indicator.style.display = 'none';
  }
}

// ===== TABS =====

function showTab(tab) {
  document.getElementById('playersTab').style.display = tab === 'players' ? 'block' : 'none';
  document.getElementById('matchesTab').style.display = tab === 'matches' ? 'block' : 'none';
  document.querySelectorAll('#adminTabs .nav-link').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ===== PLAYERS =====

function renderPlayersList() {
  const container = document.getElementById('playersList');
  if (!appData.players.length) {
    container.innerHTML = '<p class="text-muted text-center py-4">אין שחקנים. הוסף שחקן ראשון!</p>';
    return;
  }
  container.innerHTML = `
    <div class="list-group">
      ${appData.players.map(p => `
        <div class="list-group-item d-flex align-items-center gap-3 py-3">
          ${getAvatarHtml(p, 44)}
          <span class="flex-grow-1 fw-semibold">${escapeHtml(p.name)}</span>
          <button onclick="startEditPlayer('${p.id}')" class="btn btn-sm btn-outline-secondary" title="עריכה">✏️</button>
          <button onclick="deletePlayer('${p.id}')" class="btn btn-sm btn-outline-danger" title="מחיקה">🗑️</button>
        </div>
      `).join('')}
    </div>
  `;
}

function startEditPlayer(id) {
  const p = appData.players.find(x => x.id === id);
  if (!p) return;

  document.getElementById('editPlayerId').value = id;
  document.getElementById('playerName').value = p.name;
  document.getElementById('playerFormTitle').textContent = 'עריכת שחקן';
  document.getElementById('cancelPlayerBtn').style.display = 'inline-block';

  editingAvatarData = undefined; // not changed yet
  const preview = document.getElementById('avatarPreview');
  if (p.avatar) {
    preview.innerHTML = `<img src="${p.avatar}" style="width:80px;height:80px;border-radius:50%;object-fit:cover">`;
    document.getElementById('clearAvatarBtn').style.display = 'inline-block';
  } else {
    preview.innerHTML = getInitialsAvatar(p.name, 80);
    document.getElementById('clearAvatarBtn').style.display = 'none';
  }

  document.getElementById('playerName').focus();
  document.getElementById('playerName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelPlayerEdit() {
  document.getElementById('editPlayerId').value = '';
  document.getElementById('playerName').value = '';
  document.getElementById('avatarInput').value = '';
  document.getElementById('avatarPreview').innerHTML = '';
  document.getElementById('playerFormTitle').textContent = 'הוספת שחקן';
  document.getElementById('cancelPlayerBtn').style.display = 'none';
  document.getElementById('clearAvatarBtn').style.display = 'none';
  editingAvatarData = undefined;
}

async function previewAvatar(input) {
  if (!input.files[0]) return;
  const compressed = await compressImage(input.files[0]);
  editingAvatarData = compressed;
  document.getElementById('avatarPreview').innerHTML =
    `<img src="${compressed}" style="width:80px;height:80px;border-radius:50%;object-fit:cover">`;
  document.getElementById('clearAvatarBtn').style.display = 'inline-block';
}

function clearAvatar() {
  editingAvatarData = null;
  document.getElementById('avatarInput').value = '';
  document.getElementById('clearAvatarBtn').style.display = 'none';
  const name = document.getElementById('playerName').value.trim();
  document.getElementById('avatarPreview').innerHTML = name ? getInitialsAvatar(name, 80) : '';
}

async function savePlayer() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) { alert('יש להזין שם שחקן'); return; }

  const editId = document.getElementById('editPlayerId').value;

  if (editId) {
    const p = appData.players.find(x => x.id === editId);
    if (p) {
      p.name = name;
      if (editingAvatarData !== undefined) p.avatar = editingAvatarData;
    }
  } else {
    appData.players.push({
      id: generateId(),
      name,
      avatar: editingAvatarData || null
    });
  }

  await persist();
  cancelPlayerEdit();
  renderPlayersList();
  updatePlayerSelects();
}

async function deletePlayer(id) {
  const p = appData.players.find(x => x.id === id);
  if (!p || !confirm(`למחוק את "${p.name}"? כל התוצאות שלו יימחקו גם כן.`)) return;

  appData.players = appData.players.filter(x => x.id !== id);
  appData.matches = appData.matches.filter(m => m.player1Id !== id && m.player2Id !== id);

  await persist();
  renderPlayersList();
  renderMatchesList();
  updatePlayerSelects();
}

// ===== MATCHES =====

function updatePlayerSelects() {
  const placeholder = '<option value="">-- בחר שחקן --</option>';
  const options = appData.players.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  document.getElementById('matchPlayer1').innerHTML = placeholder + options;
  document.getElementById('matchPlayer2').innerHTML = placeholder + options;
}

function renderMatchesList() {
  const container = document.getElementById('matchesList');
  if (!appData.matches.length) {
    container.innerHTML = '<p class="text-muted text-center py-4">אין תוצאות עדיין.</p>';
    return;
  }

  const sorted = [...appData.matches].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  container.innerHTML = `
    <div class="list-group">
      ${sorted.map(m => {
        const p1 = appData.players.find(p => p.id === m.player1Id) || { name: '?' };
        const p2 = appData.players.find(p => p.id === m.player2Id) || { name: '?' };
        const p1Won = parseInt(m.score1) > parseInt(m.score2);
        return `
          <div class="list-group-item py-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="text-${p1Won ? 'success' : 'muted'} fw-semibold text-center" style="flex:1">
                ${escapeHtml(p1.name)} ${p1Won ? '🏆' : ''}
              </div>
              <div class="text-center px-3">
                <span class="fs-5 fw-bold">${m.score1} – ${m.score2}</span>
                <div class="text-muted small">${formatDate(m.date)}</div>
              </div>
              <div class="text-${!p1Won ? 'success' : 'muted'} fw-semibold text-center" style="flex:1">
                ${!p1Won ? '🏆' : ''} ${escapeHtml(p2.name)}
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-2">
              <button onclick="startEditMatch('${m.id}')" class="btn btn-sm btn-outline-secondary" title="עריכה">✏️</button>
              <button onclick="deleteMatch('${m.id}')" class="btn btn-sm btn-outline-danger" title="מחיקה">🗑️</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function startEditMatch(id) {
  const m = appData.matches.find(x => x.id === id);
  if (!m) return;

  document.getElementById('editMatchId').value = id;
  document.getElementById('matchPlayer1').value = m.player1Id;
  document.getElementById('matchPlayer2').value = m.player2Id;
  document.getElementById('score1').value = m.score1;
  document.getElementById('score2').value = m.score2;
  document.getElementById('matchDate').value = m.date || '';
  document.getElementById('matchFormTitle').textContent = 'עריכת תוצאה';
  document.getElementById('cancelMatchBtn').style.display = 'inline-block';
  document.getElementById('matchError').style.display = 'none';
  document.getElementById('score1').focus();
  document.getElementById('score1').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelMatchEdit() {
  document.getElementById('editMatchId').value = '';
  document.getElementById('matchPlayer1').value = '';
  document.getElementById('matchPlayer2').value = '';
  document.getElementById('score1').value = '';
  document.getElementById('score2').value = '';
  setDefaultDate();
  document.getElementById('matchFormTitle').textContent = 'הוספת תוצאה';
  document.getElementById('cancelMatchBtn').style.display = 'none';
  document.getElementById('matchError').style.display = 'none';
}

async function saveMatch() {
  const p1Id = document.getElementById('matchPlayer1').value;
  const p2Id = document.getElementById('matchPlayer2').value;
  const s1 = parseInt(document.getElementById('score1').value);
  const s2 = parseInt(document.getElementById('score2').value);
  const date = document.getElementById('matchDate').value;
  const errEl = document.getElementById('matchError');

  errEl.style.display = 'none';

  if (!p1Id || !p2Id) { showMatchError('יש לבחור שני שחקנים'); return; }
  if (p1Id === p2Id) { showMatchError('לא ניתן לבחור אותו שחקן פעמיים'); return; }
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { showMatchError('ניקוד לא תקין'); return; }
  if (s1 === s2) { showMatchError('התוצאה חייבת להיות שונה (לא תיקו)'); return; }

  const editId = document.getElementById('editMatchId').value;

  if (editId) {
    const m = appData.matches.find(x => x.id === editId);
    if (m) Object.assign(m, { player1Id: p1Id, player2Id: p2Id, score1: s1, score2: s2, date });
  } else {
    appData.matches.push({ id: generateId(), player1Id: p1Id, player2Id: p2Id, score1: s1, score2: s2, date });
  }

  await persist();
  cancelMatchEdit();
  renderMatchesList();
}

async function deleteMatch(id) {
  if (!confirm('למחוק תוצאה זו?')) return;
  appData.matches = appData.matches.filter(x => x.id !== id);
  await persist();
  renderMatchesList();
}

// ===== HELPERS =====

function showMatchError(msg) {
  const el = document.getElementById('matchError');
  el.textContent = msg;
  el.style.display = 'block';
}

function setDefaultDate() {
  document.getElementById('matchDate').value = new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auto-login from session
window.addEventListener('load', () => {
  const saved = sessionStorage.getItem('bgToken');
  if (saved) {
    document.getElementById('tokenInput').value = saved;
    login();
  }
});
