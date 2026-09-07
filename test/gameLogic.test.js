const test = require('node:test');
const assert = require('node:assert/strict');
const { SHIPS, validateFleet, createBoardFromFleet, allShipsSunk } = require('../gameLogic');

const goodFleet = [
  { id: 'carrier', cells: [{row:0,col:0},{row:0,col:1},{row:0,col:2},{row:0,col:3},{row:0,col:4}] },
  { id: 'battleship', cells: [{row:2,col:0},{row:2,col:1},{row:2,col:2},{row:2,col:3}] },
  { id: 'cruiser', cells: [{row:4,col:0},{row:4,col:1},{row:4,col:2}] },
  { id: 'submarine', cells: [{row:6,col:0},{row:6,col:1},{row:6,col:2}] },
  { id: 'destroyer', cells: [{row:8,col:0},{row:8,col:1}] }
];

test('aceita uma frota válida', () => {
  assert.equal(validateFleet(goodFleet).valid, true);
});

test('rejeita navios sobrepostos', () => {
  const bad = structuredClone(goodFleet);
  bad[4].cells = [{row:0,col:0},{row:1,col:0}];
  assert.equal(validateFleet(bad).valid, false);
});

test('rejeita navio com espaços', () => {
  const bad = structuredClone(goodFleet);
  bad[4].cells = [{row:8,col:0},{row:8,col:2}];
  assert.equal(validateFleet(bad).valid, false);
});

test('cria tabuleiro com todos os navios', () => {
  const board = createBoardFromFleet(goodFleet);
  const occupied = board.flat().filter(Boolean);
  assert.equal(occupied.length, SHIPS.reduce((sum, ship) => sum + ship.length, 0));
});

test('detecta quando todos os navios foram afundados', () => {
  const shots = goodFleet.flatMap(ship => ship.cells.map(cell => `${cell.row}:${cell.col}`));
  assert.equal(allShipsSunk(goodFleet, new Set(shots)), true);
});
