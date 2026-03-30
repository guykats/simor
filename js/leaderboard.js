// ==============================
// Public leaderboard page logic
// ==============================

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

    const standings = calculateStandings(data.players || [], data.matches || []);
    renderStandings(standings);
    renderMatches(data.matches || [], data.players || []);
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
    const rank = i < 3 ? medals[i] : `${i + 1}`;
    const rowClass = i === 0 ? 'row-gold' : i === 1 ? 'row-silver' : i === 2 ? 'row-bronze' : '';
    return `
      <tr class="${rowClass}">
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

  container.innerHTML = recent.map(m => {
    const p1 = players.find(p => p.id === m.player1Id) || { name: '?', id: m.player1Id };
    const p2 = players.find(p => p.id === m.player2Id) || { name: '?', id: m.player2Id };
    const p1Won = parseInt(m.score1) > parseInt(m.score2);

    return `
      <div class="match-card">
        <div class="match-row">
          <div class="match-player ${p1Won ? 'match-winner' : 'match-loser'}">
            ${getAvatarHtml(p1, 38)}
            <span>${p1.name}</span>
            ${p1Won ? '<span class="trophy">🏆</span>' : ''}
          </div>
          <div class="match-score-block">
            <span class="score-num ${p1Won ? 'score-win' : 'score-lose'}">${m.score1}</span>
            <span class="score-sep">-</span>
            <span class="score-num ${!p1Won ? 'score-win' : 'score-lose'}">${m.score2}</span>
            ${m.date ? `<div class="match-date">${formatDate(m.date)}</div>` : ''}
          </div>
          <div class="match-player match-player-right ${!p1Won ? 'match-winner' : 'match-loser'}">
            ${!p1Won ? '<span class="trophy">🏆</span>' : ''}
            <span>${p2.name}</span>
            ${getAvatarHtml(p2, 38)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

init();
