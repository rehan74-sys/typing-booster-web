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
    wpm: 0,
    deferredPrompt: null // PWA Install Prompt
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
// Dictionary - 5 Tiers (Typing Master Style)
// Dictionary - Specific Level Sets (50 Unique Words each)
const WORDS_1_5 = [
    "cat", "dog", "sun", "run", "sky", "red", "box", "fox", "cup", "hat",
    "bat", "rat", "pen", "ink", "map", "net", "top", "zip", "bed", "car",
    "bus", "log", "pig", "cow", "ant", "bee", "fly", "owl", "yak", "joy",
    "sad", "mad", "big", "hot", "ice", "gem", "key", "lid", "mix", "nut",
    "oil", "pan", "rug", "sea", "tea", "toy", "van", "wax", "yes", "zoo"
]; // 3-4 letters

const WORDS_6_10 = [
    "apple", "bread", "chair", "dance", "eagle", "fruit", "glass", "house", "image", "juice",
    "kite", "lemon", "money", "night", "ocean", "piano", "queen", "river", "snake", "tiger",
    "uncle", "video", "water", "zebra", "alarm", "beach", "cloud", "dream", "earth", "flame",
    "grape", "heart", "igloo", "jelly", "knife", "light", "mouse", "nurse", "onion", "party",
    "quiet", "robot", "sheep", "table", "unity", "voice", "watch", "xenon", "yacht", "zonal"
]; // 4-5 letters (mostly 5)

const WORDS_11_20 = [
    "action", "basket", "candle", "danger", "engine", "family", "garden", "harbor", "island", "jungle",
    "king", "ladder", "magnet", "number", "orange", "planet", "quest", "rocket", "screen", "target",
    "unique", "valley", "window", "yellow", "zipper", "animal", "button", "camera", "doctor", "energy",
    "forest", "garage", "hammer", "insect", "jacket", "kettle", "laptop", "market", "napkin", "office",
    "pencil", "rabbit", "school", "ticket", "umbrella", "velvet", "winter", "yogurt", "zombie", "zero"
]; // Max 7 letters

const WORDS_21_30 = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet",
    "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
    "Uniform", "Victor", "Whiskey", "Xray", "Yankee", "Zulu", "Apple", "Banana", "Cherry", "Date",
    "Elder", "Fig", "Grape", "Hazel", "Iris", "Jasmine", "Kale", "Lily", "Mint", "Neem",
    "Oak", "Pine", "Quill", "Rose", "Sage", "Tulip", "Urn", "Vine", "Willow", "Yew"
]; // Mixed Case

const WORDS_31_50 = [
    "Accomplish", "Background", "Challenge", "Development", "Environment", "Generation", "Hemisphere", "Importance", "Journalist", "Knowledge",
    "Leadership", "Management", "Navigation", "Observation", "Performance", "Question", "Relationship", "Significant", "Technology", "Understanding",
    "Vocabulary", "Wonderland", "Xylophone", "Yesterday", "Zoology", "Architecture", "Biology", "Chemistry", "Democracy", "Economics",
    "Foundation", "Geography", "History", "Identity", "Justice", "Literature", "Mathematics", "Narrative", "Philosophy", "Quantity",
    "Reality", "Sociology", "Tradition", "Universe", "Victory", "Wisdom", "Xenophobia", "Yearning", "Zealous", "Algorithm"
]; // Long & Complex

// Initialization
function init() {
    setupEventListeners();
    loadProgress();
}

function setupEventListeners() {
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const startLevel = parseInt(e.target.dataset.level);
            // Optionally check if unlocked? For now allow "Free Play" style or check max
            // if (startLevel <= gameState.maxUnlockedLevel) ... let's allow selection effectively
            startGame(startLevel);
        });
    });
    // document.getElementById('levels-btn').addEventListener('click', showLevelSelect); -- Level Grid can be an alternate way
    document.getElementById('back-home-btn').addEventListener('click', showStartScreen);
    document.getElementById('restart-btn').addEventListener('click', () => startGame(gameState.level));
    document.getElementById('home-btn').addEventListener('click', showStartScreen);

    window.addEventListener('keyup', handleInput);

    // PWA Install Logic
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        gameState.deferredPrompt = e;
        // Update UI notify the user they can install the PWA
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.addEventListener('click', async () => {
                if (gameState.deferredPrompt) {
                    gameState.deferredPrompt.prompt();
                    const { outcome } = await gameState.deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    gameState.deferredPrompt = null;
                    installBtn.classList.add('hidden');
                }
            });
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        const installBtn = document.getElementById('install-btn');
        if (installBtn) installBtn.classList.add('hidden');
    });
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
    // Difficulty Formula: Aggressive Linear Increase
    // Speed: Starts at 1.0, adds 0.12 per level
    let speedMultiplier = 1 + (level * 0.12);

    // Spawn Rate: Starts at 2500ms, reduces by 45ms per level
    let spawnRate = Math.max(500, SPAWN_RATE_BASE - (level * 45));

    let wordPool = WORDS_1_5;
    let tierName = "Beginner (Lv 1-5)";

    if (level > 5) { wordPool = WORDS_6_10; tierName = "Rookie (Lv 6-10)"; }
    if (level > 10) { wordPool = WORDS_11_20; tierName = "Intermediate (Lv 11-20)"; }
    if (level > 20) { wordPool = WORDS_21_30; tierName = "Advanced (Lv 21-30)"; } // Contains Caps
    if (level > 30) { wordPool = WORDS_31_50; tierName = "Master (Lv 31-50)"; }

    // Boss Level Logic (Every 5th level now for pacing?) - Stick to 3 as per original? User didn't change this.
    // Keeping "Every 3rd level" as "Test/Boss"
    const isBoss = (level % 3 === 0);
    if (isBoss) {
        speedMultiplier *= 1.15; // Speed boost for boss
        spawnRate *= 0.9;
    }

    // Target Score: Level 1 = 300 pts (30 words), Level 50 = ~1500 pts
    const scoreToPass = 300 + (level * 25);

    return {
        speed: GRAVITY_BASE * speedMultiplier,
        spawnRate: spawnRate,
        wordPool: wordPool,
        scoreToPass: scoreToPass,
        isBoss: isBoss,
        tierName: tierName
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

    let inputKey = e.key;
    // Levels 1-20: Case insensitive
    if (gameState.level <= 20) {
        inputKey = inputKey.toLowerCase();
    }
    // Levels 21+: Strict case (inputKey remains as typed)

    // Check Active Word First
    let activeWord = gameState.words.find(w => w.typedIndex > 0);

    if (activeWord) {
        let expectedChar = activeWord.text[activeWord.typedIndex];
        if (gameState.level <= 20) expectedChar = expectedChar.toLowerCase();

        if (expectedChar === inputKey) {
            activeWord.typedIndex++;
            gameState.charactersTyped++;
            highlightWord(activeWord);

            if (activeWord.typedIndex === activeWord.text.length) {
                finishWord(activeWord);
                spawnParticle(activeWord.x, activeWord.y);
            }
        }
    } else {
        // Find Candidate
        const candidates = gameState.words.filter(w => {
            let startChar = w.text[0];
            if (gameState.level <= 20) startChar = startChar.toLowerCase();
            return startChar === inputKey;
        });

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.y - a.y);
            const target = candidates[0];
            target.typedIndex = 1;
            gameState.charactersTyped++;
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
    // Update Tier
    const tierEl = document.getElementById('tier-display');
    if (tierEl && gameState.currentConfig) tierEl.innerText = gameState.currentConfig.tierName;

    // Ensure WPM is updated in HUD 
    if (wpmEl) wpmEl.innerText = gameState.wpm;

    // Update Lives (Dots)
    // We expect 3 dots.
    // Lives = 3 -> All Green (active)
    // Lives = 2 -> 2 Green, 1 Red (lost)
    // Lives = 1 -> 1 Green, 2 Red
    const dots = livesEl.querySelectorAll('.live-dot');
    dots.forEach((dot, i) => {
        // i goes 0, 1, 2. Lives goes 3, 2, 1, 0.
        // If lives = 3: i < 3 (0,1,2) -> active.
        // If lives = 2: i < 2 (0,1) -> active. i=2 -> lost.
        if (i < gameState.lives) {
            dot.classList.add('active');
            dot.classList.remove('lost');
        } else {
            dot.classList.remove('active');
            dot.classList.add('lost');
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
