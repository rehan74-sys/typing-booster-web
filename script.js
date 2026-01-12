// Game Configuration
const GRAVITY_BASE = 0.5; // Base pixels per frame
const SPAWN_RATE_BASE = 2500; // ms

// State
let gameState = {
    screen: 'start', // start, level, game, gameOver
    score: 0,
    level: 1,
    lives: 3,
    words: [], // Array of active word objects
    lastSpawnTime: 0,
    gameLoopId: null,
    isPlaying: false,
    wordsTypedInLevel: 0,
    maxUnlockedLevel: 1,
    startTime: 0,
    charactersTyped: 0,
    wpm: 0
};

// DOM Elements
const screenStart = document.getElementById('start-screen');
const screenLevel = document.getElementById('level-screen');
const screenGame = document.getElementById('game-area');
const screenGameOver = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');

const scoreEl = document.getElementById('score-display');
const levelEl = document.getElementById('level-display');
const wpmEl = document.getElementById('wpm-display');
const livesEl = document.getElementById('lives-display');

// Dictionary
const WORD_LIST_EASY = ["code", "data", "byte", "node", "loop", "link", "text", "type", "key", "fan", "cpu", "ram", "git", "web", "app", "api", "css", "html", "java", "ruby"];
const WORD_LIST_MEDIUM = ["system", "server", "python", "script", "hacker", "socket", "packet", "router", "switch", "client", "pixel", "vector", "matrix", "binary", "stream", "buffer", "memory", "kernel"];
const WORD_LIST_HARD = ["algorithm", "firewall", "encryption", "bandwidth", "processor", "interface", "protocol", "framework", "component", "middleware", "repository", "function", "variable", "constant"];
const WORD_LIST_EXPERT = ["polymorphism", "encapsulation", "inheritance", "asynchronous", "concurrency", "distributed", "blockchain", "cybersecurity", "neuralnetwork", "microservice", "virtualization"];

// Initialization
function init() {
    setupEventListeners();
    loadProgress();
}

function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', () => {
        // Continue from max unlocked or level 1
        startGame(gameState.maxUnlockedLevel);
    });
    document.getElementById('levels-btn').addEventListener('click', showLevelSelect);
    document.getElementById('back-home-btn').addEventListener('click', showStartScreen);
    document.getElementById('restart-btn').addEventListener('click', () => startGame(gameState.level));
    document.getElementById('home-btn').addEventListener('click', showStartScreen);

    window.addEventListener('keyup', handleInput);
}

function loadProgress() {
    const saved = localStorage.getItem('neonTyperProgress');
    if (saved) {
        gameState.maxUnlockedLevel = parseInt(saved, 10);
    } else {
        gameState.maxUnlockedLevel = 1;
    }
}

function saveProgress() {
    if (gameState.level >= gameState.maxUnlockedLevel && gameState.level < 50) {
        gameState.maxUnlockedLevel = gameState.level + 1;
        localStorage.setItem('neonTyperProgress', gameState.maxUnlockedLevel);
    }
}

// Navigation
function showStartScreen() {
    hideAllScreens();
    screenStart.classList.remove('hidden');
    screenStart.classList.add('active');
}

function showLevelSelect() {
    hideAllScreens();
    screenLevel.classList.remove('hidden');
    renderLevelGrid();
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    hud.classList.add('hidden');
    gameState.isPlaying = false;
    cancelAnimationFrame(gameState.gameLoopId);
    clearGameArea();
}

// Level Configuration
function getLevelConfig(level) {
    // Difficulty Formula
    let speedMultiplier = 1 + (level * 0.1);
    let spawnRate = Math.max(800, SPAWN_RATE_BASE - (level * 40));

    let wordPool = WORD_LIST_EASY;
    if (level > 10) wordPool = [...WORD_LIST_EASY, ...WORD_LIST_MEDIUM];
    if (level > 20) wordPool = [...WORD_LIST_EASY, ...WORD_LIST_MEDIUM, ...WORD_LIST_HARD];
    if (level > 35) wordPool = [...WORD_LIST_MEDIUM, ...WORD_LIST_HARD, ...WORD_LIST_EXPERT];

    // Boss Level Logic (Every 3rd level)
    const isBoss = (level % 3 === 0);
    if (isBoss) {
        speedMultiplier *= 1.2; // 20% faster on boss levels
        spawnRate *= 0.8; // More frequent spawns
    }

    // Target Score: Level 1 = 100, Level 2 = 200, etc.
    const scoreToPass = level * 100;

    return {
        speed: GRAVITY_BASE * speedMultiplier,
        spawnRate: spawnRate,
        wordPool: wordPool,
        scoreToPass: scoreToPass,
        isBoss: isBoss
    };
}

// Game Logic
function startGame(level) {
    if (level > gameState.maxUnlockedLevel && level !== 1) return; // Prevent cheating via console

    hideAllScreens();
    gameState.level = level;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.words = [];
    gameState.wordsTypedInLevel = 0;
    gameState.isPlaying = true;
    gameState.lastSpawnTime = 0;

    // WPM Init
    gameState.startTime = Date.now();
    gameState.charactersTyped = 0;
    gameState.wpm = 0;

    gameState.currentConfig = getLevelConfig(level);

    hud.classList.remove('hidden');
    updateHUD();

    // Boss Visuals
    if (gameState.currentConfig.isBoss) {
        hud.classList.add('boss-mode');
    } else {
        hud.classList.remove('boss-mode');
    }

    // Start Loop
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!gameState.isPlaying) return;

    updateWPM();

    // Spawning
    if (timestamp - gameState.lastSpawnTime > gameState.currentConfig.spawnRate) {
        spawnWord();
        gameState.lastSpawnTime = timestamp;
    }

    // Updating
    updateWords();

    if (gameState.lives <= 0) {
        gameOver();
        return;
    }

    // Check Level Complete (SCORE BASED)
    if (gameState.score >= gameState.currentConfig.scoreToPass) {
        levelComplete();
        return;
    }

    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function spawnWord() {
    const list = gameState.currentConfig.wordPool;
    const text = list[Math.floor(Math.random() * list.length)];
    const x = Math.random() * (window.innerWidth - 200) + 100; // Padding

    const wordObj = {
        text: text,
        x: x,
        y: -50,
        element: createWordElement(text, x),
        typedIndex: 0
    };

    gameState.words.push(wordObj);
    screenGame.appendChild(wordObj.element);
}

function createWordElement(text, x) {
    const div = document.createElement('div');
    div.classList.add('falling-word');
    div.style.left = `${x}px`;
    div.innerText = text;
    // visual variety
    if (gameState.currentConfig.isBoss) {
        div.classList.add('boss-word');
    }
    return div;
}

function updateWords() {
    gameState.words.forEach((word, index) => {
        word.y += gameState.currentConfig.speed;
        word.element.style.top = `${word.y}px`;

        if (word.y > window.innerHeight) {
            takeDamage();
            removeWord(index);
        }
    });
}

function takeDamage() {
    gameState.lives--;
    updateHUD();
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 200);
}

function removeWord(index) {
    const word = gameState.words[index];
    if (word && word.element) {
        word.element.remove();
    }
    gameState.words.splice(index, 1);
}

function handleInput(e) {
    if (!gameState.isPlaying) return;

    const key = e.key.toLowerCase();

    let activeWord = gameState.words.find(w => w.typedIndex > 0);

    if (activeWord) {
        if (activeWord.text[activeWord.typedIndex] === key) {
            activeWord.typedIndex++;
            gameState.charactersTyped++; // Track char
            highlightWord(activeWord);

            if (activeWord.typedIndex === activeWord.text.length) {
                finishWord(activeWord);
                spawnParticle(activeWord.x, activeWord.y);
            }
        }
    } else {
        const candidates = gameState.words.filter(w => w.text.startsWith(key));
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.y - a.y); // Lowest first
            const target = candidates[0];
            target.typedIndex = 1;
            gameState.charactersTyped++; // Track char
            highlightWord(target);
            if (target.typedIndex === target.text.length) {
                finishWord(target);
                spawnParticle(target.x, target.y);
            }
        }
    }
}

function highlightWord(word) {
    const matched = word.text.substring(0, word.typedIndex);
    const remainder = word.text.substring(word.typedIndex);
    word.element.innerHTML = `<span class="matched">${matched}</span>${remainder}`;
}

function finishWord(wordObj) {
    const index = gameState.words.indexOf(wordObj);
    if (index !== -1) {
        removeWord(index);
        gameState.score += 10;
        gameState.wordsTypedInLevel++;
        updateHUD();
    }
}

function updateWPM() {
    const timeElapsedMin = (Date.now() - gameState.startTime) / 60000;
    if (timeElapsedMin > 0) {
        // Standard formula: (Chars / 5) / Minutes
        const rawWPM = (gameState.charactersTyped / 5) / timeElapsedMin;
        gameState.wpm = Math.round(rawWPM);
        if (wpmEl) wpmEl.innerText = gameState.wpm;
    }
}

function levelComplete() {
    gameState.isPlaying = false;
    cancelAnimationFrame(gameState.gameLoopId);

    saveProgress();

    alert(`LEVEL ${gameState.level} COMPLETE!\nScore Target Reached.\nAverage WPM: ${gameState.wpm}`);

    if (gameState.level < 50) {
        startGame(gameState.level + 1);
    } else {
        alert("YOU WIN! All Systems Verify.");
        showStartScreen();
    }
}

function updateHUD() {
    // Showing Score / Target
    const target = gameState.currentConfig ? gameState.currentConfig.scoreToPass : '??';
    scoreEl.innerText = `${gameState.score} / ${target}`;

    levelEl.innerText = gameState.level.toString().padStart(2, '0');

    // Ensure WPM is updated in HUD 
    if (wpmEl) wpmEl.innerText = gameState.wpm;

    const hearts = livesEl.querySelectorAll('.heart');
    hearts.forEach((heart, i) => {
        if (i < gameState.lives) {
            heart.classList.add('active');
        } else {
            heart.classList.remove('active');
        }
    });
}

function gameOver() {
    gameState.isPlaying = false;
    cancelAnimationFrame(gameState.gameLoopId);
    document.getElementById('final-score').innerText = gameState.score;
    document.getElementById('final-wpm').innerText = gameState.wpm;
    screenGameOver.classList.remove('hidden');
    hud.classList.add('hidden');
}

function clearGameArea() {
    screenGame.innerHTML = '';
    gameState.words = [];
}

function renderLevelGrid() {
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= 50; i++) {
        const node = document.createElement('div');
        node.classList.add('level-node');
        node.innerText = i;

        if (i <= gameState.maxUnlockedLevel) {
            node.classList.add('unlocked');
        } else {
            node.classList.add('locked');
        }

        if (i % 3 === 0) node.classList.add('boss-level');

        node.onclick = () => {
            if (i <= gameState.maxUnlockedLevel) {
                startGame(i);
            }
        };
        grid.appendChild(node);
    }
}

// Minimal Particle System
function spawnParticle(x, y) {
    for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;

        const vx = (Math.random() - 0.5) * 10;
        const vy = (Math.random() - 0.5) * 10;

        screenGame.appendChild(p);

        let opacity = 1;
        const anim = setInterval(() => {
            const currentLeft = parseFloat(p.style.left);
            const currentTop = parseFloat(p.style.top);

            p.style.left = `${currentLeft + vx}px`;
            p.style.top = `${currentTop + vy}px`;

            opacity -= 0.05;
            p.style.opacity = opacity;

            if (opacity <= 0) {
                clearInterval(anim);
                p.remove();
            }
        }, 30);
    }
}

init();
