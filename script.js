const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const boardEl = document.getElementById("board");
const timerEl = document.getElementById("timer");
const msgEl = document.getElementById("message");
const flagBtn = document.getElementById("flagBtn");
const restartBtn = document.getElementById("restartBtn");
const diffBtns = document.querySelectorAll(".difficulty button");

let size = 9;
let mineCount = 10;
let board = [];
let revealedCount = 0;
let isFlagMode = false;
let timer = null;
let time = 0;
let gameOver = false;
let firstClick = true;

// ==== Таймер ====
function startTimer() {
  clearInterval(timer);
  time = 0;
  timerEl.textContent = "0";
  timer = setInterval(() => {
    time++;
    timerEl.textContent = time;
  }, 1000);
}

// ==== Создание поля ====
function createEmptyBoard(n) {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      count: 0
    }))
  );
}

// ==== Расставляем мины ====
function placeMines(n, skipX, skipY) {
  mineCount = Math.floor(n * n * 0.22);
  let placed = 0;
  while (placed < mineCount) {
    const x = Math.floor(Math.random() * n);
    const y = Math.floor(Math.random() * n);
    if (Math.abs(x - skipX) <= 1 && Math.abs(y - skipY) <= 1) continue;
    if (!board[y][x].mine) {
      board[y][x].mine = true;
      placed++;
    }
  }
  // считаем цифры
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (board[y][x].mine) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < n && nx >= 0 && nx < n && board[ny][nx].mine) count++;
        }
      }
      board[y][x].count = count;
    }
  }
}

// ==== Генерация игрового поля ====
function generateBoard(n) {
  board = createEmptyBoard(n);
  revealedCount = 0;
  gameOver = false;
  firstClick = true;
  msgEl.textContent = "";
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.addEventListener("click", onCellClick);
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        toggleFlag(cell, x, y);
      });
      boardEl.appendChild(cell);
    }
  }

  clearInterval(timer);
  startTimer();
}

// ==== Флаги ====
function toggleFlag(el, x, y) {
  const cell = board[y][x];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  el.classList.toggle("flag", cell.flagged);
  el.textContent = cell.flagged ? "🚩" : "";
}

// ==== Обработка кликов ====
function onCellClick(e) {
  if (gameOver) return;

  const el = e.currentTarget;          // важно: не e.target
  const x = +el.dataset.x;
  const y = +el.dataset.y;
  const cell = board[y][x];

  // Если клик по уже открытой цифре — всегда выполняем "чорд"
  if (cell.revealed && cell.count > 0) {
    handleNumberClick(x, y);
    return;
  }

  // Режим флажка: на закрытой клетке ставим/снимаем флаг
  if (isFlagMode && !cell.revealed) {
    toggleFlag(el, x, y);
    return;
  }

  // Флаг — не открываем
  if (cell.flagged) return;

  // Первая клетка — безопасная расстановка мин
  if (firstClick) {
    placeMines(size, x, y);
    firstClick = false;
  }

  // Прямой клик по мине
  if (cell.mine) {
    el.classList.add("mine");
    el.textContent = "💣";
    endGame(false);
    return;
  }

  revealCell(x, y);
  checkWin();
}

// ==== Клик по цифре ("чорд") ====
// Если число флагов вокруг равно числу на клетке:
//   - если среди НЕпомеченных соседей есть мина → немедленный взрыв (проигрыш);
//   - иначе открываем все оставшиеся соседние.
function handleNumberClick(x, y) {
  const cell = board[y][x];
  let flagged = 0;
  const hidden = [];
  const neighbors = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
        const ncell = board[ny][nx];
        neighbors.push({ x: nx, y: ny, cell: ncell });
        if (ncell.flagged) flagged++;
        else if (!ncell.revealed) hidden.push({ x: nx, y: ny, cell: ncell });
      }
    }
  }

  if (flagged === cell.count) {
    // Проверяем, нет ли среди неотмеченных соседей мины
    const unflaggedMine = hidden.find(({ cell }) => cell.mine);
    if (unflaggedMine) {
      const boomEl = getCellEl(unflaggedMine.x, unflaggedMine.y);
      boomEl.classList.add("mine");
      boomEl.textContent = "💣";
      endGame(false);
      return;
    }
    // Открываем оставшиеся
    hidden.forEach(({ x, y }) => revealCell(x, y));
    checkWin();
  } else {
    // Подсветка недостающих
    hidden.forEach(({ x, y }) => getCellEl(x, y).classList.add("hint"));
    setTimeout(() => {
      hidden.forEach(({ x, y }) => getCellEl(x, y).classList.remove("hint"));
    }, 500);
  }
}

// ==== Открытие клеток ====
// На всякий случай: если сюда попадёт мина (например, через "чорд") — сразу взрыв.
function revealCell(x, y) {
  const cell = board[y][x];
  if (cell.revealed || cell.flagged) return;

  if (cell.mine) {
    const elMine = getCellEl(x, y);
    elMine.classList.add("mine");
    elMine.textContent = "💣";
    endGame(false);
    return;
  }

  cell.revealed = true;
  revealedCount++;
  const el = getCellEl(x, y);
  el.classList.add("revealed");

  if (cell.count > 0) {
    el.textContent = cell.count;
  } else {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < size && nx >= 0 && nx < size) revealCell(nx, ny);
      }
    }
  }
}

// ==== Проверка победы ====
function checkWin() {
  const totalSafe = size * size - mineCount;
  if (revealedCount >= totalSafe) endGame(true);
}

// ==== Вспомогательные ====
function getCellEl(x, y) {
  return boardEl.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function revealMines() {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = board[y][x];
      if (cell.mine) {
        const el = getCellEl(x, y);
        el.classList.add("mine");
        el.textContent = "💣";
      }
    }
  }
}

// ==== Завершение игры ====
function endGame(win) {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timer);

  if (!win) {
    msgEl.textContent = "💥 Игра окончена!";
    revealMines();
  } else {
    msgEl.textContent = "🎉 Победа!";
    if (tg) {
      try {
        tg.sendData(JSON.stringify({
  action: "sapper_score",
  time,
  size
}));

      } catch (err) {
        console.error("sendData error:", err);
      }
      setTimeout(() => tg.close(), 2000);
    }
  }
}

// ==== Кнопки ====
flagBtn.addEventListener("click", () => {
  isFlagMode = !isFlagMode;
  flagBtn.classList.toggle("active", isFlagMode);
  flagBtn.setAttribute("aria-pressed", String(isFlagMode));
});

restartBtn.addEventListener("click", () => generateBoard(size));

diffBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    diffBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    size = +btn.dataset.size;
    generateBoard(size);
  });
});

// ==== Старт ====
generateBoard(size);

