// ==============================
// Admin panel logic
// ==============================

let adminPassword = null;
let appData       = null;

// ===== AUTH =====

async function login() {
  const pwd = document.getElementById('passwordInput').value.trim();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');

  if (!pwd) return;

  btn.disabled    = true;
  btn.textContent = 'מתחבר...';
  err.style.display = 'none';

  try {
    await validatePassword(pwd);  // checks against server
  } catch (e) {
    err.textContent   = e.message || 'סיסמה שגויה';
    err.style.display = 'block';
    btn.disabled      = false;
    btn.textContent   = 'כניסה';
    return;
  }

  adminPassword = pwd;
  sessionStorage.setItem('bgPwd', pwd);

  try {
    appData = await fetchData();
  } catch (_) {
    appData = { players: [], matches: [], lastUpdated: null };
  }

  showPanel();
  btn.disabled    = false;
  btn.textContent = 'כניסה';
}

function logout() {
  adminPassword = null;
  appData       = null;
  sessionStorage.removeItem('bgPwd');
  document.getElementById('mainPanel').style.display  = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
}

function showPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainPanel').style.display   = 'block';
  renderPlayersList();
  renderMatchesList();
  updatePlayerSelects();
  setDefaultDate();
}

// ===== SAVE =====

async function persist() {
  const indicator = document.getElementById('saveIndicator');
  indicator.style.display = 'block';
  try {
    await saveData(adminPassword, appData);
  } catch (e) {
    alert(`שגיאה בשמירה: ${e.message}`);
    throw e;
  } finally {
    indicator.style.display = 'none';
  }
}

// ===== TABS =====

function showTab(tab) {
  document.getElementById('playersTab').style.display  = tab === 'players' ? 'block' : 'none';
  document.getElementById('matchesTab').style.display  = tab === 'matches' ? 'block' : 'none';
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

  document.getElementById('editPlayerId').value     = id;
  document.getElementById('playerName').value        = p.name;
  document.getElementById('playerFormTitle').textContent = 'עריכת שחקן';
  document.getElementById('cancelPlayerBtn').style.display = 'inline-block';

  editingAvatarData = undefined;
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

let editingAvatarData = undefined;

function cancelPlayerEdit() {
  document.getElementById('editPlayerId').value  = '';
  document.getElementById('playerName').value     = '';
  document.getElementById('avatarInput').value    = '';
  document.getElementById('avatarPreview').innerHTML = '';
  document.getElementById('playerFormTitle').textContent = 'הוספת שחקן';
  document.getElementById('cancelPlayerBtn').style.display = 'none';
  document.getElementById('clearAvatarBtn').style.display  = 'none';
  editingAvatarData = undefined;
}

function previewAvatar(input) {
  if (!input.files[0]) return;
  openCropper(URL.createObjectURL(input.files[0]));
}

function clearAvatar() {
  editingAvatarData = null;
  document.getElementById('avatarInput').value = '';
  document.getElementById('clearAvatarBtn').style.display = 'none';
  const name = document.getElementById('playerName').value.trim();
  document.getElementById('avatarPreview').innerHTML = name ? getInitialsAvatar(name, 80) : '';
}

async function savePlayer() {
  const name   = document.getElementById('playerName').value.trim();
  if (!name) { alert('יש להזין שם שחקן'); return; }

  const editId = document.getElementById('editPlayerId').value;

  if (editId) {
    const p = appData.players.find(x => x.id === editId);
    if (p) {
      p.name = name;
      if (editingAvatarData !== undefined) p.avatar = editingAvatarData;
    }
  } else {
    appData.players.push({ id: generateId(), name, avatar: editingAvatarData || null });
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
  const options = appData.players
    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');
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
        const p1    = appData.players.find(p => p.id === m.player1Id) || { name: '?' };
        const p2    = appData.players.find(p => p.id === m.player2Id) || { name: '?' };
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
              <button onclick="startEditMatch('${m.id}')" class="btn btn-sm btn-outline-secondary">✏️</button>
              <button onclick="deleteMatch('${m.id}')"    class="btn btn-sm btn-outline-danger">🗑️</button>
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

  document.getElementById('editMatchId').value    = id;
  document.getElementById('matchPlayer1').value   = m.player1Id;
  document.getElementById('matchPlayer2').value   = m.player2Id;
  document.getElementById('score1').value          = m.score1;
  document.getElementById('score2').value          = m.score2;
  document.getElementById('matchDate').value       = m.date || '';
  document.getElementById('matchFormTitle').textContent  = 'עריכת תוצאה';
  document.getElementById('cancelMatchBtn').style.display = 'inline-block';
  document.getElementById('matchError').style.display     = 'none';
  document.getElementById('score1').focus();
  document.getElementById('score1').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelMatchEdit() {
  document.getElementById('editMatchId').value  = '';
  document.getElementById('matchPlayer1').value = '';
  document.getElementById('matchPlayer2').value = '';
  document.getElementById('score1').value        = '';
  document.getElementById('score2').value        = '';
  setDefaultDate();
  document.getElementById('matchFormTitle').textContent  = 'הוספת תוצאה';
  document.getElementById('cancelMatchBtn').style.display = 'none';
  document.getElementById('matchError').style.display     = 'none';
}

async function saveMatch() {
  const p1Id = document.getElementById('matchPlayer1').value;
  const p2Id = document.getElementById('matchPlayer2').value;
  const s1   = parseInt(document.getElementById('score1').value);
  const s2   = parseInt(document.getElementById('score2').value);
  const date = document.getElementById('matchDate').value;

  document.getElementById('matchError').style.display = 'none';

  if (!p1Id || !p2Id)                              { showMatchError('יש לבחור שני שחקנים'); return; }
  if (p1Id === p2Id)                               { showMatchError('לא ניתן לבחור אותו שחקן פעמיים'); return; }
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0){ showMatchError('ניקוד לא תקין'); return; }
  if (s1 === s2)                                   { showMatchError('התוצאה חייבת להיות שונה (לא תיקו)'); return; }

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

// ===== IMAGE CROPPER =====

const CROP_SIZE = 280; // diameter of the crop circle (px)

const _c = {   // crop state
  x: 0, y: 0,
  scale: 1, minScale: 1,
  imgW: 0, imgH: 0,
  dragging: false,
  lastX: 0, lastY: 0,
  lastDist: 0,
  objectUrl: null,
};

function openCropper(src) {
  if (_c.objectUrl) URL.revokeObjectURL(_c.objectUrl);
  _c.objectUrl = src;

  const modal = document.getElementById('cropModal');
  const img   = document.getElementById('cropImg');

  modal.style.display = 'flex';
  img.src = src;

  img.onload = () => {
    _c.imgW = img.naturalWidth;
    _c.imgH = img.naturalHeight;

    // Initial scale: cover the circle
    _c.scale    = Math.max(CROP_SIZE / _c.imgW, CROP_SIZE / _c.imgH);
    _c.minScale = _c.scale;

    // Center image inside container
    _c.x = (CROP_SIZE - _c.imgW * _c.scale) / 2;
    _c.y = (CROP_SIZE - _c.imgH * _c.scale) / 2;

    _cropApply();
  };
}

function _cropApply() {
  document.getElementById('cropImg').style.transform =
    `translate(${_c.x}px,${_c.y}px) scale(${_c.scale})`;
}

function _cropClamp() {
  _c.x = Math.min(0, Math.max(CROP_SIZE - _c.imgW * _c.scale, _c.x));
  _c.y = Math.min(0, Math.max(CROP_SIZE - _c.imgH * _c.scale, _c.y));
}

function _cropZoom(factor, cx = CROP_SIZE / 2, cy = CROP_SIZE / 2) {
  const newScale = Math.max(_c.minScale, _c.scale * factor);
  const f = newScale / _c.scale;
  _c.x     = cx + (_c.x - cx) * f;
  _c.y     = cy + (_c.y - cy) * f;
  _c.scale = newScale;
  _cropClamp();
  _cropApply();
}

function confirmCrop() {
  const img    = document.getElementById('cropImg');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Map container (0,0) back to image coords
  const sx    = -_c.x / _c.scale;
  const sy    = -_c.y / _c.scale;
  const sSize = CROP_SIZE / _c.scale;

  ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 256, 256);

  editingAvatarData = canvas.toDataURL('image/jpeg', 0.88);
  document.getElementById('avatarPreview').innerHTML =
    `<img src="${editingAvatarData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover">`;
  document.getElementById('clearAvatarBtn').style.display = 'inline-block';

  _closeCropper();
}

function cancelCrop() {
  _closeCropper();
}

function _closeCropper() {
  document.getElementById('cropModal').style.display = 'none';
  document.getElementById('avatarInput').value = '';
  if (_c.objectUrl) { URL.revokeObjectURL(_c.objectUrl); _c.objectUrl = null; }
}

function _setupCropper() {
  const container = document.getElementById('cropContainer');

  // Mouse
  container.addEventListener('mousedown', e => {
    e.preventDefault();
    _c.dragging = true;
    _c.lastX = e.clientX; _c.lastY = e.clientY;
    container.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!_c.dragging) return;
    _c.x += e.clientX - _c.lastX;
    _c.y += e.clientY - _c.lastY;
    _c.lastX = e.clientX; _c.lastY = e.clientY;
    _cropClamp(); _cropApply();
  });
  window.addEventListener('mouseup', () => {
    _c.dragging = false;
    container.style.cursor = 'grab';
  });

  // Wheel zoom
  container.addEventListener('wheel', e => {
    e.preventDefault();
    const rect   = container.getBoundingClientRect();
    const cx     = e.clientX - rect.left;
    const cy     = e.clientY - rect.top;
    _cropZoom(e.deltaY < 0 ? 1.12 : 0.9, cx, cy);
  }, { passive: false });

  // Touch
  container.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      _c.dragging = true;
      _c.lastX = e.touches[0].clientX; _c.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      _c.dragging = false;
      _c.lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: false });

  container.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && _c.dragging) {
      _c.x += e.touches[0].clientX - _c.lastX;
      _c.y += e.touches[0].clientY - _c.lastY;
      _c.lastX = e.touches[0].clientX; _c.lastY = e.touches[0].clientY;
      _cropClamp(); _cropApply();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const rect = container.getBoundingClientRect();
      const cx   = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
      const cy   = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
      _cropZoom(dist / _c.lastDist, cx, cy);
      _c.lastDist = dist;
    }
  }, { passive: false });

  container.addEventListener('touchend', e => {
    if (e.touches.length === 0) _c.dragging = false;
  });

  // Buttons
  document.getElementById('cropZoomIn').addEventListener('click',  () => _cropZoom(1.15));
  document.getElementById('cropZoomOut').addEventListener('click', () => _cropZoom(0.88));
  document.getElementById('cropConfirmBtn').addEventListener('click', confirmCrop);
  document.getElementById('cropCancelBtn').addEventListener('click',  cancelCrop);
}

// ===== HELPERS =====

function showMatchError(msg) {
  const el = document.getElementById('matchError');
  el.textContent    = msg;
  el.style.display  = 'block';
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
window.addEventListener('load', async () => {
  _setupCropper();

  const saved = sessionStorage.getItem('bgPwd');
  if (!saved) return;

  adminPassword = saved;
  try {
    appData = await fetchData();
  } catch (_) {
    appData = { players: [], matches: [], lastUpdated: null };
  }
  showPanel();
});
