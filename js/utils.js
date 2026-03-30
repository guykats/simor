// ==============================
// Shared utility functions
// ==============================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Calculate standings from players + matches.
 * Sorting: points desc, then total games scored desc (tiebreaker).
 */
function calculateStandings(players, matches) {
  const stats = {};
  players.forEach(p => {
    stats[p.id] = { player: p, wins: 0, losses: 0, gamesScored: 0, matchesPlayed: 0 };
  });

  matches.forEach(m => {
    const s1 = stats[m.player1Id];
    const s2 = stats[m.player2Id];
    if (!s1 || !s2) return;

    const sc1 = parseInt(m.score1) || 0;
    const sc2 = parseInt(m.score2) || 0;

    s1.gamesScored += sc1;
    s2.gamesScored += sc2;
    s1.matchesPlayed++;
    s2.matchesPlayed++;

    if (sc1 > sc2) {
      s1.wins++;
      s2.losses++;
    } else if (sc2 > sc1) {
      s2.wins++;
      s1.losses++;
    }
  });

  return Object.values(stats)
    .map(s => ({ ...s, points: s.wins * 2 + s.losses }))
    .sort((a, b) => b.points - a.points || b.gamesScored - a.gamesScored);
}

const AVATAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  '#00bcd4', '#ff5722', '#607d8b', '#795548'
];

function getAvatarColor(name) {
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
}

function getInitialsAvatar(name, size = 48) {
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  const style = [
    `width:${size}px`, `height:${size}px`, `border-radius:50%`,
    `background:${color}`, `display:inline-flex`, `align-items:center`,
    `justify-content:center`, `font-weight:700`, `color:#fff`,
    `font-size:${Math.floor(size * 0.38)}px`, `flex-shrink:0`,
    `vertical-align:middle`
  ].join(';');
  return `<div style="${style}">${initials}</div>`;
}

function getAvatarHtml(player, size = 48) {
  if (player && player.avatar) {
    const style = [
      `width:${size}px`, `height:${size}px`, `border-radius:50%`,
      `object-fit:cover`, `flex-shrink:0`, `vertical-align:middle`
    ].join(';');
    return `<img src="${player.avatar}" style="${style}" alt="${player.name}">`;
  }
  return getInitialsAvatar((player && player.name) || '?', size);
}

async function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 128;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
