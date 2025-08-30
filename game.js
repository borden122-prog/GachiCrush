// === Фоновые плитки на стартовом экране ===
const bgTilesContainer = document.getElementById('bg-tiles');
const bgTileImages = [
    'assets/tile1.png',
    'assets/tile2.png',
    'assets/tile3.png',
    'assets/tile4.png',
    'assets/tile5.png',
    'assets/tile6.png'
];
const bgTiles = [];
const BG_TILE_COUNT = 16;
let parallax = {x: 0, y: 0};

function createBgTiles() {
    if (!bgTilesContainer) return;
    bgTilesContainer.innerHTML = '';
    bgTiles.length = 0;
    for (let i = 0; i < BG_TILE_COUNT; i++) {
        const img = document.createElement('img');
        img.src = bgTileImages[Math.floor(Math.random() * bgTileImages.length)];
        // Случайные стартовые позиции и параметры движения
        const angle = Math.random() * 2 * Math.PI;
        const speed = 0.2 + Math.random() * 0.3;
        const radius = 40 + Math.random() * 60;
        const baseX = Math.random() * window.innerWidth;
        const baseY = Math.random() * window.innerHeight;
        const size = 38 + Math.random() * 38;
        img.style.width = img.style.height = size + 'px';
        img.style.opacity = 0.5 + Math.random() * 0.4;
        bgTilesContainer.appendChild(img);
        bgTiles.push({img, angle, speed, radius, baseX, baseY, size});
    }
}

function animateBgTiles() {
    const t = performance.now() / 1000;
    for (const tile of bgTiles) {
        // Круговое движение + parallax
        const x = tile.baseX + Math.cos(tile.angle + t * tile.speed) * tile.radius + parallax.x * 0.18 * (tile.size/60);
        const y = tile.baseY + Math.sin(tile.angle + t * tile.speed) * tile.radius + parallax.y * 0.18 * (tile.size/60);
        tile.img.style.transform = `translate(${x}px, ${y}px)`;
    }
    requestAnimationFrame(animateBgTiles);
}

function updateParallax(e) {
    // e может быть MouseEvent или TouchEvent
    let x = 0, y = 0;
    if (e.touches && e.touches.length) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    parallax.x = (x - window.innerWidth/2) / (window.innerWidth/2);
    parallax.y = (y - window.innerHeight/2) / (window.innerHeight/2);
}

function enableBgTiles() {
    if (!bgTilesContainer) return;
    bgTilesContainer.style.display = 'block';
    createBgTiles();
    animateBgTiles();
    window.addEventListener('mousemove', updateParallax);
    window.addEventListener('touchmove', updateParallax, {passive:true});
}
function disableBgTiles() {
    if (!bgTilesContainer) return;
    bgTilesContainer.style.display = 'none';
    bgTilesContainer.innerHTML = '';
    window.removeEventListener('mousemove', updateParallax);
    window.removeEventListener('touchmove', updateParallax);
}
class Tile {
    constructor(id, image) {
        this.id = id;
        this.image = image;
        this.offsetY = 0;
        this.alpha = 1;
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const restartBtn = document.getElementById('restartBtn');
const playBtn = document.getElementById('playBtn');
const leaderboardEl = document.getElementById('leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');
const publishForm = document.getElementById('publish-result');
const nicknameInput = document.getElementById('nickname');
const cancelBtn = publishForm ? publishForm.querySelector('.cancel-btn') : null;


const LEADERBOARD_API = 'https://gachicrushserver.onrender.com/leaderboard';
const LEADERBOARD_SIZE = 10;

async function getLeaderboard() {
    try {
        const res = await fetch(LEADERBOARD_API);
        if (!res.ok) throw new Error('Ошибка сервера');
        return await res.json();
    } catch {
        return [];
    }
}

async function addToLeaderboard(name, score) {
    try {
        const res = await fetch(LEADERBOARD_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function renderLeaderboard() {
    const loadingEl = document.getElementById('leaderboard-loading');
    if (loadingEl) loadingEl.style.display = 'block';
    leaderboardList.innerHTML = '';
    let lb = [];
    try {
        lb = await getLeaderboard();
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
    if (!lb || lb.length === 0) {
        leaderboardList.innerHTML = '<li class="empty">Пока нет результатов</li>';
        return;
    }
    lb.forEach((entry, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${i+1}. ${escapeHtml(entry.name)}</span><span>${entry.score}</span>`;
        leaderboardList.appendChild(li);
    });
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function showLeaderboard(show = true) {
    if (!leaderboardEl) return;
    leaderboardEl.classList.toggle('visible', show);
    const loadingEl = document.getElementById('leaderboard-loading');
    if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
    if (show) {
        await renderLeaderboard();
    }
}

function showPublishForm(score) {
    if (!publishForm) return;
    publishForm.style.display = 'flex';
    nicknameInput.value = '';
    nicknameInput.focus();
    publishForm.dataset.score = score;
}

function hidePublishForm() {
    if (!publishForm) return;
    publishForm.style.display = 'none';
    publishForm.dataset.score = '';
}

// Параметры игры
const gridSize = 8;
let tileSize;
let score = 0;
let board = [];
let selectedTile = null;
let isBusy = false;
let timeLeft = 60;
let timerInterval = null;
let gameOver = false;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    if (timerDisplay) timerDisplay.textContent = formatTime(timeLeft);
}

async function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 60;
    gameOver = false;
    updateTimerDisplay();
    if (restartBtn) restartBtn.style.display = 'none';
    if (playBtn) playBtn.style.display = 'none';
    const titleEl = document.querySelector('#score-container h1');
    if (titleEl) titleEl.textContent = 'Ваши очки';
    if (timerDisplay) timerDisplay.style.display = 'block';
        if (leaderboardEl) leaderboardEl.classList.remove('visible');
        hidePublishForm();
        timerInterval = setInterval(async () => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            }
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                gameOver = true;
                const titleEl = document.querySelector('#score-container h1');
                if (titleEl) titleEl.textContent = 'Ты набрал';
                if (timerDisplay) timerDisplay.style.display = 'none';
                if (restartBtn) restartBtn.style.display = 'block';
                fadeAllTiles(0, 200);
                document.body.classList.add('game-over');
                // Показываем таблицу лидеров и форму публикации только после завершения игры
                await showLeaderboard(true);
                // Проверяем, достоин ли результат публикации
                const lb = await getLeaderboard();
                if (score > 0 && (lb.length < LEADERBOARD_SIZE || score > lb[lb.length-1].score)) {
                    showPublishForm(score);
                }
            }
        }, 1000);
}

async function restartGame() {
    if (timerInterval) clearInterval(timerInterval);
    score = 0;
    scoreDisplay.textContent = score;
    selectedTile = null;
    isBusy = false;
    gameOver = false;
    initBoard();
    board.forEach(row => row.forEach(tile => { if (tile) tile.alpha = 0; }));
    drawBoard();
    fadeAllTiles(1, 200);
    await startTimer();
    document.body.classList.remove('game-over');
    if (leaderboardEl) leaderboardEl.classList.remove('visible');
    hidePublishForm();
}

// Загрузка PNG-изображений
const tileImages = [
    { id: 1, src: 'assets/tile1.png' },
    { id: 2, src: 'assets/tile2.png' },
    { id: 3, src: 'assets/tile3.png' },
    { id: 4, src: 'assets/tile4.png' },
    { id: 5, src: 'assets/tile5.png' },
    { id: 6, src: 'assets/tile6.png' }
];

// Загружаем изображения без ресайза
async function preprocessImages() {
    return Promise.all(
        tileImages.map(async tile => {
            const img = new Image();
            img.src = tile.src;
            await new Promise(resolve => {
                if (img.complete) resolve();
                else {
                    img.onload = resolve;
                    img.onerror = () => { 
                        console.error(`Ошибка загрузки: ${tile.src}`); 
                        resolve(); 
                    };
                }
            });
            tile.image = img; // сохраняем оригинал
            return tile;
        })
    );
}

// Анимация с Ease Out
function animate(duration, update) {
    return new Promise(resolve => {
        const start = performance.now();
        const easeOut = t => 1 - (1 - t) ** 2;
        const loop = time => {
            let progress = (time - start) / duration;
            if (progress > 1) progress = 1;
            update(easeOut(progress));
            if (progress < 1) requestAnimationFrame(loop);
            else resolve();
        };
        requestAnimationFrame(loop);
    });
}

// Плавное изменение прозрачности всех картинок плиток
async function fadeAllTiles(toAlpha, duration = 200) {
    const starts = board.map(row => row.map(tile => (tile ? tile.alpha : 0)));
    await animate(duration, progress => {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const tile = board[row][col];
                if (!tile) continue;
                const from = starts[row][col];
                tile.alpha = from + (toAlpha - from) * progress;
            }
        }
        drawBoard();
    });
}

// Отрисовка изображения с обрезкой по скруглённым углам
function drawRoundedImage(img, x, y, w, h, r, alpha = 1) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
}

// Инициализация сетки
function initBoard() {
    let hasMatches;
    do {
        board = [];
        for (let row = 0; row < gridSize; row++) {
            board[row] = [];
            for (let col = 0; col < gridSize; col++) {
                const tileData = tileImages[Math.floor(Math.random() * tileImages.length)];
                board[row][col] = new Tile(tileData.id, tileData.image);
            }
        }
        hasMatches = findMatches().size > 0;
    } while (hasMatches);
    score = 0;
    scoreDisplay.textContent = score;
}

// Отрисовка доски
function drawBoard(skipTiles = new Set()) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const key = `${row},${col}`;
            if (skipTiles.has(key)) continue;
            const tile = board[row][col];
            if (tile) {
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.roundRect(col * tileSize, row * tileSize + tile.offsetY, tileSize - 2, tileSize - 2, 16);
                ctx.fill();
                drawRoundedImage(
                    tile.image,
                    col * tileSize,
                    row * tileSize + tile.offsetY,
                    tileSize - 2,
                    tileSize - 2,
                    16,
                    tile.alpha
                );
            }
            if (selectedTile && selectedTile.row === row && selectedTile.col === col) {
                ctx.strokeStyle = 'black';
                const inset = ctx.lineWidth / 2; // половину толщины линии уводим внутрь
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.roundRect(col * tileSize + inset, row * tileSize + (tile ? tile.offsetY : 0) + inset, tileSize - 2 - ctx.lineWidth, tileSize - 2 - ctx.lineWidth, 16);
                ctx.stroke();
            }
        }
    }
}

// Обновление размера Canvas с учётом pixelRatio
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    const scoreContainer = document.getElementById('score-container');
    const scoreWidth = scoreContainer.offsetWidth + 120;
    const maxWidth = window.innerWidth - scoreWidth - 20;
    const maxHeight = window.innerHeight - 80;

    tileSize = Math.min(maxWidth / gridSize, maxHeight / gridSize);

    const logicalWidth = tileSize * gridSize;
    const logicalHeight = tileSize * gridSize;

    // Физический размер под Retina
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    // CSS-размер в логических пикселях
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // Масштабируем контекст под dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.scale(dpr, dpr);

    drawBoard();
}

// Обработка клика
canvas.addEventListener('click', event => asyncHandleClick(event));

async function asyncHandleClick(event) {
    if (isBusy || gameOver) return;
    isBusy = true;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor(x / tileSize);
    const row = Math.floor(y / tileSize);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize && board[row][col]) {
        if (!selectedTile) {
            selectedTile = { row, col };
            drawBoard();
        } else {
            if (isAdjacent(selectedTile, { row, col })) {
                const row1 = selectedTile.row, col1 = selectedTile.col;
                const row2 = row, col2 = col;
                selectedTile = null;
                await animateSwap(row1, col1, row2, col2, true);
                swapTiles(row1, col1, row2, col2);
                if (findMatches().size === 0) {
                    await animateSwap(row1, col1, row2, col2, false);
                    swapTiles(row1, col1, row2, col2);
                } else {
                    await resolveBoard();
                }
                drawBoard();
            } else {
                selectedTile = { row, col };
                drawBoard();
            }
        }
    }
    isBusy = false;
}

// Проверка соседства
function isAdjacent(tile1, tile2) {
    const rowDiff = Math.abs(tile1.row - tile2.row);
    const colDiff = Math.abs(tile1.col - tile2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Обмен плиток
function swapTiles(row1, col1, row2, col2) {
    [board[row1][col1], board[row2][col2]] = [board[row2][col2], board[row1][col1]];
}

// Анимация обмена
async function animateSwap(row1, col1, row2, col2, isForward) {
    let dx = (col2 - col1) * tileSize;
    let dy = (row2 - row1) * tileSize;
    let posA = { x: col1 * tileSize, y: row1 * tileSize };
    let posB = { x: col2 * tileSize, y: row2 * tileSize };
    let imgA = board[row1][col1].image;
    let imgB = board[row2][col2].image;

    if (!isForward) {
        [imgA, imgB] = [imgB, imgA];
        [posA, posB] = [posB, posA];
        dx = -dx;
        dy = -dy;
    }

    const skip = new Set([`${row1},${col1}`, `${row2},${col2}`]);

    await animate(300, progress => {
        drawBoard(skip);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.roundRect(posA.x + dx * progress, posA.y + dy * progress, tileSize - 2, tileSize - 2, 16);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(posB.x - dx * progress, posB.y - dy * progress, tileSize - 2, tileSize - 2, 16);
        ctx.fill();
        drawRoundedImage(
            imgA,
            posA.x + dx * progress,
            posA.y + dy * progress,
            tileSize - 2,
            tileSize - 2,
            16,
            1
        );
        drawRoundedImage(
            imgB,
            posB.x - dx * progress,
            posB.y - dy * progress,
            tileSize - 2,
            tileSize - 2,
            16,
            1
        );
    });
}

// Анимация удаления
async function animateRemove(matches) {
    await animate(200, progress => {
        matches.forEach(({ row, col }) => {
            if (board[row][col]) board[row][col].alpha = 1 - progress;
        });
        drawBoard();
    });
}

// Подготовка падения
function prepareDrop() {
    const drops = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    for (let col = 0; col < gridSize; col++) {
        let fall = 0;
        for (let row = gridSize - 1; row >= 0; row--) {
            if (!board[row][col]) fall++;
            else drops[row][col] = fall;
        }
    }
    return drops;
}

// Анимация падения и заполнения
async function animateDrop() {
    const drops = prepareDrop();
    await animate(300, progress => {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const tile = board[row][col];
                if (tile) tile.offsetY = drops[row][col] * tileSize * progress;
            }
        }
        drawBoard();
    });

    for (let col = 0; col < gridSize; col++) {
        let tempColumn = [];
        for (let row = 0; row < gridSize; row++) {
            if (board[row][col]) tempColumn.push(board[row][col]);
        }
        const numNew = gridSize - tempColumn.length;
        for (let i = 0; i < numNew; i++) {
            const tileData = tileImages[Math.floor(Math.random() * tileImages.length)];
            const newTile = new Tile(tileData.id, tileData.image);
            newTile.offsetY = -tileSize * (numNew - i);
            newTile.alpha = 1;
            tempColumn.unshift(newTile);
        }
        for (let row = 0; row < gridSize; row++) {
            board[row][col] = tempColumn[row];
            if (board[row][col].offsetY > 0) board[row][col].offsetY = 0;
        }
    }

    const initialOffsets = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const tile = board[row][col];
            if (tile && tile.offsetY < 0) initialOffsets[row][col] = tile.offsetY;
        }
    }

    await animate(300, progress => {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const tile = board[row][col];
                const start = initialOffsets[row][col];
                if (tile && start < 0) tile.offsetY = start * (1 - progress);
            }
        }
        drawBoard();
    });

    board.forEach(row => row.forEach(tile => tile && (tile.offsetY = 0)));
}

// Удаление совпадений
async function removeMatchesNoDrop() {
    const matches = findMatches();
    if (matches.size > 0) {
        await animateRemove(matches);
        matches.forEach(({ row, col }) => {
            board[row][col] = null;
            score += 10;
        });
        scoreDisplay.textContent = score;
        return true;
    }
    return false;
}

// Разрешение доски
async function resolveBoard() {
    while (await removeMatchesNoDrop()) await animateDrop();
}

// Поиск совпадений
function findMatches() {
    const matches = new Set();
    for (let row = 0; row < gridSize; row++) {
        let matchLength = 1;
        for (let col = 1; col < gridSize; col++) {
            const prev = board[row][col - 1];
            const curr = board[row][col];
            if (curr && prev && curr.id === prev.id) {
                matchLength++;
            } else {
                if (matchLength >= 3) {
                    for (let i = 1; i <= matchLength; i++) matches.add(`${row},${col - i}`);
                }
                matchLength = 1;
            }
        }
        if (matchLength >= 3) {
            for (let i = 1; i <= matchLength; i++) matches.add(`${row},${gridSize - i}`);
        }
    }
    for (let col = 0; col < gridSize; col++) {
        let matchLength = 1;
        for (let row = 1; row < gridSize; row++) {
            const prev = board[row - 1][col];
            const curr = board[row][col];
            if (curr && prev && curr.id === prev.id) {
                matchLength++;
            } else {
                if (matchLength >= 3) {
                    for (let i = 1; i <= matchLength; i++) matches.add(`${row - i},${col}`);
                }
                matchLength = 1;
            }
        }
        if (matchLength >= 3) {
            for (let i = 1; i <= matchLength; i++) matches.add(`${gridSize - i},${col}`);
        }
    }
    return new Set([...matches].map(key => {
        const [row, col] = key.split(',').map(Number);
        return { row, col };
    }));
}

// Запуск игры
async function startGame() {
    await preprocessImages();
    await initBoard();
    await resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    if (restartBtn) restartBtn.addEventListener('click', restartGame);
    if (playBtn) playBtn.addEventListener('click', async () => {
        disableBgTiles();
        const titleEl = document.querySelector('#score-container h1');
        if (titleEl) titleEl.textContent = 'Ваши очки';
        if (timerDisplay) timerDisplay.style.display = 'block';
        if (restartBtn) restartBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';
        document.body.classList.remove('start-screen');
        document.body.classList.remove('game-over');
        if (leaderboardEl) leaderboardEl.classList.remove('visible');
        hidePublishForm();
        await startTimer();
    });
    // Форма публикации результата
    if (publishForm) {
        publishForm.addEventListener('submit', async e => {
            e.preventDefault();
            const name = nicknameInput.value.trim().slice(0, 16) || 'Игрок';
            const score = parseInt(publishForm.dataset.score, 10) || 0;
            await addToLeaderboard(name, score);
            await renderLeaderboard();
            hidePublishForm();
        });
        if (cancelBtn) {
            cancelBtn.addEventListener('click', e => {
                e.preventDefault();
                hidePublishForm();
            });
        }
    }
    await showLeaderboard(true);
    hidePublishForm();
    requestAnimationFrame(() => {
        document.body.classList.remove('no-anim');
        if (document.body.classList.contains('start-screen')) {
            enableBgTiles();
        }
    });
}

startGame();