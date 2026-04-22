export type BoardCell = {
  id: string;
  x: number;
  y: number;
  occupied: boolean;
};

export type GameBoardState = {
  size: number;
  cells: BoardCell[];
};

export const classicRunDefaults = {
  boardSize: 8,
  traySize: 3,
  hearts: 3,
} as const;

export function createEmptyBoard(size: number): GameBoardState {
  return {
    size,
    cells: Array.from({ length: size * size }, (_, index) => ({
      id: `cell-${index}`,
      x: index % size,
      y: Math.floor(index / size),
      occupied: false,
    })),
  };
}

