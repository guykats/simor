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

// Close on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('playerPopup').addEventListener('click', e => {
    if (e.target === document.getElementById('playerPopup')) closePlayerPopup();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePlayerPopup();
  });
});

init();

