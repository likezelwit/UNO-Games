// ==================== CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','+2'];
const SPECIAL_CARDS = ['wild', '+4'];
const CARD_EMOJIS = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'skip': '⊘', 'reverse': '⇄', '+2': '+2', 'wild': '★', '+4': '+4'
};

const BOT_NAMES = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Echo'];
const BOT_AVATARS = ['🤖', '👾', '🎮', '🎯', '🎲'];

// ==================== AUDIO ====================
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!soundEnabled || !audioCtx) return;

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch(type) {
      case 'play':
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
        break;
      case 'draw':
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.2);
        break;
      case 'uno':
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
          g.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.3);
          o.start(audioCtx.currentTime + i * 0.15);
          o.stop(audioCtx.currentTime + i * 0.15 + 0.3);
        });
        break;
      case 'penalty':
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
        break;
    }
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

// ==================== UTILITY FUNCTIONS ====================
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'UNO-' + code;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function showGameMessage(message, duration = 2000) {
  const msgEl = document.getElementById('game-message');
  if (!msgEl) return;
  msgEl.textContent = message;
  msgEl.classList.add('show');
  setTimeout(() => msgEl.classList.remove('show'), duration);
}

// ==================== PARTICLES ====================
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  container.innerHTML = '';
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B'];

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = Math.random() * 6 + 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 25 + 's';
    particle.style.animationDuration = (Math.random() * 15 + 15) + 's';
    container.appendChild(particle);
  }
}

// ==================== CONFETTI ====================
function triggerConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea', '#ffffff'];

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.top = '-10px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = (Math.random() * 8 + 4) + 'px';
    piece.style.height = (Math.random() * 8 + 4) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    container.appendChild(piece);

    setTimeout(() => piece.remove(), 5000);
  }
}

// ==================== LOADING SCREEN ====================
function showLoading(text = 'Loading...', progress = 0) {
  const screen = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar');
  const label = document.getElementById('loading-text');

  if (screen) {
    screen.classList.remove('hidden');
    screen.setAttribute('aria-valuenow', progress);
  }
  if (bar) bar.style.width = progress + '%';
  if (label) label.textContent = text;
}

function hideLoading() {
  const screen = document.getElementById('loading-screen');
  if (screen) {
    screen.classList.add('hidden');
  }
}

// ==================== CONNECTION STATUS ====================
function updateConnectionStatus(status) {
  const el = document.getElementById('connection-status');
  if (!el) return;

  el.classList.remove('connected', 'disconnected');

  if (status === 'connected') {
    el.classList.add('connected');
    el.querySelector('span').textContent = 'Connected';
    setTimeout(() => { el.style.opacity = '0'; }, 2000);
  } else if (status === 'disconnected') {
    el.classList.add('disconnected');
    el.querySelector('span').textContent = 'Offline';
    el.style.opacity = '1';
  } else {
    el.querySelector('span').textContent = 'Connecting...';
    el.style.opacity = '1';
  }
}

// ==================== SCREEN NAVIGATION ====================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// ==================== LANDSCAPE CHECK ====================
function checkOrientation() {
  const prompt = document.getElementById('landscape-prompt');
  if (!prompt) return;

  if (window.innerWidth < window.innerHeight && window.innerWidth < 768) {
    prompt.classList.add('show');
  } else {
    prompt.classList.remove('show');
  }
}

// ==================== LOCAL STORAGE ====================
function saveToStorage(key, value) {
  try {
    localStorage.setItem('uno_' + key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

function loadFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem('uno_' + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  checkOrientation();

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);

  // Initialize audio on first user interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
});