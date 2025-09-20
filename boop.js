const KITTEN = "kitten";
const CAT = "cat";
const DELIMITER = "*-----------------*";
const MAX_TURNS = 75;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export class Game {
  constructor(net1, net2) {
    this.history = [new GameState(this)],
    this.net1 = net1;
    this.net2 = net2;
  }

  get current() {
    return this.history[this.history.length-1];
  }

  get isOver() {
    return this.current.winner !== null || this.current.turn >= MAX_TURNS; // it shouldn't take 50 moves to end a game
  }

  makeMove(...args) {
    this.history.push(this.history[this.history.length-1].clone());
    this.history[this.history.length-1].playTurn(...args);
  }

  unmakeMove() {
    this.history.pop();
  }

  peekHistory() {
    for (let gameState of this.history) {
      console.log(DELIMITER);
      console.log(`Turn: ${gameState.turn}, Player: ${gameState.playerTurn + 1}`);
      console.log(`Player 1 has: ${gameState.pools[0][KITTEN]} kittens & ${gameState.pools[0][CAT]} cats in their pool`);
      console.log(`Player 2 has: ${gameState.pools[1][KITTEN]} kittens & ${gameState.pools[1][CAT]} cats in their pool`);
      gameState.board.peek();
      console.log(`${gameState.availableMoves().length} Moves available`)
    }
    console.log(DELIMITER);
  }
}

export class GameState {
  constructor(game) {
    this.game = game;
    this.turn = 0;
    this.pools = [
      { [KITTEN]: 8, [CAT]: 0 },
      { [KITTEN]: 8, [CAT]: 0 },
    ];
    this.board = new Board(this);
    this.winner = null;
  }

  get playerTurn() {
    return this.turn % 2;
  }

  get prev() {
    const index = this.game.history.indexOf(this);
    if (index === 0) return null;
    return this.game.history[index-1];
  }

  get next() {
    const index = this.game.history.indexOf(this);
    if (index + 1 === this.game.history.length) return null;
    return this.game.history[index+1];
  }

  piecesLeftFor(player) {
    return this.pools[player][CAT] + this.pools[player][KITTEN];
  }

  availableCats(player) {
    return this.pools[player][CAT] - this.board.allCatsFor(player).length;
  }

  availableKittens(player) {
    return this.pools[player][KITTEN] - this.board.allKittensFor(player).length;
  }

  playTurn(x, y, type, graduatePositions) {
    this.board.placePiece(x, y, this.turn, type);
    
    if (graduatePositions) {
      const graduateOptions = this.board.findGraduates(this.turn);
      const graduates = graduateOptions.find(option => option.every(p1 => graduatePositions.some(p2 => p1.position[0] === p2[0] && p1.position[1] === p2[1])));
      if (!!graduates !== !!graduatePositions || graduates.length !== graduatePositions.length) throw new Error("Improper graduation attempt");
      for (let graduate of graduates) {
        this.board.remove(...graduate.position);
        if (!graduate.rank) {
          this.pools[graduate.owner][KITTEN]--;
          this.pools[graduate.owner][CAT]++;
        }
      }
    }
    else {
      const graduateOptions = this.board.findGraduates(this.turn);
      if (graduateOptions.length > 0) throw new Error("Missing required graduation attempt");
    }

    this.winner = this.board.winnerIs();
    this.turn++;
  }

  synthTurn(x, y, type) {
    const synth = this.clone();
    if (!synth.board.isEmpty(x, y)) return null;
    synth.board.placePiece(x, y, synth.turn, type);
    return synth;
  }

  availableMoves() {
    const moves = [];
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        if (this.pools[this.playerTurn][KITTEN] > 0) {
          const kittenSynth = this.synthTurn(x, y, KITTEN);
          if (kittenSynth) {
            const kittenGradOptions = kittenSynth.board.findGraduates(kittenSynth.turn);
            if (kittenGradOptions.length) {
              kittenGradOptions.forEach(option => {
                moves.push([x, y, KITTEN, option.map(piece => piece.position)]);
              });
            }
            else {
              moves.push([x, y, KITTEN, null]);
            }
          }
        }

        if (this.pools[this.playerTurn][CAT] > 0) {
          const catSynth = this.synthTurn(x, y, CAT);
          if (catSynth) {
            const catGradOptions = catSynth.board.findGraduates(catSynth.turn);
            if (catGradOptions.length) {
              catGradOptions.forEach(option => {
                moves.push([x, y, CAT, option.map(piece => piece.position)]);
              });
            }
            else {
              moves.push([x, y, CAT, null]);
            }
          }
        }
      }
    }
    return shuffle(moves);
  }

  encodeAsVec() {
    const vec = [];
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        const piece = this.board.atPosition(x, y);
        vec.push(piece ? (piece.rank + 1) * (piece.owner === this.playerTurn ? 1 : -1) / 2 : 0);
      }
    }
    vec.push(this.pools[0][KITTEN] / 8);
    vec.push(this.pools[0][CAT] / 8);
    vec.push(this.pools[1][KITTEN] / 8);
    vec.push(this.pools[1][CAT] / 8);
    vec.push(1/(this.turn+1));
    return vec;
  }

  clone() {
    const cloned = new GameState(this.game);
    cloned.turn = this.turn;
    cloned.winner = this.winner;
    cloned.pools = JSON.parse(JSON.stringify(this.pools));
    cloned.board = this.board.clone(cloned);
    return cloned;
  }
}

export class Board {
  constructor(gameState) {
    this.board = [
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
    ];
    this.gameState = gameState;
  }

  atPosition(x, y) {
    return this.board[y]?.[x] ?? null;
  }

  allPieces() {
    return this.board.flatMap(row => row.filter(cell => !!cell));
  }

  allPiecesFor(player) {
    return this.allPieces().filter(piece => piece.owner === player);
  }

  allCatsFor(player) {
    return this.allPiecesFor(player).filter(piece => piece.rank === 1);
  }

  allKittensFor(player) {
    return this.allPiecesFor(player).filter(piece => piece.rank === 0);
  }

  set(x, y, piece = null) {
    if (!!piece === !!this.board[y][x]) throw new Error(`Cannot ${!piece ? "remove" : "place"} piece ${!piece ? "from" : "in"} ${!piece ? "empty" : "occupied"} cell`);
    this.board[y][x] = piece;
    piece?.position
  }

  move(xFrom, yFrom, xTo, yTo) {
    this.set(xTo, yTo, this.board[yFrom][xFrom]);
    this.set(xFrom, yFrom);
  }

  remove(x, y) {
    const removed = this.atPosition(x, y);
    if (removed) {
      this.gameState.pools[removed.owner][removed.type]++;
      this.set(x, y);
    }
  }

  isEmpty(x, y) {
    return !this.atPosition(x, y);
  }

  findGraduates(turn) {
    let lines = [];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const anchor = this.atPosition(i, j);
        if (anchor?.owner === turn%2) {
          for (let [xInc, yInc] of [[-1, 1], [0, 1], [1, 1], [1, 0]]) {
            const line = anchor.findLine(xInc, yInc);
            if (line && line.some(piece => piece.rank === 0)) lines.push(line);
          }
        }
      }
    }

    if (this.allPiecesFor(turn%2).length === 8 && this.allCatsFor(turn%2) !== 8) {
      lines = lines.concat(this.allKittensFor(turn%2).map(kitten => [kitten]));
    }

    return lines;
  }

  winnerIs() {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const anchor = this.atPosition(i, j);
        if (anchor) {
          for (let [xInc, yInc] of [[-1, 1], [0, 1], [1, 1], [1, 0]]) {
            const line = anchor.findLine(xInc, yInc);
            if (line && line.every(piece => piece.rank === 1)) return anchor.owner;
          }
        }
      }
    }

    if (this.allCatsFor(0).length === 8) return 0
    if (this.allCatsFor(1).length === 8) return 1

    return null;
  }

  placePiece(x, y, turn, type) {
    if (!this.isEmpty(x, y)) throw new Error(`Illegal Move to ${x},${y}`);
    const piece = new Piece(turn%2, type, this);
    this.gameState.pools[turn%2][type]--;
    this.set(x, y, piece);
    piece.pushNeighbors();
  }

  score() {
    const vec = this.gameState.encodeAsVec();
    const net =
      this.gameState.playerTurn === 0
        ? this.gameState.game.net1
        : this.gameState.game.net2;

    const [out] = net.activate(vec);
    if (Number.isNaN(out)) return 0
    if (Number.isFinite(out)) return out < 0 ? -100 : 100;
    return out;
  }

  clone(gameState) {
    const cloned = new Board(gameState);
    for (let piece of this.allPieces()) {
      piece.clone(cloned);
    }
    return cloned;
  }

  peek() {
    // player 1: 🐈, 🐱
    // player 2: 🐓, 🐣
    let top = true;
    for (let row of this.board) {
      const beautified = row.map(cell => {
        if (!cell) return "　";
        else if (!cell.owner) {
          return cell.rank ? "🐈" : "🐱";
        }
        else {
          return cell.rank ? "🐓" : "🐣";
        }
      }).join("│");

      if (top) {
        console.log("┌－┬－┬－┬－┬－┬－┐")
        top = false;
      }
      else {
        console.log("├－+－+－+－+－+－┤")
      }
      console.log("|" + beautified + "|");
    }
    console.log("└－┴－┴－┴－┴－┴－┘");
  }
}

export class Piece {
  constructor(owner, type, board, cloning = false) {
    this.type = type;
    this.owner = owner;
    this.board = board;
    this.cachedPosition = [-1, -1];
    if (!cloning && this.board.gameState.pools[owner][type] === 0) {
      throw new Error("Attempt to use unavailable piece");
    }
  }

  get rank() {
    return this.type === KITTEN ? 0 : 1;
  }

  get position() {
    if (this.board.atPosition(...this.cachedPosition) === this) return this.cachedPosition;
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        if (this.board.board[y][x] === this) {
          this.cachedPosition = [x, y];
          return [x, y];
        }
      }
    }
    return null;
  }

  onEdge() {
    return this.position[0] === 5 || this.position[0] === 0 || this.position[1] === 5 || this.position[1] === 0;
  }

  onRing() {
    return !this.onEdge() && (this.position[0] === 1 || this.position[0] === 4 || this.position[1] === 1 || this.position[1] === 4);
  }

  onCenter() {
    return !this.onEdge() && !this.onRing();
  }

  move(x, y) {
    if (this.board.isEmpty(x, y) && x >= 0 && x < 6 && y >= 0 && y < 6) {
      const [currX, currY] = this.position;
      this.board.move(currX, currY, x, y);
      this.position
    }
  }

  findLine(xInc, yInc) {
    let nextX = this.position[0] + xInc;
    let nextY = this.position[1] + yInc;
    let nextNextX = nextX + xInc;
    let nextNextY = nextY + yInc;
    const next = this.board.atPosition(nextX, nextY);
    const nextNext = this.board.atPosition(nextNextX, nextNextY);
    if (this.owner === next?.owner && this.owner === nextNext?.owner) {
      return [this, next, nextNext];
    }
    else return null;
  }

  neighbors() {
    const them = [];
    const [x, y] = this.position;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (x+i >= 0 && x+i < 6 && y+j >= 0 && y+j < 6 && (i !== 0 || j !== 0)) {
          them.push(this.board.atPosition(x+i, y+j));
        }
      }
    }
    return them;
  }

  pushNeighbors() {
    const neighbors = this.neighbors();
    for (let neighbor of neighbors) {
      if (neighbor && neighbor.rank <= this.rank) {
        let x = (2 * neighbor.position[0]) - this.position[0];
        let y = (2 * neighbor.position[1]) - this.position[1];
        if (x >= 0 && x < 6 && y >=0 && y < 6) {
          neighbor.move(x, y);
        } else {
          this.board.remove(...neighbor.position);
        }
      }
    }
  }

  clone(board) {
    const cloned = new Piece(this.owner, this.type, board, true);
    board.board[this.position[1]][this.position[0]] = cloned;
    return cloned;
  }
}