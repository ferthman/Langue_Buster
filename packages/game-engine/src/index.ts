export const CLASSIC_BOARD_SIZE = 8;
export const CLASSIC_TRAY_SIZE = 3;

export type Coordinate = Readonly<{
  x: number;
  y: number;
}>;

export type BoardDimensions = Readonly<{
  width: number;
  height: number;
}>;

export type BoardCellState = 'empty' | 'filled';

export type BoardState = Readonly<{
  width: number;
  height: number;
  cells: readonly BoardCellState[];
}>;

export type PieceDefinition = Readonly<{
  id: PieceId;
  kind: PieceId;
  cells: readonly Coordinate[];
  width: number;
  height: number;
  cellCount: number;
}>;

export type PieceInstance = Readonly<{
  instanceId: string;
  pieceId: PieceId;
}>;

export type TraySlot = PieceInstance | null;
export type TrayState = readonly [TraySlot, TraySlot, TraySlot];

export type EngineRngState = Readonly<{
  seed: number;
  cursor: number;
}>;

export type EngineState = Readonly<{
  board: BoardState;
  tray: TrayState;
  rng: EngineRngState;
  score: number;
  combo: number;
  turn: number;
  lastClearCount: number;
  clearedLinesTotal: number;
}>;

export type PlacementFailureReason = 'out_of_bounds' | 'overlap' | 'invalid_piece';

export type PlacementAttempt = Readonly<{
  trayIndex: number;
  origin: Coordinate;
}>;

export type PlacementResult = Readonly<{
  ok: boolean;
  reason?: PlacementFailureReason;
  translatedCells: readonly Coordinate[];
  occupiedCells: readonly Coordinate[];
}>;

export type LineClearResult = Readonly<{
  rows: readonly number[];
  columns: readonly number[];
  clearedCells: readonly Coordinate[];
  clearedLineCount: number;
}>;

export type ScoreBreakdown = Readonly<{
  placementPoints: number;
  lineClearPoints: number;
  multiLineBonus: number;
  comboBonus: number;
  totalPoints: number;
  clearedRowCount: number;
  clearedColumnCount: number;
}>;

export type RunOverResult = Readonly<{
  isOver: boolean;
  checkedPieceIds: readonly PieceId[];
}>;

export type AppliedPlacement = Readonly<{
  state: EngineState;
  placedPiece: PieceInstance;
  placement: PlacementAttempt;
  placementResult: PlacementResult;
  clearResult: LineClearResult;
  scoreBreakdown: ScoreBreakdown;
}>;

export type GeneratedTray = Readonly<{
  tray: TrayState;
  rng: EngineRngState;
}>;

export type PieceId =
  | 'single_1'
  | 'bar_h_2'
  | 'bar_h_3'
  | 'bar_h_4'
  | 'bar_h_5'
  | 'bar_v_2'
  | 'bar_v_3'
  | 'bar_v_4'
  | 'bar_v_5'
  | 'square_2'
  | 'rect_2x3'
  | 'l3';

type PieceLike = PieceDefinition | PieceInstance | PieceId;

const FILLED: BoardCellState = 'filled';
const EMPTY: BoardCellState = 'empty';
const RNG_STEP = 0x6D2B79F5;

const PIECE_SHAPES: ReadonlyArray<Readonly<{ id: PieceId; cells: readonly Coordinate[] }>> = [
  { id: 'single_1', cells: [{ x: 0, y: 0 }] },
  { id: 'bar_h_2', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  { id: 'bar_h_3', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
  { id: 'bar_h_4', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
  { id: 'bar_h_5', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }] },
  { id: 'bar_v_2', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
  { id: 'bar_v_3', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] },
  { id: 'bar_v_4', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }] },
  { id: 'bar_v_5', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }] },
  { id: 'square_2', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  {
    id: 'rect_2x3',
    cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  },
  { id: 'l3', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
] as const;

const PIECE_CATALOG: readonly PieceDefinition[] = PIECE_SHAPES.map(({ id, cells }) => {
  const normalizedCells = normalizeShape(cells);
  const width = Math.max(...normalizedCells.map((cell) => cell.x)) + 1;
  const height = Math.max(...normalizedCells.map((cell) => cell.y)) + 1;

  return {
    id,
    kind: id,
    cells: normalizedCells,
    width,
    height,
    cellCount: normalizedCells.length,
  };
});

const PIECE_MAP = new Map<PieceId, PieceDefinition>(
  PIECE_CATALOG.map((piece) => [piece.id, piece]),
);

export function createPieceCatalog(): readonly PieceDefinition[] {
  return PIECE_CATALOG;
}

export function normalizeShape(cells: readonly Coordinate[]): readonly Coordinate[] {
  if (cells.length === 0) {
    throw new Error('Piece shapes must contain at least one cell.');
  }

  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));

  return cells
    .map((cell) => ({
      x: cell.x - minX,
      y: cell.y - minY,
    }))
    .sort(compareCoordinates)
    .map(freezeCoordinate);
}

export function createEmptyBoard(dimensions: Partial<BoardDimensions> = {}): BoardState {
  const width = dimensions.width ?? CLASSIC_BOARD_SIZE;
  const height = dimensions.height ?? CLASSIC_BOARD_SIZE;

  if (width <= 0 || height <= 0) {
    throw new Error('Board dimensions must be positive integers.');
  }

  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => EMPTY),
  };
}

export function isWithinBounds(board: BoardState, coordinate: Coordinate): boolean {
  return coordinate.x >= 0
    && coordinate.y >= 0
    && coordinate.x < board.width
    && coordinate.y < board.height;
}

export function getCell(board: BoardState, coordinate: Coordinate): BoardCellState {
  if (!isWithinBounds(board, coordinate)) {
    throw new Error(`Coordinate (${coordinate.x}, ${coordinate.y}) is outside the board.`);
  }

  return board.cells[toBoardIndex(board, coordinate)];
}

export function setCellsFilled(board: BoardState, coordinates: readonly Coordinate[]): BoardState {
  const nextCells = board.cells.slice();

  for (const coordinate of coordinates) {
    if (!isWithinBounds(board, coordinate)) {
      throw new Error(`Cannot fill out-of-bounds coordinate (${coordinate.x}, ${coordinate.y}).`);
    }

    nextCells[toBoardIndex(board, coordinate)] = FILLED;
  }

  return {
    ...board,
    cells: nextCells,
  };
}

export function createSeededGenerator(seed: number): EngineRngState {
  return {
    seed: normalizeSeed(seed),
    cursor: 0,
  };
}

export function generateTray(stateOrSeed: EngineRngState | number): GeneratedTray {
  let rng = typeof stateOrSeed === 'number' ? createSeededGenerator(stateOrSeed) : stateOrSeed;
  const trayEntries: PieceInstance[] = [];

  for (let index = 0; index < CLASSIC_TRAY_SIZE; index += 1) {
    const draw = drawPiece(rng);
    trayEntries.push(draw.piece);
    rng = draw.rng;
  }

  return {
    tray: [trayEntries[0], trayEntries[1], trayEntries[2]],
    rng,
  };
}

export function canPlacePiece(board: BoardState, piece: PieceLike, origin: Coordinate): PlacementResult {
  const resolvedPiece = resolvePiece(piece);
  if (!resolvedPiece) {
    return {
      ok: false,
      reason: 'invalid_piece',
      translatedCells: [],
      occupiedCells: [],
    };
  }

  const translatedCells = translatePieceCells(resolvedPiece, origin);
  const outOfBounds = translatedCells.some((cell) => !isWithinBounds(board, cell));
  if (outOfBounds) {
    return {
      ok: false,
      reason: 'out_of_bounds',
      translatedCells,
      occupiedCells: [],
    };
  }

  const occupiedCells = translatedCells.filter((cell) => getCell(board, cell) === FILLED);
  if (occupiedCells.length > 0) {
    return {
      ok: false,
      reason: 'overlap',
      translatedCells,
      occupiedCells,
    };
  }

  return {
    ok: true,
    translatedCells,
    occupiedCells: [],
  };
}

export function listLegalPlacements(board: BoardState, piece: PieceLike): readonly Coordinate[] {
  const resolvedPiece = resolvePiece(piece);
  if (!resolvedPiece) {
    return [];
  }

  const placements: Coordinate[] = [];
  const maxX = board.width - resolvedPiece.width;
  const maxY = board.height - resolvedPiece.height;

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const origin = freezeCoordinate({ x, y });
      if (canPlacePiece(board, resolvedPiece, origin).ok) {
        placements.push(origin);
      }
    }
  }

  return placements;
}

export function hasAnyLegalPlacement(board: BoardState, piece: PieceLike): boolean {
  return listLegalPlacements(board, piece).length > 0;
}

export function detectClears(board: BoardState): LineClearResult {
  const rows: number[] = [];
  const columns: number[] = [];

  for (let y = 0; y < board.height; y += 1) {
    let full = true;
    for (let x = 0; x < board.width; x += 1) {
      if (getCell(board, { x, y }) !== FILLED) {
        full = false;
        break;
      }
    }

    if (full) {
      rows.push(y);
    }
  }

  for (let x = 0; x < board.width; x += 1) {
    let full = true;
    for (let y = 0; y < board.height; y += 1) {
      if (getCell(board, { x, y }) !== FILLED) {
        full = false;
        break;
      }
    }

    if (full) {
      columns.push(x);
    }
  }

  const cellKeys = new Set<string>();
  const clearedCells: Coordinate[] = [];

  for (const row of rows) {
    for (let x = 0; x < board.width; x += 1) {
      const coordinate = freezeCoordinate({ x, y: row });
      const key = coordinateKey(coordinate);
      if (!cellKeys.has(key)) {
        cellKeys.add(key);
        clearedCells.push(coordinate);
      }
    }
  }

  for (const column of columns) {
    for (let y = 0; y < board.height; y += 1) {
      const coordinate = freezeCoordinate({ x: column, y });
      const key = coordinateKey(coordinate);
      if (!cellKeys.has(key)) {
        cellKeys.add(key);
        clearedCells.push(coordinate);
      }
    }
  }

  clearedCells.sort(compareCoordinates);

  return {
    rows,
    columns,
    clearedCells,
    clearedLineCount: rows.length + columns.length,
  };
}

export function clearLines(board: BoardState, clearResult: LineClearResult): BoardState {
  if (clearResult.clearedCells.length === 0) {
    return board;
  }

  const nextCells = board.cells.slice();

  for (const coordinate of clearResult.clearedCells) {
    nextCells[toBoardIndex(board, coordinate)] = EMPTY;
  }

  return {
    ...board,
    cells: nextCells,
  };
}

export function applyPlacement(
  state: EngineState,
  trayIndex: number,
  origin: Coordinate,
): AppliedPlacement {
  const placedPiece = state.tray[trayIndex];
  if (!placedPiece) {
    throw new Error(`Tray slot ${trayIndex} does not contain an active piece.`);
  }

  const piece = resolvePiece(placedPiece);
  if (!piece) {
    throw new Error(`Tray piece ${placedPiece.pieceId} is not part of the catalog.`);
  }

  const placementResult = canPlacePiece(state.board, piece, origin);
  if (!placementResult.ok) {
    throw new Error(`Illegal placement: ${placementResult.reason ?? 'unknown'}.`);
  }

  const boardAfterPlacement = setCellsFilled(state.board, placementResult.translatedCells);
  const clearResult = detectClears(boardAfterPlacement);
  const boardAfterClears = clearLines(boardAfterPlacement, clearResult);
  const nextCombo = calculateNextCombo(state.combo, state.lastClearCount, clearResult.clearedLineCount);
  const scoreBreakdown = calculateScoreBreakdown(piece, clearResult, nextCombo);

  const generated = generateTray(state.rng);
  const nextTray: TrayState = generated.tray;
  const nextRng = generated.rng;

  return {
    placedPiece,
    placement: {
      trayIndex,
      origin: freezeCoordinate(origin),
    },
    placementResult,
    clearResult,
    scoreBreakdown,
    state: {
      board: boardAfterClears,
      tray: nextTray,
      rng: nextRng,
      score: state.score + scoreBreakdown.totalPoints,
      combo: nextCombo,
      turn: state.turn + 1,
      lastClearCount: clearResult.clearedLineCount,
      clearedLinesTotal: state.clearedLinesTotal + clearResult.clearedLineCount,
    },
  };
}

export function isRunOver(board: BoardState, tray: TrayState): RunOverResult {
  const activePieces = tray
    .filter((piece): piece is PieceInstance => piece !== null)
    .map((piece) => piece.pieceId);

  return {
    isOver: activePieces.every((pieceId) => !hasAnyLegalPlacement(board, pieceId)),
    checkedPieceIds: activePieces,
  };
}

export function serializeEngineState(state: EngineState): string {
  return JSON.stringify(state);
}

export function deserializeEngineState(input: string | EngineState): EngineState {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  return parseEngineState(parsed);
}

export function createInitialEngineState(input: Readonly<{ seed: number }>): EngineState {
  const generated = generateTray(input.seed);

  return {
    board: createEmptyBoard(),
    tray: generated.tray,
    rng: generated.rng,
    score: 0,
    combo: 0,
    turn: 0,
    lastClearCount: 0,
    clearedLinesTotal: 0,
  };
}

function calculateScoreBreakdown(
  piece: PieceDefinition,
  clearResult: LineClearResult,
  combo: number,
): ScoreBreakdown {
  const placementPoints = piece.cellCount;
  const lineClearPoints = clearResult.clearedLineCount * 10;
  const multiLineBonus = Math.max(0, clearResult.clearedLineCount - 1) * 5;
  const comboBonus = clearResult.clearedLineCount > 0 && combo > 0 ? combo * 2 : 0;

  return {
    placementPoints,
    lineClearPoints,
    multiLineBonus,
    comboBonus,
    totalPoints: placementPoints + lineClearPoints + multiLineBonus + comboBonus,
    clearedRowCount: clearResult.rows.length,
    clearedColumnCount: clearResult.columns.length,
  };
}

function calculateNextCombo(
  currentCombo: number,
  previousClearCount: number,
  currentClearCount: number,
): number {
  if (currentClearCount === 0) {
    return 0;
  }

  if (previousClearCount > 0) {
    return currentCombo + 1;
  }

  return 1;
}

function drawPiece(rng: EngineRngState): Readonly<{ piece: PieceInstance; rng: EngineRngState }> {
  const next = nextRandom(rng);
  const pieceIndex = Math.floor(next.value * PIECE_CATALOG.length);
  const piece = PIECE_CATALOG[pieceIndex] ?? PIECE_CATALOG[PIECE_CATALOG.length - 1];

  return {
    piece: {
      instanceId: `p-${next.rng.cursor}`,
      pieceId: piece.id,
    },
    rng: next.rng,
  };
}

function nextRandom(rng: EngineRngState): Readonly<{ value: number; rng: EngineRngState }> {
  const nextCursor = rng.cursor + 1;
  let t = (normalizeSeed(rng.seed) + Math.imul(nextCursor, RNG_STEP)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    rng: {
      seed: normalizeSeed(rng.seed),
      cursor: nextCursor,
    },
  };
}

function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

function resolvePiece(piece: PieceLike): PieceDefinition | null {
  if (typeof piece === 'string') {
    return PIECE_MAP.get(piece) ?? null;
  }

  if ('pieceId' in piece) {
    return PIECE_MAP.get(piece.pieceId) ?? null;
  }

  if ('id' in piece) {
    return PIECE_MAP.get(piece.id) ?? null;
  }

  return null;
}

function translatePieceCells(piece: PieceDefinition, origin: Coordinate): readonly Coordinate[] {
  return piece.cells.map((cell) =>
    freezeCoordinate({
      x: cell.x + origin.x,
      y: cell.y + origin.y,
    }),
  );
}

function coordinateKey(coordinate: Coordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

function compareCoordinates(left: Coordinate, right: Coordinate): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

function freezeCoordinate(coordinate: Coordinate): Coordinate {
  return {
    x: coordinate.x,
    y: coordinate.y,
  };
}

function toBoardIndex(board: BoardState, coordinate: Coordinate): number {
  return coordinate.y * board.width + coordinate.x;
}

function parseEngineState(input: unknown): EngineState {
  if (!isRecord(input)) {
    throw new Error('Serialized engine state must be an object.');
  }

  return {
    board: parseBoardState(input.board),
    tray: parseTrayState(input.tray),
    rng: parseRngState(input.rng),
    score: parseNonNegativeInteger(input.score, 'score'),
    combo: parseNonNegativeInteger(input.combo, 'combo'),
    turn: parseNonNegativeInteger(input.turn, 'turn'),
    lastClearCount: parseNonNegativeInteger(input.lastClearCount, 'lastClearCount'),
    clearedLinesTotal: parseNonNegativeInteger(input.clearedLinesTotal, 'clearedLinesTotal'),
  };
}

function parseBoardState(input: unknown): BoardState {
  if (!isRecord(input)) {
    throw new Error('Board state must be an object.');
  }

  const width = parsePositiveInteger(input.width, 'board.width');
  const height = parsePositiveInteger(input.height, 'board.height');
  if (!Array.isArray(input.cells)) {
    throw new Error('Board cells must be an array.');
  }

  if (input.cells.length !== width * height) {
    throw new Error('Board cells length must match width * height.');
  }

  const cells = input.cells.map((cell) => {
    if (cell !== EMPTY && cell !== FILLED) {
      throw new Error('Board cells must contain only "empty" or "filled".');
    }

    return cell;
  });

  return {
    width,
    height,
    cells,
  };
}

function parseTrayState(input: unknown): TrayState {
  if (!Array.isArray(input) || input.length !== CLASSIC_TRAY_SIZE) {
    throw new Error('Tray state must contain exactly three slots.');
  }

  return [
    parseTraySlot(input[0]),
    parseTraySlot(input[1]),
    parseTraySlot(input[2]),
  ];
}

function parseRngState(input: unknown): EngineRngState {
  if (!isRecord(input)) {
    throw new Error('RNG state must be an object.');
  }

  return {
    seed: parseNonNegativeInteger(input.seed, 'rng.seed'),
    cursor: parseNonNegativeInteger(input.cursor, 'rng.cursor'),
  };
}

function parseTraySlot(input: unknown): TraySlot {
  if (input === null) {
    return null;
  }

  if (!isRecord(input)) {
    throw new Error('Tray entries must be piece instances or null.');
  }

  const instanceId = parseString(input.instanceId, 'tray.instanceId');
  const pieceId = parsePieceId(input.pieceId);

  return {
    instanceId,
    pieceId,
  };
}

function parsePieceId(input: unknown): PieceId {
  if (typeof input !== 'string' || !PIECE_MAP.has(input as PieceId)) {
    throw new Error(`Unknown piece id: ${String(input)}`);
  }

  return input as PieceId;
}

function parsePositiveInteger(input: unknown, field: string): number {
  const value = parseNonNegativeInteger(input, field);
  if (value <= 0) {
    throw new Error(`${field} must be greater than zero.`);
  }

  return value;
}

function parseNonNegativeInteger(input: unknown, field: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }

  return input;
}

function parseString(input: unknown, field: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}
