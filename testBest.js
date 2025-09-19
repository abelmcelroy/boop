const NegamaxAlphaBeta = require("negamax-alpha-beta");
const { Network } = require("neataptic");
const { Game } = require("./boop.js");
const fs = require("fs");
const { resolve } = require("path");

const SEARCH_DEPTH = 3;
const filename = "next_gen_shit"

let negamaxConfig = {
  generateMoves: (game) => game.current.availableMoves(),
  makeMove: (game, move) => game.makeMove(...move) || true,
  unmakeMove: (game) => game.unmakeMove(),
  evaluate: (game) => game.current.playerTurn ? -game.current.board.score() : game.current.board.score(),
  evaluateTerminal: (game) => game.current.winner === game.current.playerTurn ? Infinity : game.current.winner !== null ? -Infinity : null,
};

const negamax = new NegamaxAlphaBeta(negamaxConfig);

function play(filename = "best_net.json") {
  const saved = JSON.parse(fs.readFileSync(resolve("winning_nets", filename), "utf8"));
  const net1 = Network.fromJSON(saved);
  const net2 = Network.fromJSON(saved);
  const game = new Game(net1, net2);
  while (!game.isOver) {
    let { bestMove } = negamax.search(game, SEARCH_DEPTH);
    game.makeMove(...bestMove);
  }
  return game;
}

const finishedGame = play(filename);
finishedGame.peekHistory();