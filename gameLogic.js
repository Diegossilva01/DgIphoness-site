const BOARD_SIZE = 10;
const SHIPS = [
  { id: 'carrier', name: 'Porta-aviões', length: 5 },
  { id: 'battleship', name: 'Encouraçado', length: 4 },
  { id: 'cruiser', name: 'Cruzador', length: 3 },
  { id: 'submarine', name: 'Submarino', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 }
];

function normalizeCells(cells) {
  return [...cells]
    .map(({ row, col }) => ({ row: Number(row), col: Number(col) }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

function isStraightContiguous(cells) {
  if (!cells.length) return false;
  const normalized = normalizeCells(cells);
  const sameRow = normalized.every(cell => cell.row === normalized[0].row);
  const sameCol = normalized.every(cell => cell.col === normalized[0].col);

  if (!sameRow && !sameCol) return false;

  for (let i = 1; i < normalized.length; i += 1) {
    const prev = normalized[i - 1];
    const current = normalized[i];
    if (sameRow && current.col !== prev.col + 1) return false;
    if (sameCol && current.row !== prev.row + 1) return false;
  }
  return true;
}

function validateFleet(fleet) {
  if (!Array.isArray(fleet) || fleet.length !== SHIPS.length) {
    return { valid: false, error: 'Frota incompleta.' };
  }

  const seen = new Set();
  const expectedById = new Map(SHIPS.map(ship => [ship.id, ship]));

  for (const ship of fleet) {
    if (!ship || typeof ship.id !== 'string' || !expectedById.has(ship.id)) {
      return { valid: false, error: 'Navio inválido.' };
    }

    const expected = expectedById.get(ship.id);
    if (!Array.isArray(ship.cells) || ship.cells.length !== expected.length) {
      return { valid: false, error: `Tamanho inválido para ${expected.name}.` };
    }

    if (!isStraightContiguous(ship.cells)) {
      return { valid: false, error: `${expected.name} precisa estar em linha reta e sem espaços.` };
    }

    for (const rawCell of ship.cells) {
      const row = Number(rawCell.row);
      const col = Number(rawCell.col);
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE) {
        return { valid: false, error: 'Há navios fora do tabuleiro.' };
      }
      const key = `${row}:${col}`;
      if (seen.has(key)) return { valid: false, error: 'Os navios não podem se sobrepor.' };
      seen.add(key);
    }
  }

  const ids = new Set(fleet.map(ship => ship.id));
  if (ids.size !== SHIPS.length || SHIPS.some(ship => !ids.has(ship.id))) {
    return { valid: false, error: 'Frota inválida.' };
  }

  return { valid: true };
}

function createBoardFromFleet(fleet) {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (const ship of fleet) {
    for (const cell of ship.cells) {
      board[cell.row][cell.col] = ship.id;
    }
  }
  return board;
}

function getSunkShipId(fleet, shots, row, col) {
  const hitShip = fleet.find(ship => ship.cells.some(cell => cell.row === row && cell.col === col));
  if (!hitShip) return null;
  const shotSet = new Set(shots);
  const sunk = hitShip.cells.every(cell => shotSet.has(`${cell.row}:${cell.col}`));
  return sunk ? hitShip.id : null;
}

function allShipsSunk(fleet, shots) {
  const shotSet = new Set(shots);
  return fleet.every(ship => ship.cells.every(cell => shotSet.has(`${cell.row}:${cell.col}`)));
}

module.exports = {
  BOARD_SIZE,
  SHIPS,
  validateFleet,
  createBoardFromFleet,
  getSunkShipId,
  allShipsSunk
};
