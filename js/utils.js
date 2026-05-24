// ==================== CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_VALUES = ['S', 'R', '+2'];
const WILD_VALUES = ['W', '+4'];
const BOT_NAMES = ['Alex', 'Blake', 'Casey', 'Drew', 'Ellis', 'Flynn'];
const TURN_TIME = 15;
const EMOTES = { angry: '😠', laugh: '😂', cry: '😢', fire: '🔥', cool: '😎', think: '🤔' };

// Global State
const state = {
  deck: [], discard: [], players: [], turn: 0, direction: 1,
  activeColor: 'red', isOver: false, active: false,
  saidUno: new Set(), pendingWild: null, drawStack: 0, stackType: null,
  timer: TURN_TIME, timerInterval: null, discardRotation: 0,
  dragCard: null, drawnCard: null, drawnCardPlayable: false
};

const multiplayerState = {
  isHost: false, lobbyId: null, playerId: null, playerName: 'Player_' + Math.random().toString(36).substr(2, 5),
  playerIndex: 0, maxPlayers: 4, gameMode: 'classic',
  lobbyRef: null, gameRef: null, playerPresenceRef: null
};

const gameSettings = { stacking: true, sound: true };

// Audio Context
let audioCtx = null;

// ==================== UTILITIES ====================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'UNO-';
  for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getPlayerColor(idx) {
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  return colors[idx % colors.length];
}

function getPositionClass(idx, total) {
  if (total === 2) return idx === 0 ? 'bottom' : 'top';
  if (total === 3) return ['bottom', 'right', 'left'][idx];
  return ['bottom', 'left', 'top', 'right'][idx];
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById(id);
  if (s) s.classList.add('active');
}

function showToast(msg, duration = 2500) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  for (let i = 0; i < 15; i++) {
    const p = document.createElement('div'); p.className = 'particle';
    const size = 4 + Math.random() * 8; p.style.width = size + 'px'; p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%'; p.style.top = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = (Math.random() * 15) + 's'; container.appendChild(p);
  }
}

// ==================== AUDIO ====================
function initAudio() {
  if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
}

function playSound(type) {
  if (!audioCtx || !gameSettings.sound) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    const sounds = {
      card: { type: 'triangle', freq: [800, 400], dur: 0.1, vol: 0.08 },
      win: { type: 'sine', freq: [523, 659, 784, 1047], dur: 0.8, vol: 0.1 },
      draw: { type: 'sine', freq: [500, 400], dur: 0.08, vol: 0.05 },
      tick: { type: 'sine', freq: [900, 900], dur: 0.06, vol: 0.04 },
      skip: { type: 'square', freq: [350, 450, 350], dur: 0.35, vol: 0.06 },
      reverse: { type: 'sine', freq: [450, 550, 450], dur: 0.3, vol: 0.06 },
      wild: { type: 'sine', freq: [350, 500, 700, 900], dur: 0.5, vol: 0.08 },
      uno: { type: 'sine', freq: [523, 659, 784], dur: 0.6, vol: 0.1 },
      emote: { type: 'sine', freq: [600, 800], dur: 0.15, vol: 0.05 }
    };
    const s = sounds[type];
    if (!s) return;
    osc.type = s.type;
    if (Array.isArray(s.freq) && s.freq.length > 1) {
      const noteLength = s.dur / s.freq.length;
      s.freq.forEach((f, i) => {
        const startTime = t + (i * noteLength);
        osc.frequency.setValueAtTime(Math.max(1, f), startTime);
        if (i < s.freq.length - 1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, s.freq[i + 1]), startTime + noteLength);
      });
    } else {
      osc.frequency.setValueAtTime(Array.isArray(s.freq) ? s.freq[0] : s.freq, t);
    }
    g.gain.setValueAtTime(s.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
    osc.start(t); osc.stop(t + s.dur);
  } catch (e) {}
}

function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }
