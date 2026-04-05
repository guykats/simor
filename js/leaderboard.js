// ==============================
// Public leaderboard page logic
// ==============================

let _players = [];
let _matches = [];

async function init() {
  try {
    const data = await fetchData();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    if (data.lastUpdated) {
      const d = new Date(data.lastUpdated);
      document.getElementById('lastUpdated').textContent =
        `עודכן: ${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    }

    _players = data.players || [];
    _matches = data.matches || [];

    const standings = calculateStandings(_players, _matches);
    renderStandings(standings);
    renderMatches(_matches, _players);
  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    console.error(e);
  }
}

function renderStandings(standings) {
  const tbody = document.getElementById('standingsBody');
  const medals = ['🥇', '🥈', '🥉'];

  if (standings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">אין שחקנים עדיין</td></tr>';
    return;
  }

  tbody.innerHTML = standings.map((s, i) => {
    const rank     = i < 3 ? medals[i] : `${i + 1}`;
    const rowClass = i === 0 ? 'row-gold' : i === 1 ? 'row-silver' : i === 2 ? 'row-bronze' : '';
    return `
      <tr class="${rowClass} player-row" onclick="showPlayerPopup('${s.player.id}')" title="לחץ לפרטים">
        <td class="rank-cell">${rank}</td>
        <td>
          <div class="player-cell">
            ${getAvatarHtml(s.player, 42)}
            <span class="player-name">${s.player.name}</span>
          </div>
        </td>
        <td>${s.matchesPlayed}</td>
        <td class="wins-cell">${s.wins}</td>
        <td class="losses-cell">${s.losses}</td>
        <td><span class="points-badge">${s.points}</span></td>
        <td class="tiebreak-cell">${s.gamesScored}</td>
      </tr>
    `;
  }).join('');
}

function renderMatches(matches, players) {
  const container = document.getElementById('matchesList');

  if (matches.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-3">אין תוצאות עדיין</p>';
    return;
  }

  const sorted = [...matches].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recent = sorted.slice(0, 20);

  container.innerHTML = recent.map(m => matchCardHtml(m, players)).join('');
}

function matchCardHtml(m, players) {
  const p1    = players.find(p => p.id === m.player1Id) || { name: '?', id: m.player1Id };
  const p2    = players.find(p => p.id === m.player2Id) || { name: '?', id: m.player2Id };
  const p1Won = parseInt(m.score1) > parseInt(m.score2);
  return `
    <div class="match-card">
      <div class="match-row">
        <div class="mp ${p1Won ? 'mp-win' : 'mp-lose'}">
          ${getAvatarHtml(p1, 36)}
          <span class="mp-name">${p1.name}${p1Won ? ' 🏆' : ''}</span>
          <span class="mp-score ${p1Won ? 'score-win' : 'score-lose'}">${m.score1}</span>
        </div>
        <div class="mc-sep">
          <span>–</span>
          ${m.date ? `<div class="mc-date">${formatDate(m.date)}</div>` : ''}
        </div>
        <div class="mp ${!p1Won ? 'mp-win' : 'mp-lose'}">
          <span class="mp-score ${!p1Won ? 'score-win' : 'score-lose'}">${m.score2}</span>
          <span class="mp-name">${!p1Won ? '🏆 ' : ''}${p2.name}</span>
          ${getAvatarHtml(p2, 36)}
        </div>
      </div>
    </div>
  `;
}

// ===== ADD MATCH POPUP =====

function openAddMatchPopup() {
  if (_players.length < 2) {
    alert('יש צורך בלפחות 2 שחקנים');
    return;
  }

  const opts = '<option value="">-- בחר שחקן --</option>' +
    _players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('addMatchP1').innerHTML = opts;
  document.getElementById('addMatchP2').innerHTML = opts;
  document.getElementById('addMatchDate').value   = new Date().toISOString().split('T')[0];
  document.getElementById('addMatchS1').value     = '';
  document.getElementById('addMatchS2').value     = '';
  document.getElementById('addMatchError').style.display = 'none';

  // Hide password field if already authenticated this session
  const savedPwd = sessionStorage.getItem('bgPwd');
  document.getElementById('addMatchPwdSection').style.display = savedPwd ? 'none' : 'block';
  if (!savedPwd) document.getElementById('addMatchPwd').value = '';

  document.getElementById('addMatchModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAddMatchPopup() {
  document.getElementById('addMatchModal').style.display = 'none';
  document.body.style.overflow = '';
}

async function submitAddMatch() {
  const p1Id = document.getElementById('addMatchP1').value;
  const p2Id = document.getElementById('addMatchP2').value;
  const s1   = parseInt(document.getElementById('addMatchS1').value);
  const s2   = parseInt(document.getElementById('addMatchS2').value);
  const date = document.getElementById('addMatchDate').value;
  const btn  = document.getElementById('addMatchBtn');

  const pwd  = sessionStorage.getItem('bgPwd') ||
               document.getElementById('addMatchPwd').value.trim();

  if (!pwd)                                       return _amErr('הזן סיסמה');
  if (!p1Id || !p2Id)                             return _amErr('יש לבחור שני שחקנים');
  if (p1Id === p2Id)                              return _amErr('לא ניתן לבחור אותו שחקן פעמיים');
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return _amErr('ניקוד לא תקין');
  if (s1 === s2)                                  return _amErr('אין תיקו — יש להכניס תוצאה שונה');

  // Duplicate check — same pair on same date
  const duplicate = _matches.find(m =>
    m.date === date &&
    ((m.player1Id === p1Id && m.player2Id === p2Id) ||
     (m.player1Id === p2Id && m.player2Id === p1Id))
  );
  if (duplicate) {
    const pa = _players.find(p => p.id === p1Id);
    const pb = _players.find(p => p.id === p2Id);
    return _amErr(`משחק בין ${pa?.name ?? ''} ל-${pb?.name ?? ''} כבר קיים בתאריך זה`);
  }

  btn.disabled    = true;
  btn.textContent = 'שומר...';
  document.getElementById('addMatchError').style.display = 'none';

  try {
    const updatedData = {
      players: _players,
      matches: [..._matches, {
        id: generateId(), player1Id: p1Id, player2Id: p2Id,
        score1: s1, score2: s2, date
      }]
    };

    await saveData(pwd, updatedData);
    sessionStorage.setItem('bgPwd', pwd);

    // Update in-memory state and re-render
    _matches = updatedData.matches;
    const standings = calculateStandings(_players, _matches);
    renderStandings(standings);
    renderMatches(_matches, _players);

    closeAddMatchPopup();
  } catch (e) {
    if (e.message && (e.message.includes('Unauthorized') || e.message.includes('401'))) {
      sessionStorage.removeItem('bgPwd');
      document.getElementById('addMatchPwdSection').style.display = 'block';
      _amErr('סיסמה שגויה');
    } else {
      _amErr('שגיאה בשמירה: ' + e.message);
    }
  } finally {
    btn.disabled    = false;
    btn.textContent = 'שמור תוצאה';
  }
}

function _amErr(msg) {
  const el = document.getElementById('addMatchError');
  el.textContent   = msg;
  el.style.display = 'block';
}

// ===== PLAYER POPUP =====

function showPlayerPopup(playerId) {
  const player   = _players.find(p => p.id === playerId);
  if (!player) return;

  const matches  = _matches
    .filter(m => m.player1Id === playerId || m.player2Id === playerId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let wins = 0, losses = 0, gamesFor = 0, gamesAgainst = 0;
  matches.forEach(m => {
    const isP1  = m.player1Id === playerId;
    const myScore  = parseInt(isP1 ? m.score1 : m.score2);
    const oppScore = parseInt(isP1 ? m.score2 : m.score1);
    if (myScore > oppScore) wins++; else losses++;
    gamesFor     += myScore;
    gamesAgainst += oppScore;
  });

  const points = wins * 2 + losses;

  // Header
  document.getElementById('popupAvatar').innerHTML = getAvatarHtml(player, 64);
  document.getElementById('popupName').textContent  = player.name;
  document.getElementById('popupStats').innerHTML   = `
    <span class="popup-stat popup-stat-pts">${points} נק'</span>
    <span class="popup-stat popup-stat-win">${wins} נצ'</span>
    <span class="popup-stat popup-stat-loss">${losses} הפ'</span>
    <span class="popup-stat popup-stat-games">${gamesFor}:${gamesAgainst} גיימים</span>
  `;

  // Match list
  const listEl = document.getElementById('popupMatchList');
  if (matches.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.5);padding:2rem 0;">אין משחקים עדיין</p>';
  } else {
    listEl.innerHTML = matches.map(m => matchCardHtml(m, _players)).join('');
  }

  document.getElementById('playerPopup').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePlayerPopup() {
  document.getElementById('playerPopup').style.display = 'none';
  document.body.style.overflow = '';
}

// Close modals on backdrop click or Escape
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('playerPopup').addEventListener('click', e => {
    if (e.target === document.getElementById('playerPopup')) closePlayerPopup();
  });
  document.getElementById('addMatchModal').addEventListener('click', e => {
    if (e.target === document.getElementById('addMatchModal')) closeAddMatchPopup();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePlayerPopup(); closeAddMatchPopup(); }
  });
});

init();

