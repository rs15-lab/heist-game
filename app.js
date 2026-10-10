const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniMapCanvas = document.getElementById('miniMap');
const miniCtx = miniMapCanvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');

const levelNameEl = document.getElementById('level-name');
const objectiveEl = document.getElementById('objective');
const statusTextEl = document.getElementById('status-text');
const messageBox = document.getElementById('message-box');
const safeOverlay = document.getElementById('safe-overlay');
const safeDisplayEl = document.getElementById('safe-code-display');
const actionButtons = [...document.querySelectorAll('.action-btn')];

const world = {
  width: 1800,
  height: 980,
};

const keys = {};
const touchState = { active: false, x: 0, y: 0, pointerId: null };

const avatars = {
  ghost: { name: 'Ghost', color: '#dfeeff' },
  agent: { name: 'Agent', color: '#8be4ff' },
  ranger: { name: 'Ranger', color: '#b8ffbf' },
};

let selectedAvatar = 'ghost';
let inGame = false;

const player = {
  x: 150,
  y: 150,
  radius: 18,
  speed: 220,
  runSpeed: 340,
  angle: 0,
  direction: { x: 0, y: 0 },
};

const houses = [
  {
    id: 'house-1',
    name: 'Geisterhaus',
    x: 240,
    y: 180,
    w: 250,
    h: 210,
    windows: 4,
    color: '#8e969d',
    doorX: 340,
    doorY: 390,
    type: 'target',
    inside: false,
  },
  {
    id: 'house-2',
    name: 'Leeres Wohnhaus',
    x: 760,
    y: 220,
    w: 260,
    h: 230,
    windows: 3,
    color: '#7d6d5a',
    doorX: 890,
    doorY: 450,
    type: 'neutral',
    inside: false,
  },
  {
    id: 'house-3',
    name: 'Bergvilla',
    x: 1260,
    y: 200,
    w: 260,
    h: 220,
    windows: 5,
    color: '#9ab0c1',
    doorX: 1380,
    doorY: 420,
    type: 'neutral',
    inside: false,
  },
];

const trees = [
  { x: 480, y: 540, r: 40 },
  { x: 650, y: 350, r: 34 },
  { x: 1160, y: 610, r: 44 },
  { x: 1490, y: 530, r: 38 },
  { x: 1030, y: 780, r: 30 },
  { x: 340, y: 760, r: 36 },
];

const mountains = [
  { x: 40, y: 620, w: 260, h: 200 },
  { x: 230, y: 560, w: 260, h: 240 },
  { x: 1480, y: 540, w: 230, h: 260 },
  { x: 1180, y: 610, w: 260, h: 220 },
];

const levels = [
  {
    name: 'Geisterhaus',
    objective: 'Finde das Haus mit 4 Fenstern, betrete es und löse den Tresor.',
    targetHouseId: 'house-1',
    expectedWindows: 4,
    itemName: 'Lichtkristall',
    code: '482',
  },
  {
    name: 'Schatzvilla',
    objective: 'Finde die Villa mit dem versteckten Tresor und nimm den Schlüssel.',
    targetHouseId: 'house-3',
    expectedWindows: 5,
    itemName: 'Schlüsselkarte',
    code: '276',
  },
  {
    name: 'Berghaus',
    objective: 'Überprüfe das letzte Haus, knacke den Tresor und hole das Artefakt.',
    targetHouseId: 'house-2',
    expectedWindows: 3,
    itemName: 'Artefakt',
    code: '931',
  },
];

let currentLevelIndex = 0;
let safeInput = '';
let insideCurrentHouse = false;
let levelCompleted = false;
let safeSolved = false;
let itemCollected = false;

function updateStatus(text) {
  statusTextEl.textContent = text;
}

function showMessage(msg, timeout = 1800) {
  messageBox.textContent = msg;
  messageBox.classList.remove('hidden');
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => messageBox.classList.add('hidden'), timeout);
}

function setSelectedAvatar(name) {
  selectedAvatar = name;
  document.querySelectorAll('.avatar-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.avatar === name);
  });
}

function startGame() {
  inGame = true;
  startScreen.classList.remove('active');
  gameScreen.classList.add('active');
  loadLevel(0);
  updateStatus('Mission aktiv');
}

function loadLevel(index) {
  currentLevelIndex = index;
  const level = levels[index];
  levelNameEl.textContent = level.name;
  objectiveEl.textContent = level.objective;

  safeInput = '';
  safeSolved = false;
  itemCollected = false;
  insideCurrentHouse = false;
  levelCompleted = false;

  safeOverlay.classList.add('hidden');
  updateSafeDisplay();
  updateActionButtons();
  showMessage(`Level geladen: ${level.name}`);

  const targetHouse = houses.find((h) => h.id === level.targetHouseId);
  if (targetHouse) {
    player.x = 130;
    player.y = 130;
  }
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function actionFor(name) {
  const level = levels[currentLevelIndex];
  if (!level) return;

  if (name === 'explore') {
    const target = houses.find((h) => h.id === level.targetHouseId);
    const dist = distance(player.x, player.y, target.x + target.w / 2, target.y + target.h / 2);
    if (dist < 220) {
      showMessage('Ziel erreicht. Haus gefunden!');
      updateStatus('Haus gefunden');
    } else {
      showMessage('Weiter suchen: das passende Haus ist in der Nähe.');
    }
  }

  if (name === 'vault') {
    const target = houses.find((h) => h.id === level.targetHouseId);
    const dist = distance(player.x, player.y, target.doorX, target.doorY);

    if (dist < 50) {
      if (!insideCurrentHouse) {
        insideCurrentHouse = true;
        showMessage('Haus betreten. Tresor erkannt.');
        openSafePanel();
      } else {
        showMessage('Du bist bereits im Haus.');
      }
    } else {
      showMessage('Du musst näher an die Haustür.');
    }
  }

  if (name === 'loot') {
    if (safeSolved) {
      itemCollected = true;
      showMessage(`${level.itemName} aufgenommen.`);
      updateStatus('Item im Tresor gefunden');
      levelCompleted = true;
      setTimeout(() => {
        const nextLevel = levels[currentLevelIndex + 1];
        if (nextLevel) {
          loadLevel(currentLevelIndex + 1);
        } else {
          updateStatus('Alle Missionen abgeschlossen');
          objectiveEl.textContent = 'Du hast alle Missionen geschafft!';
          showMessage('Gewonnen!');
        }
      }, 1200);
    } else {
      showMessage('Tresor noch nicht gelöst.');
    }
  }
}

function openSafePanel() {
  safeOverlay.classList.remove('hidden');
  safeInput = '';
  updateSafeDisplay();
}

function closeSafePanel() {
  safeOverlay.classList.add('hidden');
}

function updateSafeDisplay() {
  const digits = safeInput.padEnd(3, '_');
  safeDisplayEl.textContent = digits.replace(/\B(?=(\d{1,3})+(?!\d))/g, ' ');
}

function onKeyPadPress(value) {
  if (value === 'clear') {
    safeInput = '';
  } else if (value === 'enter') {
    const expected = levels[currentLevelIndex].code;
    if (safeInput === expected) {
      safeSolved = true;
      closeSafePanel();
      showMessage('Tresor geöffnet.');
      updateStatus('Tresor geöffnet');
      actionButtons[2].disabled = false;
    } else {
      safeInput = '';
      showMessage('Falscher Code. Versuche es erneut.');
    }
  } else if (safeInput.length < 3) {
    safeInput += value;
  }
  updateSafeDisplay();
}

document.getElementById('keypad').addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  if (!btn) return;
  onKeyPadPress(btn.dataset.key);
});

document.getElementById('start-game').addEventListener('click', startGame);
document.getElementById('multi-btn').addEventListener('click', () => showMessage('Mehrspielermodus aktiv – lokal oder online (Demo).'));

document.querySelectorAll('.action-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (inGame && !btn.disabled) {
      actionFor(btn.dataset.action);
    }
  });
});

document.querySelectorAll('.avatar-btn').forEach((btn) => {
  btn.addEventListener('click', () => setSelectedAvatar(btn.dataset.avatar));
});

function updateActionButtons() {
  const level = levels[currentLevelIndex];
  actionButtons.forEach((btn) => {
    btn.disabled = false;
  });

  if (!level) return;
  actionButtons[2].disabled = !safeSolved;
  if (!insideCurrentHouse && !safeSolved) {
    actionButtons[1].disabled = false;
    actionButtons[2].disabled = true;
  }
}

function updatePlayer(dt) {
  const moveX = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  const moveY = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);

  let moveLen = Math.hypot(moveX, moveY);
  let speed = player.speed;
  if (keys['shift']) speed = player.runSpeed;

  if (moveLen > 0) {
    moveLen = Math.min(1, moveLen);
    const nx = moveX / moveLen;
    const ny = moveY / moveLen;
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.x = clamp(player.x, 40, world.width - 40);
    player.y = clamp(player.y, 40, world.height - 40);
  }

  if (touchState.active) {
    const dx = touchState.x;
    const dy = touchState.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.05) {
      const nx = dx / len;
      const ny = dy / len;
      const speed = keys['shift'] ? player.runSpeed : player.speed;
      player.x += nx * speed * dt * 1.2;
      player.y += ny * speed * dt * 1.2;
      player.x = clamp(player.x, 40, world.width - 40);
      player.y = clamp(player.y, 40, world.height - 40);
    }
  }

  const targetDoor = houses.find((h) => h.id === levels[currentLevelIndex].targetHouseId);
  const distToDoor = distance(player.x, player.y, targetDoor.doorX, targetDoor.doorY);
  const nearTarget = distToDoor < 70;

  if (nearTarget) {
    showMessage('Haus gefunden: Haustür erreichbar', 700);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function drawScene() {
  const cameraX = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  const cameraY = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, '#2b3e52');
  skyGradient.addColorStop(0.5, '#1b2a38');
  skyGradient.addColorStop(1, '#0d161d');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  for (const mountain of mountains) {
    ctx.fillStyle = '#45596b';
    ctx.beginPath();
    ctx.moveTo(mountain.x, mountain.y + mountain.h);
    ctx.lineTo(mountain.x + mountain.w * 0.5, mountain.y);
    ctx.lineTo(mountain.x + mountain.w, mountain.y + mountain.h);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#2b4d39';
  ctx.fillRect(0, 0, world.width, world.height);

  for (const tree of trees) {
    ctx.fillStyle = '#355d3c';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d3f2a';
    ctx.fillRect(tree.x - 4, tree.y + tree.r * 0.6, 8, 22);
  }

  for (const house of houses) {
    const isTarget = house.id === levels[currentLevelIndex].targetHouseId;

    ctx.fillStyle = house.color;
    ctx.fillRect(house.x, house.y, house.w, house.h);

    ctx.fillStyle = '#1d2731';
    ctx.fillRect(house.x + 22, house.y + 26, house.w - 44, house.h - 26);

    for (let i = 0; i < house.windows; i++) {
      const wx = house.x + 35 + i * 52;
      ctx.fillStyle = isTarget ? '#ffe084' : '#dce9ff';
      ctx.fillRect(wx, house.y + 46, 28, 28);
    }

    ctx.fillStyle = '#5b3525';
    ctx.fillRect(house.doorX - 18, house.doorY - 50, 36, 50);

    if (isTarget) {
      ctx.strokeStyle = '#6be1ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(house.x - 8, house.y - 8, house.w + 16, house.h + 16);
    }
  }

  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#64d9ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26);
  ctx.stroke();

  ctx.restore();
}

function drawMiniMap() {
  miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
  miniCtx.fillStyle = '#0f1d2a';
  miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  const sx = miniMapCanvas.width / world.width;
  const sy = miniMapCanvas.height / world.height;

  for (const house of houses) {
    const isTarget = house.id === levels[currentLevelIndex].targetHouseId;
    miniCtx.fillStyle = isTarget ? '#7ee6ff' : '#6f7a86';
    miniCtx.fillRect(house.x * sx, house.y * sy, house.w * sx, house.h * sy);
  }

  for (const tree of trees) {
    miniCtx.fillStyle = '#2a8c57';
    miniCtx.beginPath();
    miniCtx.arc(tree.x * sx, tree.y * sy, 5, 0, Math.PI * 2);
    miniCtx.fill();
  }

  miniCtx.fillStyle = '#dff5ff';
  miniCtx.beginPath();
  miniCtx.arc(player.x * sx, player.y * sy, 6, 0, Math.PI * 2);
  miniCtx.fill();
}

function tick() {
  const now = performance.now();
  const dt = Math.min((now - (tick.last || now)) / 1000, 0.033);
  tick.last = now;

  if (inGame) {
    updatePlayer(dt);
    updateActionButtons();
  }

  drawScene();
  drawMiniMap();
  requestAnimationFrame(tick);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(key) || key === ' ') {
    event.preventDefault();
  }

  if (key === ' ') keys['shift'] = true;
  else if (key === 'shift') keys['shift'] = true;
  else if (key === 'e') {
    if (inGame) actionFor('vault');
  } else {
    keys[key] = true;
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === ' ') keys['shift'] = false;
  else if (key === 'shift') keys['shift'] = false;
  else keys[key] = false;
});

window.addEventListener('mousemove', (event) => {
  if (!inGame) return;
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  player.angle = Math.atan2(dy, dx);
});

function setupTouchJoystick() {
  const stickBase = document.getElementById('move-stick');
  const knob = document.getElementById('stick-knob');
  const baseRect = () => stickBase.getBoundingClientRect();

  function moveKnob(x, y) {
    const rect = baseRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const max = 32;
    const len = Math.min(max, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const px = Math.cos(angle) * len;
    const py = Math.sin(angle) * len;
    knob.style.transform = `translate(${px}px, ${py}px)`;
    touchState.x = px / max;
    touchState.y = py / max;
    touchState.active = true;
    keys['shift'] = !!(Math.hypot(px, py) > 16);
  }

  stickBase.addEventListener('pointerdown', (event) => {
    touchState.active = true;
    moveKnob(event.clientX, event.clientY);
    stickBase.setPointerCapture(event.pointerId);
  });

  stickBase.addEventListener('pointermove', (event) => {
    if (!touchState.active) return;
    moveKnob(event.clientX, event.clientY);
  });

  stickBase.addEventListener('pointerup', () => {
    touchState.active = false;
    knob.style.transform = 'translate(0px, 0px)';
    touchState.x = 0;
    touchState.y = 0;
    keys['shift'] = false;
  });

  stickBase.addEventListener('pointerleave', () => {
    touchState.active = false;
    knob.style.transform = 'translate(0px, 0px)';
    touchState.x = 0;
    touchState.y = 0;
    keys['shift'] = false;
  });
}

setupTouchJoystick();

requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 820;
  const touchControls = document.getElementById('touch-controls');
  touchControls.style.display = isMobile ? 'block' : 'none';
});

window.dispatchEvent(new Event('resize'));
