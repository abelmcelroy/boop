const NegamaxAlphaBeta = require("negamax-alpha-beta");
const { Neat, methods } = require("neataptic");
const { Game } = require("./boop.js");
const cliProgress = require("cli-progress");
const fs = require("fs");

const GENERATIONS = 2;
const SEARCH_DEPTH = 3;
const POPULATION_SIZE = 10;

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
bar.start(POPULATION_SIZE * (POPULATION_SIZE-1) * GENERATIONS, 0);

let negamaxConfig = {
  generateMoves: (game) => game.current.availableMoves(),
  makeMove: (game, move) => game.makeMove(...move) || true,
  unmakeMove: (game) => game.unmakeMove(),
  evaluate: (game) => game.current.playerTurn ? -game.current.board.score() : game.current.board.score(),
  evaluateTerminal: (game) => game.current.winner === game.current.playerTurn ? Infinity : game.current.winner !== null ? -Infinity : null,
};

const neatConfig = {
  popsize: POPULATION_SIZE,
  elitism: 2,
  mutationRate: 0.3,
  mutation: [
    methods.mutation.MOD_WEIGHT,
    methods.mutation.MOD_BIAS,
    methods.mutation.MOD_ACTIVATION,
  ]
};

const neat = new Neat(41, 1, null, neatConfig);
const negamax = new NegamaxAlphaBeta(negamaxConfig);

function faceOff(net1, net2) {
  const game = new Game(net1, net2);
  while (!game.isOver) {
    let { bestMove } = negamax.search(game, SEARCH_DEPTH);
    game.makeMove(...bestMove);
  }
  bar.increment();
  return game;
}

function train(neat) {
  for (let g = 0; g < GENERATIONS; g++) {
    
    for (const net of neat.population) {
      net.score = 0;
    }

    for (let i = 0; i < neat.popsize; i++) {
      const net1 = neat.population[i];
      for (let j = 0; j < neat.popsize; j++) {
        const net2 = neat.population[j];
        if (i !== j) {
          const finishedGame = faceOff(net1, net2);
          if (finishedGame.current.winner === 0) {
            net1.score += 1;
            net2.score -= 1;
          }
          if (finishedGame.current.winner === 1) {
            net1.score -= 1;
            net2.score += 1;
          }
        }
      }
    }

    for (const net of neat.population) {
      net.score -= 0.001 * (net.nodes.length + net.connections.length);
    }

    neat.sort();
    
    if (g < GENERATIONS - 1) {
      neat.evolve();
    }
  }

  const best = neat.getFittest();
  const json = best.toJSON();
  fs.writeFileSync("best_net.json", JSON.stringify(json));
  console.log(`Best net saved! Score: ${best.score}`);
}

train(neat);
bar.stop();