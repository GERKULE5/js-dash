// SPRITES 
const spritesCube  = new Image(); spritesCube.src  = 'sprites/cube.svg';
const spritesSpike = new Image(); spritesSpike.src = 'sprites/spike.svg';

// Game constants
const CANVAS_W = 1024, CANVAS_H = 728;
const GROUND_Y  = CANVAS_H - 100;      // Ground line Y (shared for all objects)
const FLOOR_Y   = GROUND_Y;            // Alias for compatibility
const PLAYER_X  = 150;                  // Fixed player X position
const GRAVITY   = 0.55;
const JUMP_VELOCITY   = -13;            // Standard jump
const SAW_FLIP_VEL    = -10;            // Saw mode
const PLAYER_SIZE     = 40;
const GAME_DURATION   = 150;            // Seconds
const LEVEL_LENGTH    = 14000;          // Level length in pixels
const SCROLL_SPEED    = 4;             // Pixels per frame
const COIN_SIZE = 16;

// Player modes
const MODE_CUBE  = 'cube';
const MODE_UFO   = 'ufo';
const MODE_SAW   = 'saw';

const MODE_NAMES = { cube:'Cube', ufo:'UFO', saw:'Saw' };

// Global state variables
let playerName  = '';
let isTester    = false;
let isMuted     = false;
let fontSize    = 16;
let gameRunning = false;
let gamePaused  = false;
let frameTime   = 0;

// Main game state
let state = {};

// Retrieves leaderboard from localStorage
function getLB() {
  try { return JSON.parse(localStorage.getItem('geo_dash_lb') || '[]'); } catch(e){return[];}
}

// Saves leaderboard to localStorage
function saveLB(lb) {
  try { localStorage.setItem('geo_dash_lb', JSON.stringify(lb)); } catch(e){}
}

// Audio system
// Generate sounds using Web Audio API
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// Initializes audio context
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

// Plays a tone with given parameters
function playTone(freq, type='square', dur=0.08, vol=0.15, delay=0) {
  if (isMuted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur);
  } catch(e){}
}

// Plays jump sound effect
function sfxJump()  { playTone(440, 'square', 0.1, 0.12); }

// Plays death sound effect
function sfxDeath() {
  playTone(200, 'sawtooth', 0.15, 0.2);
  playTone(150, 'sawtooth', 0.2, 0.15, 0.1);
  playTone(100, 'sawtooth', 0.25, 0.1, 0.2);
}

// Plays coin collection sound effect
function sfxCoin()  { playTone(880, 'sine', 0.15, 0.2); playTone(1100,'sine',0.1,0.15,0.1); }

// Plays win sound effect
function sfxWin()   {
  [523,659,784,1047].forEach((f,i) => playTone(f,'sine',0.2,0.2,i*0.12));
}

// Plays orb activation sound effect
function sfxOrb(type) {
  const freqs = { yellow:600, pink:400, red:300 };
  playTone(freqs[type]||500,'triangle',0.1,0.18);
}

// Plays portal activation sound effect
function sfxPortal() {
  for(let i=0;i<6;i++) playTone(300+i*80,'sine',0.08,0.1,i*0.05);
}

// Plays click sound effect
function sfxClick() { playTone(600,'sine',0.05,0.08); }

// Canvas and context setup
const canvas    = document.getElementById('game-canvas');
const ctx       = canvas.getContext('2d');
const pCanvas   = document.getElementById('particle-canvas');
const pCtx      = pCanvas.getContext('2d');

// DOM references
const startScreen = document.getElementById('start-screen');
const gameScreen  = document.getElementById('game-screen');
const endScreen   = document.getElementById('end-screen');
const nameInput   = document.getElementById('player-name');
const btnStart    = document.getElementById('btn-start');
const btnPause    = document.getElementById('btn-pause');
const btnRestart  = document.getElementById('btn-restart');
const btnMenu     = document.getElementById('btn-menu');
const hudTimer    = document.getElementById('hud-timer');
const hudScore    = document.getElementById('hud-score');
const hudCoins    = document.getElementById('hud-coins');
const hudName     = document.getElementById('hud-name');
const testerBadge = document.getElementById('tester-badge');
const progressBar = document.getElementById('progress-bar');
const progressPct = document.getElementById('progress-pct');
const modeIndicator= document.getElementById('mode-indicator');
const pauseOverlay = document.getElementById('pause-overlay');
const deathFlash  = document.getElementById('death-flash');
const soundBtn    = document.getElementById('sound-btn');
const lbTable     = document.getElementById('lb-table');

// Level generation
// Generates the level with obstacles, coins, and portals
function generateLevel() {
  const objects = [];
  let x = 600;  // start offset

  // Helper
  const add = (obj) => objects.push(obj);

  // Section 1: simple spikes
  for (let i = 0; i < 10; i++) {
    x += 200 + Math.random() * 100;
    add({ type:'spike', x, y: FLOOR_Y });
    if (Math.random() > 0.7) {
      add({ type:'spike', x: x + 50, y: FLOOR_Y });
    }
  }

  // Coins section
  x += 200;
  for (let i = 0; i < 3; i++) {
    add({ type:'coin', x: x + i*120, y: FLOOR_Y - 80 - Math.random()*60 });
  }

  // Orbs section
  x += 400;
  add({ type:'orb', orbType:'yellow', x, y: FLOOR_Y - 60 });
  x += 250;
  add({ type:'spike', x, y: FLOOR_Y });
  add({ type:'spike', x: x+50, y: FLOOR_Y });
  x += 200;
  add({ type:'orb', orbType:'pink', x, y: FLOOR_Y - 60 });

  x += 180;
  add({ type:'spike', x, y: FLOOR_Y });

  x += 200;
  add({ type:'orb', orbType:'red', x, y: FLOOR_Y - 60 });
  x += 50;
  add({ type:'spike', x, y: FLOOR_Y });
  add({ type:'spike', x: x+50, y: FLOOR_Y });
  add({ type:'spike', x: x+100, y: FLOOR_Y });

  // Coins
  x += 300;
  for (let i=0;i<2;i++) {
    add({ type:'coin', x: x + i*160, y: FLOOR_Y - 120 });
  }

  // Portal 1 (UFO mode)
  x += 300;
  add({ type:'portal', portalMode: MODE_UFO, x, y: FLOOR_Y - 100 });

  // UFO section - ceiling spikes
  x += 220;
  for (let i=0;i<7;i++) {
    x += 170 + Math.random()*70;
    if (Math.random() > 0.35) {
      add({ type:'spike', x, y: 70, inverted: true }); // ceiling spike
    }
    if (Math.random() > 0.55) {
      add({ type:'coin', x: x+30, y: 160 });
    }
  }

  // Portal 2 (SAW mode)
  x += 200;
  add({ type:'portal', portalMode: MODE_SAW, x, y: FLOOR_Y - 100 });

  // SAW section
  x += 220;
  for (let i=0;i<8;i++) {
    x += 160 + Math.random()*80;
    if (i === 3 || i === 6) {
      add({ type:'coin', x: x + 30, y: FLOOR_Y - 80 });
      add({ type:'orb', orbType:'yellow', x: x + 120, y: FLOOR_Y - 60 });
      x += 180;
      continue;
    }
    if (Math.random() > 0.35) {
      add({ type:'spike', x, y: FLOOR_Y });
    }
    if (Math.random() > 0.65) {
      add({ type:'spike', x: x, y: 60, inverted: true });
    }
    if (Math.random() > 0.6) {
      add({ type:'coin', x: x+40, y: FLOOR_Y/2 });
    }
  }

  // Back to cube
  x += 200;
  add({ type:'portal', portalMode: MODE_CUBE, x, y: FLOOR_Y - 100 });

  // Final section
  x += 150;
  for (let i=0;i<8;i++) {
    x += 140 + Math.random()*100;
    if (Math.random() > 0.45) add({ type:'spike', x, y: FLOOR_Y });
    if (Math.random()>0.5) add({ type:'spike', x:x+50, y: FLOOR_Y });
    if (Math.random()>0.65) add({ type:'orb', orbType:'yellow', x:x-40, y: FLOOR_Y - 60 });
  }

  // Extended final stretch for longer gameplay
  x += 300;
  for (let i=0;i<10;i++) {
    x += 190 + Math.random()*110;
    if (Math.random() > 0.45) add({ type:'spike', x, y: FLOOR_Y });
    if (Math.random() > 0.55) add({ type:'coin', x: x + 40, y: FLOOR_Y - 90 - Math.random()*50 });
    if (Math.random() > 0.55) add({ type:'orb', orbType:'yellow', x: x - 30, y: FLOOR_Y - 60 });
  }
  x += 280;
  for (let i=0;i<6;i++) {
    x += 230 + Math.random()*70;
    if (Math.random() > 0.35) add({ type:'spike', x, y: FLOOR_Y });
    if (Math.random() > 0.55) add({ type:'coin', x: x + 30, y: FLOOR_Y - 110 });
  }

  // Some coins at end
  for (let i=0;i<4;i++) {
    add({ type:'coin', x: x + 120 + i*140, y: FLOOR_Y - 80 });
  }

  return objects;
}

// Game state initialization
// Initializes the main game state object
function initState() {
  state = {
    mode: MODE_CUBE,
    player: {
      x: PLAYER_X,
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      onGround: false,
      onCeiling: false,
      gravityDir: 1,  // 1 = down, -1 = up (saw mode)
      rotation: 0,
      rotSpeed: 0,
      touchingOrb: null,
      dead: false,
    },
    cameraX: 0,    // world offset scrolled so far
    worldX: 0,     // total world X scrolled
    score: 0,
    coins: 0,
    jumps: 0,
    timeLeft: GAME_DURATION,
    elapsed: 0,
    timerInterval: null,
    raf: null,
    objects: generateLevel(),
    particles: [],
    bgStars: Array.from({length:80}, () => ({
      x: Math.random()*CANVAS_W,
      y: Math.random()*CANVAS_H,
      size: Math.random()*2+0.5,
      speed: Math.random()*0.5+0.3,
      opacity: Math.random()*0.6+0.2,
    })),
    bgPlanets: [
      { x: 800, y: 120, r: 35, color:'#1a0a3a', glow:'#4a0080' },
      { x: 300, y: 200, r: 20, color:'#001a20', glow:'#004060' },
    ],
    orbActivated: null,  // { type, cooldown }
    lastSec: 0,
    finished: false,
    ufoHoldDown: false,
    modeIndicatorTimer: 0,
  };
}

// Particle system
// Spawns particles at given position with color and parameters
function spawnParticles(x, y, color, count=12, speed=4) {
  for (let i=0; i<count; i++) {
    const angle = (Math.PI*2/count)*i + Math.random()*0.5;
    const spd   = speed * (0.5 + Math.random());
    state.particles.push({
      x, y,
      vx: Math.cos(angle)*spd,
      vy: Math.sin(angle)*spd,
      life: 1, decay: 0.03 + Math.random()*0.03,
      size: 4 + Math.random()*4,
      color,
    });
  }
}

// Updates particle positions and lifespans
function updateParticles() {
  state.particles = state.particles.filter(p => p.life > 0);
  for (const p of state.particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
    p.size *= 0.97;
  }
}

// Draws particles on the particle canvas
function drawParticles(camX) {
  pCtx.clearRect(0,0,1024,768);
  for (const p of state.particles) {
    pCtx.globalAlpha = p.life;
    pCtx.fillStyle = p.color;
    pCtx.beginPath();
    pCtx.arc(p.x - camX, p.y, p.size, 0, Math.PI*2);
    pCtx.fill();
  }
  pCtx.globalAlpha = 1;
}

// Drawing helpers
// Draws a rounded rectangle on the canvas
function drawRoundedRect(c, x,y,w,h,r,fill,stroke,strokeW=2) {
  c.beginPath();
  c.moveTo(x+r, y);
  c.lineTo(x+w-r, y);
  c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w, y+h-r);
  c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r, y+h);
  c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x, y+r);
  c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = strokeW; c.stroke(); }
}

// Draws a spike obstacle using sprite (sprites/spike.svg)

function drawSpike(c, x, y, inverted=false) {
  const w = 30, h = 36;
  if (spritesSpike.complete && spritesSpike.naturalWidth > 0) {
    c.save();
    if (inverted) {
    
      c.translate(x + w / 2, y + h / 2);
      c.scale(1, -1);
      c.drawImage(spritesSpike, -w / 2, -h / 2, w, h);
    } else {
    
      c.drawImage(spritesSpike, x, y - h, w, h);
    }
    c.restore();
  } else {
   
    c.beginPath();
    if (!inverted) {
      c.moveTo(x, y); c.lineTo(x + w/2, y - h); c.lineTo(x + w, y);
    } else {
      c.moveTo(x, y); c.lineTo(x + w/2, y + h); c.lineTo(x + w, y);
    }
    c.closePath();
    c.fillStyle = '#ff4466'; c.fill();
    c.strokeStyle = '#ff0033'; c.lineWidth = 1; c.stroke();
  }
}

// Draws an orb pickup
function drawOrb(c, x, y, type) {
  const colors = {
    yellow: { fill:'#ffe600', glow:'#ffd000', inner:'#fff8a0' },
    pink:   { fill:'#ff69b4', glow:'#ff1493', inner:'#ffd0e8' },
    red:    { fill:'#ff3333', glow:'#cc0000', inner:'#ff9999' },
  };
  const col = colors[type] || colors.yellow;
  const r = 18;

  c.shadowBlur = 20; c.shadowColor = col.glow;
  c.beginPath(); c.arc(x+r, y+r, r, 0, Math.PI*2);
  c.fillStyle = col.fill; c.fill();
  c.shadowBlur = 0;

  // inner shine
  c.beginPath(); c.arc(x+r-5, y+r-5, 7, 0, Math.PI*2);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();

  // border
  c.beginPath(); c.arc(x+r, y+r, r, 0, Math.PI*2);
  c.strokeStyle = col.glow; c.lineWidth = 2; c.stroke();
}

// Draws a coin pickup
function drawCoin(c, x, y) {
  const r = COIN_SIZE/2;
  c.shadowBlur = 12; c.shadowColor = '#ffe600';
  c.beginPath(); c.arc(x+r, y+r, r, 0, Math.PI*2);
  c.fillStyle = '#ffe600'; c.fill();
  c.shadowBlur = 0;
  c.beginPath(); c.arc(x+r, y+r, r, 0, Math.PI*2);
  c.strokeStyle = '#ffa500'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#ffa500';
  c.font = 'bold 10px Arial';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('$', x+r, y+r+1);
}

// Draws a portal for mode switching
function drawPortal(c, x, y, mode, time) {
  const h = 100, w = 24;
  const colors = { cube:'#00f5ff', ufo:'#aa00ff', saw:'#ff6a00' };
  const col = colors[mode] || '#fff';
  const pulse = Math.sin(time*0.1)*0.3+0.7;

  c.shadowBlur = 20*pulse; c.shadowColor = col;
  // Frame
  drawRoundedRect(c, x, y-10, w, h+20, 6, 'rgba(0,0,0,0.5)', col, 3);
  // Inner glow
  for (let i=0;i<5;i++){
    const alpha = (1-i/5)*0.15*pulse;
    c.fillStyle = col.replace(')',`,${alpha})`).replace('rgb','rgba').replace('#','rgba(').replace(')','');
    // Simple horizontal lines
    c.fillStyle = col;
    c.globalAlpha = alpha;
    c.fillRect(x+2, y-10+(h+20)/5*i, w-4, (h+20)/5);
    c.globalAlpha = 1;
  }
  c.shadowBlur = 0;

  // Label
  c.fillStyle = col;
  c.font = 'bold 9px Arial';
  c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText(MODE_NAMES[mode], x+w/2, y-24);
}

// Draws the player character based on current mode
function drawPlayer(c, p, mode, time) {
  c.save();
  const cx = p.x + PLAYER_SIZE/2;
  const cy = p.y + PLAYER_SIZE/2;
  c.translate(cx, cy);

  if (mode === MODE_CUBE) {
    c.rotate(p.rotation * Math.PI/180);
    c.translate(-PLAYER_SIZE/2, -PLAYER_SIZE/2);

    if (spritesCube.complete && spritesCube.naturalWidth > 0) {
     
      c.shadowBlur = 15; c.shadowColor = '#00f5ff';
      c.drawImage(spritesCube, 0, 0, PLAYER_SIZE, PLAYER_SIZE);
      c.shadowBlur = 0;
    } else {
   
      const grad = c.createLinearGradient(0,0,PLAYER_SIZE,PLAYER_SIZE);
      grad.addColorStop(0, '#00f5ff'); grad.addColorStop(1, '#0055ff');
      drawRoundedRect(c, 0,0,PLAYER_SIZE,PLAYER_SIZE,5,grad,'#00ddff',2);
      c.fillStyle='#fff'; c.fillRect(8,8,10,10);
      c.fillStyle='#003399'; c.fillRect(11,11,5,5);
    }

  } else if (mode === MODE_UFO) {
    c.rotate(0);
    // UFO shape - ellipse body
    c.shadowBlur = 15; c.shadowColor = '#aa00ff';
    c.fillStyle = '#cc44ff';
    c.beginPath();
    c.ellipse(0, 0, PLAYER_SIZE/2, PLAYER_SIZE/3, 0, 0, Math.PI*2);
    c.fill();
    // dome
    c.fillStyle = '#8800cc';
    c.beginPath();
    c.ellipse(0, -8, PLAYER_SIZE/3, PLAYER_SIZE/4, 0, Math.PI, 0);
    c.fill();
    // engine glow
    c.shadowColor='#ff00ff';
    c.fillStyle='rgba(255,0,255,0.4)';
    c.beginPath();
    c.ellipse(0, 12, 10, 4, 0, 0, Math.PI*2);
    c.fill();
    c.shadowBlur = 0;
    // light blink
    c.fillStyle = `rgba(255,255,0,${0.5+Math.sin(time*0.3)*0.5})`;
    c.beginPath(); c.arc(0,-5,3,0,Math.PI*2); c.fill();

  } else if (mode === MODE_SAW) {
    // Saw blade
    const teeth = 8;
    const r1 = PLAYER_SIZE/2 - 4, r2 = PLAYER_SIZE/2 + 4;
    c.rotate(p.rotation * Math.PI/180);
    c.shadowBlur = 15; c.shadowColor = '#ff6a00';
    c.fillStyle = '#ff6a00';
    c.beginPath();
    for (let i=0;i<teeth*2;i++) {
      const angle = (Math.PI/teeth)*i + p.rotation*Math.PI/180;
      const r = i%2===0 ? r2 : r1;
      const nx = Math.cos(angle)*r, ny = Math.sin(angle)*r;
      i===0 ? c.moveTo(nx,ny) : c.lineTo(nx,ny);
    }
    c.closePath(); c.fill();
    c.strokeStyle='#ff3300'; c.lineWidth=1; c.stroke();
    c.fillStyle='#cc2200';
    c.beginPath(); c.arc(0,0,8,0,Math.PI*2); c.fill();
    c.shadowBlur=0;
  }

  c.restore();
}

// Background rendering
function drawBackground(c, camX, time, mode) {
  // Sky gradient
  const skyColors = {
    cube:  ['#030318','#071040'],
    ufo:   ['#150030','#2a0060'],
    saw:   ['#200a00','#401500'],
  };
  const [c1,c2] = skyColors[mode] || skyColors.cube;
  const grad = c.createLinearGradient(0,0,0,CANVAS_H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  c.fillStyle = grad;
  c.fillRect(0,0,CANVAS_W,CANVAS_H);

  // Stars (parallax)
  for (const star of state.bgStars) {
    const sx = ((star.x - camX * star.speed * 0.3) % CANVAS_W + CANVAS_W) % CANVAS_W;
    c.globalAlpha = star.opacity * (0.7 + Math.sin(time*0.02 + star.x)*0.3);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(sx, star.y, star.size, 0, Math.PI*2);
    c.fill();
  }
  c.globalAlpha = 1;

  // Background planet (parallax)
  for (const pl of state.bgPlanets) {
    const px = ((pl.x - camX * 0.1) % (CANVAS_W+100) + CANVAS_W+100) % (CANVAS_W+100) - 50;
    c.shadowBlur = 30; c.shadowColor = pl.glow;
    c.fillStyle = pl.color;
    c.beginPath(); c.arc(px, pl.y, pl.r, 0, Math.PI*2); c.fill();
    c.shadowBlur = 0;
  }

  // Mid layer mountains (parallax 0.4)
  const mOffset = (-camX * 0.4) % (CANVAS_W * 2);
  c.fillStyle = mode === MODE_SAW ? '#2a0800' : '#050520';
  for (let i=-1; i<3; i++) {
    const bx = mOffset + i * CANVAS_W;
    c.beginPath();
    c.moveTo(bx, CANVAS_H);
    [0,120,220,340,440,560,660,780,880,1024].forEach((mx,j) => {
      const my = CANVAS_H - [80,160,110,200,140,180,130,170,120,80][j];
      j===0 ? c.lineTo(bx+mx, my) : c.lineTo(bx+mx, my);
    });
    c.lineTo(bx+1024, CANVAS_H);
    c.closePath(); c.fill();
  }

  // Ground glow line
  const gcol = { cube:'#00f5ff', ufo:'#aa00ff', saw:'#ff6a00' }[mode] || '#00f5ff';
  c.strokeStyle = gcol;
  c.lineWidth = 2;
  c.shadowBlur = 12; c.shadowColor = gcol;
  c.beginPath(); c.moveTo(0, GROUND_Y); c.lineTo(CANVAS_W, GROUND_Y); c.stroke();
  c.shadowBlur = 0;

  // Ground fill
  const ggrad = c.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
  ggrad.addColorStop(0, mode==='saw'?'#1a0500':'#020214');
  ggrad.addColorStop(1, '#000');
  c.fillStyle = ggrad;
  c.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  // Grid lines on ground
  c.strokeStyle = mode==='saw'?'rgba(255,106,0,0.1)':'rgba(0,245,255,0.06)';
  c.lineWidth=1; c.shadowBlur=0;
  const gridOff = (-camX * 1) % 60;
  for (let gx=gridOff; gx<CANVAS_W; gx+=60) {
    c.beginPath(); c.moveTo(gx, GROUND_Y); c.lineTo(gx, CANVAS_H); c.stroke();
  }

  // Ceiling line
  c.strokeStyle = gcol;
  c.lineWidth = 2;
  c.shadowBlur = 12; c.shadowColor = gcol;
  c.beginPath(); c.moveTo(0, 60); c.lineTo(CANVAS_W, 60); c.stroke();
  c.shadowBlur = 0;
}

// Collision detection
function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

// Gets the hitbox for a spike obstacle
function spikeHitbox(spike) {
  if (spike.inverted) {
    return { x: spike.x+4, y: 60, w: 22, h: 30 };
  }
  // Spike base on GROUND_Y, tip up 30px
  return { x: spike.x+4, y: GROUND_Y-30, w: 22, h: 30 };
}

// Physics update
function updatePlayer(dt) {
  const p = state.player;
  if (p.dead) return;

  const mode = state.mode;
  const gDir = p.gravityDir;

  if (mode === MODE_CUBE || mode === MODE_SAW) {
    p.vy += GRAVITY * gDir;
    p.y  += p.vy;

    const groundY = GROUND_Y - PLAYER_SIZE;
    const ceilY   = 60;

    if (gDir === 1) {
      if (p.y >= groundY) {
        p.y = groundY; p.vy = 0; p.onGround = true; p.onCeiling = false;
        if (mode === MODE_CUBE) p.rotSpeed = 0;
      } else { p.onGround = false; }
      if (p.y <= ceilY) {
        playerDie();
      }
    } else {
      // inverted gravity
      if (p.y <= ceilY) {
        p.y = ceilY; p.vy = 0; p.onGround = true; p.onCeiling = false;
        if (mode === MODE_CUBE) p.rotSpeed = 0;
      } else { p.onGround = false; }
      if (p.y >= groundY) {
        playerDie();
      }
    }

    // Rotation
    if (!p.onGround) {
      p.rotation += 6 * gDir;
    } else {
      // Snap to nearest 90deg
      p.rotation = Math.round(p.rotation / 90) * 90;
    }

  } else if (mode === MODE_UFO) {
    // UFO: hold click = fly up
    if (state.ufoHoldDown) {
      p.vy -= 0.7;
    }
    p.vy += GRAVITY * 0.6;
    p.vy = Math.max(-8, Math.min(8, p.vy));
    p.y += p.vy;

    const groundY = GROUND_Y - PLAYER_SIZE;
    if (p.y >= groundY) { p.y = groundY; p.vy = 0; }
    if (p.y <= 60) { playerDie(); }
  }

  // Ceiling hit in UFO
  if (mode === MODE_UFO && p.y <= 60) playerDie();

  p.touchingOrb = null;
}

// Game objects update
function updateObjects() {
  const p = state.player;
  const camX = state.cameraX;

  for (const obj of state.objects) {
    if (obj.collected || obj.passed) continue;
    const sx = obj.x - camX;
    if (sx < -60 || sx > CANVAS_W + 60) continue; // off screen

    if (obj.type === 'spike') {
      const hb = spikeHitbox(obj);
      if (!isTester && rectsOverlap(
        p.x+6, p.y+6, PLAYER_SIZE-12, PLAYER_SIZE-12,
        hb.x - camX, hb.y, hb.w, hb.h
      )) {
        playerDie();
      }

    } else if (obj.type === 'coin') {
      if (rectsOverlap(
        p.x, p.y, PLAYER_SIZE, PLAYER_SIZE,
        obj.x - camX, obj.y, COIN_SIZE, COIN_SIZE
      )) {
        obj.collected = true;
        state.coins++;
        state.score += 100;
        sfxCoin();
        spawnParticles(obj.x - camX + COIN_SIZE/2, obj.y, '#ffe600', 8, 3);
        hudCoins.textContent = state.coins;
        hudScore.textContent = state.score;
      }

    } else if (obj.type === 'orb') {
      if (rectsOverlap(
        p.x+2, p.y+2, PLAYER_SIZE-4, PLAYER_SIZE-4,
        obj.x - camX, obj.y, 36, 36
      )) {
        p.touchingOrb = obj;
      }

    } else if (obj.type === 'portal') {
      if (!obj.passed && sx < PLAYER_X + PLAYER_SIZE && sx + 24 > PLAYER_X) {
        obj.passed = true;
        activatePortal(obj.portalMode);
      }
    }
  }
}

// Player actions
function playerJump() {
  if (state.finished || gamePaused || !gameRunning) return;
  const p = state.player;
  const mode = state.mode;

  if (mode === MODE_CUBE) {
    if (p.onGround) {
      p.vy = JUMP_VELOCITY * p.gravityDir;
      p.onGround = false;
      state.jumps++;
      sfxJump();
      spawnParticles(p.x + PLAYER_SIZE/2, p.y + PLAYER_SIZE, '#00f5ff', 6, 2);
    } else if (p.touchingOrb) {
      activateOrb(p.touchingOrb);
    }

  } else if (mode === MODE_UFO) {
    // UFO: single click = boost
    p.vy = -6;
    state.jumps++;
    sfxJump();
    spawnParticles(p.x + PLAYER_SIZE/2, p.y + PLAYER_SIZE, '#aa00ff', 4, 2);

  } else if (mode === MODE_SAW) {
    // SAW: flip gravity
    p.gravityDir *= -1;
    p.vy = 0;
    state.jumps++;
    sfxJump();
    spawnParticles(p.x + PLAYER_SIZE/2, p.y + PLAYER_SIZE/2, '#ff6a00', 6, 2);
    if (p.touchingOrb) activateOrb(p.touchingOrb);
  }
}

// Activates an orb pickup effect
function activateOrb(orb) {
  const p = state.player;
  sfxOrb(orb.orbType);
  spawnParticles(orb.x - state.cameraX + 18, orb.y + 18,
    orb.orbType==='yellow'?'#ffe600':orb.orbType==='pink'?'#ff69b4':'#ff3333', 8, 3);

  if (orb.orbType === 'yellow') {
    p.vy = JUMP_VELOCITY * p.gravityDir;
  } else if (orb.orbType === 'pink') {
    p.vy = JUMP_VELOCITY * 0.5 * p.gravityDir;
  } else if (orb.orbType === 'red') {
    p.vy = JUMP_VELOCITY * 2 * p.gravityDir;
  }
  p.onGround = false;
  state.jumps++;
}

// Activates a portal to change player mode
function activatePortal(newMode) {
  sfxPortal();
  const p = state.player;
  state.mode = newMode;
  p.gravityDir = 1;
  p.vy = 0;
  p.rotation = 0;
  // Reposition player
  if (newMode === MODE_UFO) {
    p.y = FLOOR_Y - PLAYER_SIZE - 20;
  } else if (newMode === MODE_SAW) {
    p.y = FLOOR_Y - PLAYER_SIZE;
  } else {
    p.y = FLOOR_Y - PLAYER_SIZE;
  }
  spawnParticles(PLAYER_X + PLAYER_SIZE/2, FLOOR_Y/2,
    newMode===MODE_UFO?'#aa00ff':newMode===MODE_SAW?'#ff6a00':'#00f5ff', 20, 5);
  showModeIndicator(MODE_NAMES[newMode]);
}

// Shows the current mode indicator on screen
function showModeIndicator(name) {
  modeIndicator.textContent = name;
  modeIndicator.classList.add('show');
  state.modeIndicatorTimer = 120;
}

function playerDie() {
  if (isTester) return;  // tester mode = no death
  if (state.player.dead) return;
  state.player.dead = true;
  sfxDeath();
  spawnParticles(state.player.x + PLAYER_SIZE/2, state.player.y + PLAYER_SIZE/2, '#ff2d78', 20, 5);
  deathFlash.classList.add('flash');
  setTimeout(() => deathFlash.classList.remove('flash'), 500);
  setTimeout(() => endGame(false), 700);
}

// TIMER
function formatTime(s) {
  const m = Math.floor(s/60);
  return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function startTimer() {
  if (isTester) return;  // tester mode — no timer
  state.timerInterval = setInterval(() => {
    if (!gameRunning || gamePaused || state.finished) return;
    state.timeLeft--;
    state.elapsed++;
    const t = state.timeLeft;
    hudTimer.textContent = formatTime(t);
    if (t <= 10) hudTimer.classList.add('timer-anim');
    else hudTimer.classList.remove('timer-anim');
    if (t <= 0) {
      endGame(false);
    }
  }, 1000);
}

// MAIN GAME LOOP 
function gameLoop(ts) {
  if (!gameRunning || gamePaused) return;

  frameTime++;

  // Scroll world
  state.cameraX += SCROLL_SPEED;
  state.worldX  += SCROLL_SPEED;

  // Progress
  const pct = Math.min(100, Math.round(state.worldX / LEVEL_LENGTH * 100));
  progressBar.style.width = pct + '%';
  progressPct.textContent = pct + '%';
  state.score = Math.max(state.score, pct);
  hudScore.textContent = state.score;

  // Level complete
  if (pct >= 100 && !state.finished) {
    endGame(true);
    return;
  }

  // Update
  updatePlayer();
  updateObjects();
  updateParticles();

  // Mode indicator fade
  if (state.modeIndicatorTimer > 0) {
    state.modeIndicatorTimer--;
    if (state.modeIndicatorTimer === 0) modeIndicator.classList.remove('show');
  }

  // Draw
  draw();

  state.raf = requestAnimationFrame(gameLoop);
}

function draw() {
  const camX = state.cameraX;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background 
  drawBackground(ctx, camX, frameTime, state.mode);

  // Objects
  for (const obj of state.objects) {
    const sx = obj.x - camX;
    if (sx < -80 || sx > CANVAS_W + 80) continue;
    if (obj.collected || obj.passed) continue;

    if (obj.type === 'spike') {
      drawSpike(ctx, sx, obj.inverted ? 60 : GROUND_Y, obj.inverted);
    } else if (obj.type === 'coin') {
      ctx.save();
      ctx.translate(sx + COIN_SIZE/2, obj.y + COIN_SIZE/2);
      ctx.rotate(frameTime * 0.04);
      ctx.translate(-(sx+COIN_SIZE/2), -(obj.y+COIN_SIZE/2));
      drawCoin(ctx, sx, obj.y);
      ctx.restore();
    } else if (obj.type === 'orb') {
      ctx.save();
      const pulse = Math.sin(frameTime*0.1)*2;
      ctx.translate(sx + 18 + pulse*0.3, obj.y + 18);
      ctx.translate(-(sx+18), -obj.y-18);
      drawOrb(ctx, sx, obj.y, obj.orbType);
      ctx.restore();
    } else if (obj.type === 'portal') {
      drawPortal(ctx, sx, obj.y, obj.portalMode, frameTime);
    }
  }

  // Player trail
  if (!state.player.dead) {
    const p = state.player;
    const trailColor = state.mode===MODE_UFO?'rgba(170,0,255,0.15)':
                       state.mode===MODE_SAW?'rgba(255,106,0,0.15)':'rgba(0,245,255,0.15)';
    for (let i=1;i<=5;i++) {
      ctx.globalAlpha = (6-i)/10;
      ctx.fillStyle = trailColor.replace('0.15',`${(6-i)*0.03}`);
      ctx.fillRect(p.x - i*6, p.y, PLAYER_SIZE, PLAYER_SIZE);
    }
    ctx.globalAlpha = 1;

    drawPlayer(ctx, p, state.mode, frameTime);
  }

  // Particles
  drawParticles(camX);
}

// Pause-only draw
function drawPaused() {
  frameTime++;
  drawBackground(ctx, state.cameraX, frameTime, state.mode);

  for (const obj of state.objects) {
    const sx = obj.x - state.cameraX;
    if (sx < -80 || sx > CANVAS_W+80) continue;
    if (obj.collected || obj.passed) continue;
    if (obj.type==='spike') drawSpike(ctx,sx,obj.inverted?60:GROUND_Y,obj.inverted);
    else if (obj.type==='coin') drawCoin(ctx,sx,obj.y);
    else if (obj.type==='orb') drawOrb(ctx,sx,obj.y,obj.orbType);
    else if (obj.type==='portal') drawPortal(ctx,sx,obj.y,obj.portalMode,frameTime);
  }
  drawPlayer(ctx, state.player, state.mode, frameTime);
  drawParticles(state.cameraX);
  if (gamePaused) requestAnimationFrame(drawPaused);
}

// GAME FLOW 
function showScreen(id) {
  [startScreen, gameScreen, endScreen].forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function startGame() {
  sfxClick();
  frameTime = 0;
  initState();
  gameRunning = true;
  gamePaused  = false;

  // HUD
  if (isTester) {
    hudName.innerHTML = '<i class="fa-solid fa-user-astronaut"></i> TESTER';
  } else {
    hudName.textContent = playerName;
  }
  hudName.className = isTester ? 'hud-value tester-mode' : 'hud-value';
  testerBadge.className = isTester ? 'tester-badge visible' : 'tester-badge';
  hudTimer.textContent = isTester ? '∞' : formatTime(GAME_DURATION);
  hudScore.textContent = '0';
  hudCoins.textContent = '0';
  progressBar.style.width = '0%';
  progressPct.textContent = '0%';
  hudTimer.classList.remove('timer-anim');
  pauseOverlay.classList.remove('show');
  modeIndicator.classList.remove('show');

  showScreen('game-screen');

  startTimer();
  state.raf = requestAnimationFrame(gameLoop);

  // Intro particle burst
  setTimeout(() => {
    spawnParticles(PLAYER_X + PLAYER_SIZE/2, FLOOR_Y/2, '#00f5ff', 20, 5);
  }, 200);

  showModeIndicator('Куб');
}

function togglePause() {
  if (!gameRunning || state.finished) return;
  gamePaused = !gamePaused;
  sfxClick();
  btnPause.innerHTML = gamePaused
    ? '<i class="fa-solid fa-play"></i> ИГРАТЬ'
    : '<i class="fa-solid fa-pause"></i> ПАУЗА';
  pauseOverlay.classList.toggle('show', gamePaused);

  if (!gamePaused) {
    state.raf = requestAnimationFrame(gameLoop);
  } else {
    drawPaused(); // keep background animated
  }
}

function endGame(win) {
  if (state.finished) return;
  state.finished = true;
  gameRunning = false;
  clearInterval(state.timerInterval);
  cancelAnimationFrame(state.raf);

  if (win) sfxWin();

  const pct    = Math.min(100, Math.round(state.worldX / LEVEL_LENGTH * 100));
  const elapsed= GAME_DURATION - state.timeLeft;
  const score  = state.score + state.coins * 50;

  // Update leaderboard
  const lb = getLB();
  lb.push({ name: isTester ? 'TESTER' : playerName, score, pct, time: elapsed, coins: state.coins, jumps: state.jumps });
  lb.sort((a,b) => b.score - a.score);
  const trimmed = lb.slice(0, 20);
  saveLB(trimmed);

  setTimeout(() => showEndScreen(win, pct, elapsed, score), 800);
}

function showEndScreen(win, pct, elapsed, score) {
  const endTitle = document.getElementById('end-title');
  const endSub   = document.getElementById('end-subtitle');

  endTitle.innerHTML = win
    ? '<i class="fa-solid fa-trophy"></i> Победа!'
    : '<i class="fa-solid fa-skull-crossbones"></i> Гибель!';
  endTitle.className   = 'end-title ' + (win ? 'win' : 'die');
  endSub.textContent   = win ? 'Уровень пройден!' : `Пройдено ${pct}%`;

  document.getElementById('stat-pct').textContent   = pct + '%';
  document.getElementById('stat-time').textContent  = formatTime(elapsed);
  document.getElementById('stat-coins').textContent = state.coins;
  document.getElementById('stat-jumps').textContent = state.jumps;

  // Leaderboard
  const lb = getLB();
  const myScore = score;
  const myIdx   = lb.findIndex(e => e.score === myScore && e.name === (isTester?'TESTER':playerName));

  lbTable.innerHTML = '';
  const medals = [
    '<i class="fa-solid fa-medal" style="color:#ffd700"></i>',
    '<i class="fa-solid fa-medal" style="color:#c0c0c0"></i>',
    '<i class="fa-solid fa-medal" style="color:#cd7f32"></i>',
  ];
  const top10  = lb.slice(0,10);
  const playerInTop = myIdx < 10;

  top10.forEach((entry, i) => {
    const tr = document.createElement('tr');
    const isMe = i === myIdx;
    if (isMe) tr.classList.add('current-player');
    tr.innerHTML = `
      <td>${medals[i] || (i+1)}</td>
      <td>${entry.name}</td>
      <td>${entry.pct}%</td>
      <td>${entry.score}pts</td>
    `;
    lbTable.appendChild(tr);
  });

  if (!playerInTop && myIdx >= 0) {
    const sep = document.createElement('tr');
    sep.innerHTML = '<td colspan="4" style="text-align:center;color:#555;padding:4px 0">···</td>';
    lbTable.appendChild(sep);
    const tr = document.createElement('tr');
    tr.classList.add('current-player');
    const entry = lb[myIdx];
    tr.innerHTML = `
      <td>${myIdx+1}</td>
      <td>${entry.name}</td>
      <td>${entry.pct}%</td>
      <td>${entry.score}pts</td>
    `;
    lbTable.appendChild(tr);
  }

  showScreen('end-screen');
}

// EVENT LISTENERS
nameInput.addEventListener('input', () => {
  const v = nameInput.value.trim();
  btnStart.disabled = v.length === 0;
});

btnStart.addEventListener('click', () => {
  const v = nameInput.value.trim();
  if (!v) return;
  playerName = v;
  isTester = v.toLowerCase() === 'tester';
  startGame();
});

btnPause.addEventListener('click', togglePause);

btnRestart.addEventListener('click', () => { sfxClick(); startGame(); });
btnMenu.addEventListener('click', () => {
  sfxClick();
  gameRunning = false;
  clearInterval(state.timerInterval);
  cancelAnimationFrame(state.raf);
  showScreen('start-screen');
});

// Space = pause
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (document.getElementById('game-screen').classList.contains('hidden')) return;
    togglePause();
  }
});

// LMB = jump / UFO hold start
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  state.ufoHoldDown = true;
  playerJump();
});
canvas.addEventListener('mouseup', () => { state.ufoHoldDown = false; });
canvas.addEventListener('mouseleave', () => { state.ufoHoldDown = false; });

// Touch support
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  state.ufoHoldDown = true;
  playerJump();
}, { passive: false });
canvas.addEventListener('touchend', () => { state.ufoHoldDown = false; });

// Sound toggle
soundBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  soundBtn.innerHTML = isMuted
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
  soundBtn.classList.toggle('muted', isMuted);
  sfxClick();
});

// Font size
document.getElementById('font-inc').addEventListener('click', () => {
  fontSize = Math.min(24, fontSize + 2);
  document.documentElement.style.setProperty('--font-size-base', fontSize+'px');
  sfxClick();
});
document.getElementById('font-dec').addEventListener('click', () => {
  fontSize = Math.max(12, fontSize - 2);
  document.documentElement.style.setProperty('--font-size-base', fontSize+'px');
  sfxClick();
});

// Enter key in name input
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !btnStart.disabled) btnStart.click();
});

initState();