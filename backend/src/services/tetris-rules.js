// Keep in sync with frontend/src/components/games/tetris/tetris-rules.ts.
// SRS offsets use board coordinates: positive y points down.
const JLSTZ_KICKS = {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const I_KICKS = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};
export const getRotationCandidates = (piece, clockwise) => {
    const rotation = (piece.rotation + (clockwise ? 1 : 3)) % 4;
    const kicks = piece.type === 'O' ? [[0, 0]]
        : (piece.type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${piece.rotation}>${rotation}`];
    return kicks.map(([dx, dy], lastRotationKick) => ({
        ...piece, rotation, x: piece.x + dx, y: piece.y + dy, lastRotationKick,
    }));
};
export const detectTSpin = (piece, board) => {
    if (piece.type !== 'T' || piece.lastRotationKick === undefined)
        return null;
    const occupied = (x, y) => (x < 0 || x >= board[0].length || y >= board.length || (y >= 0 && Boolean(board[y][x])));
    const corners = [
        occupied(piece.x, piece.y), occupied(piece.x + 2, piece.y),
        occupied(piece.x, piece.y + 2), occupied(piece.x + 2, piece.y + 2),
    ];
    if (corners.filter(Boolean).length < 3)
        return null;
    const [frontA, frontB] = [[0, 1], [1, 3], [2, 3], [0, 2]][piece.rotation];
    // The fifth SRS test upgrades a mini, including T-spin triple kicks.
    return (corners[frontA] && corners[frontB]) || piece.lastRotationKick === 4 ? 'full' : 'mini';
};
export const scoreClear = (spin, lines, level, previousCombo, wasBackToBack = false) => {
    const combo = lines > 0 ? previousCombo + 1 : -1;
    const difficult = lines > 0 && (spin !== null || lines >= 4);
    const bonus = difficult && wasBackToBack;
    const points = spin === 'full' ? [400, 800, 1200, 1600]
        : spin === 'mini' ? [100, 200, 400] : [0, 100, 300, 500, 800];
    const baseScore = points[lines] ?? lines * 250;
    const attacks = spin === 'full' ? [0, 2, 4, 6]
        : spin === 'mini' ? [0, 0, 1] : [0, 0, 1, 2, 4];
    const attackRows = (attacks[lines] ?? Math.max(0, lines - 1)) + (bonus ? 1 : 0);
    const label = spin
        ? `${bonus ? 'BACK-TO-BACK • ' : ''}T-SPIN${spin === 'mini' ? ' MINI' : ''}${lines ? ` ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][lines]}` : ''}!${combo > 0 ? ` • ${combo + 1}x combo` : ''}`
        : null;
    return {
        combo,
        backToBack: lines === 0 ? wasBackToBack : difficult,
        gained: Math.round((baseScore * (bonus ? 1.5 : 1) + Math.max(0, combo) * 50) * level),
        attackRows,
        label,
    };
};
