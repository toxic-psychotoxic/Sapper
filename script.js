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

const startTimer = () => {
  clearInterval(timer);
  time = 0;
  timerEl.textContent = "0";
  timer = setInterval(() => {
    time++;
    timerEl.textContent = time;
  }, 1000);
};

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

function toggleFlag(el, x, y) {
  const cell = board[y][x];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  el.classList.toggle("flag", cell.flagged);
  el.textContent = cell.flagged ? "🚩" : "";
}

function onCellClick(e) {
  if (gameOver) return;
  const x = +e.target.dataset.x;
  const y = +e.target.dataset.y;
  const cell = board[y][x];

  if (isFlagMode) {
    toggleFlag(e.target, x, y);
    return;
  }
  if (cell.flagged) return;

  if (firstClick) {
    placeMines(size, x, y);
    firstClick = false;
  }

  if (cell.revealed && cell.count > 0) {
    handleNumberClick(x, y);
    return;
  }

  if (cell.mine) {
    e.target.classList.add("mine");
    e.target.textContent = "💣";
    endGame(false);
    return;
  }

  revealCell(x, y);
  checkWin();
}

function handleNumberClick(x, y) {
  const cell = board[y][x];
  let flagged = 0;
  let hidden = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
        const ncell = board[ny][nx];
        if (ncell.flagged) flagged++;
        else if (!ncell.revealed) hidden.push({ x: nx, y: ny });
      }
    }
  }

  if (flagged === cell.count) {
    hidden.forEach(({ x, y }) => revealCell(x, y));
    checkWin();
  } else {
    hidden.forEach(({ x, y }) => getCellEl(x, y).classList.add("hint"));
    setTimeout(() => {
      hidden.forEach(({ x, y }) => getCellEl(x, y).classList.remove("hint"));
    }, 500);
  }
}

function revealCell(x, y) {
  const cell = board[y][x];
  if (cell.revealed || cell.flagged) return;
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
        if (ny >= 0 && ny < size && nx >= 0 && nx < size)
          revealCell(nx, ny);
      }
    }
  }
}

function getCellEl(x, y) {
  return boardEl.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function endGame(win) {
  gameOver = true;
  clearInterval(timer);
  if (!win) {
    msgEl.textContent = "💥 Игра окончена!";
    revealMines();
  } else {
    msgEl.textContent = "🎉 Победа!";
    if (tg) {
      tg.sendData(JSON.stringify({ action: "sapper_score", time }));
      setTimeout(() => tg.close(), 700);
    }
  }
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

function checkWin() {
  const totalSafe = size * size - mineCount;
  if (revealedCount >= totalSafe) endGame(true);
}

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

generateBoard(size);

generateBoard(size);

