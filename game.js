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

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 60;
    gameOver = false;
    updateTimerDisplay();
    if (restartBtn) restartBtn.style.display = 'none';
    if (playBtn) playBtn.style.display = 'none';
    const titleEl = document.querySelector('#score-container h1');
    if (titleEl) titleEl.textContent = 'Ваши очки';
    if (timerDisplay) timerDisplay.style.display = 'block';
    timerInterval = setInterval(() => {
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
            // Плавно скрываем изображения на плитках
            fadeAllTiles(0, 200);
            // Включаем CSS-состояние завершения игры
            document.body.classList.add('game-over');
        }
    }, 1000);
}

function restartGame() {
    if (timerInterval) clearInterval(timerInterval);
    score = 0;
    scoreDisplay.textContent = score;
    selectedTile = null;
    isBusy = false;
    gameOver = false;
    initBoard();
    // Сначала делаем изображения невидимыми, затем плавно показываем
    board.forEach(row => row.forEach(tile => { if (tile) tile.alpha = 0; }));
    drawBoard();
    fadeAllTiles(1, 200);
    startTimer();
    // Выключаем CSS-состояние завершения игры (панель возвращается влево, канвас появляется)
    document.body.classList.remove('game-over');
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
    await preprocessImages(); // загружаем без ресайза
    await initBoard();
    await resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    if (restartBtn) restartBtn.addEventListener('click', restartGame);
    if (playBtn) playBtn.addEventListener('click', () => {
        // Перелёт блока из центра влево (содержимое меняем сразу, блок один и тот же)
        const titleEl = document.querySelector('#score-container h1');
        if (titleEl) titleEl.textContent = 'Ваши очки';
        if (timerDisplay) timerDisplay.style.display = 'block';
        if (restartBtn) restartBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';
        document.body.classList.remove('start-screen');
        document.body.classList.remove('game-over');
        startTimer();
    });
    // Классы start-screen и no-anim уже проставлены в HTML
    requestAnimationFrame(() => {
        document.body.classList.remove('no-anim');
    });
}

startGame();
