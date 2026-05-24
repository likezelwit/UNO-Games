document.addEventListener('DOMContentLoaded', async () => {
  createParticles();
  
  // Simulating resource loading
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');
  const steps = [
    { p: 25, t: "Connecting..." },
    { p: 50, t: "Loading Assets..." },
    { p: 75, t: "Initializing..." },
    { p: 100, t: "Ready!" }
  ];

  for (const step of steps) {
    if (loadingBar) loadingBar.style.width = step.p + '%';
    if (loadingText) loadingText.textContent = step.t;
    await new Promise(r => setTimeout(r, 400));
  }

  document.getElementById('loading-screen').classList.add('hidden');
  showScreen('menu-screen');

  // Connection Monitor (Mock)
  const statusEl = document.getElementById('connection-status');
  setTimeout(() => {
    if(statusEl) {
      statusEl.classList.add('connected');
      statusEl.querySelector('span').textContent = "Connected";
    }
  }, 2000);

  // Event Listeners
  document.getElementById('draw-pile').addEventListener('click', GameUI.drawCard);
  document.getElementById('uno-btn').addEventListener('click', GameUI.callUno);
  
  document.getElementById('keep-btn').addEventListener('click', GameUI.keepDrawnCard);
  document.getElementById('play-btn').addEventListener('click', GameUI.playDrawnCard);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'u' || e.key === 'U') GameUI.callUno();
    if (e.key === 'd' || e.key === 'D') GameUI.drawCard();
  });
});
