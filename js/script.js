'use strict';

//passing difficulty through the link - 0,1,2
const difficulty = +location.href.split('?')[1].split('=')[1];
let game;
let timer = false;
let startTime;

//main class, keeping all game info
class Minesweeper {
  constructor(options = {}) {

    let loadedData = {};

    //checking for storage and data within
    //if it contains data saving it in loadedData variable
    if (hasSessionStorage && sessionStorage['minesweeper.data']) {
      loadedData = JSON.parse(sessionStorage['minesweeper.data']);
    }

    Object.assign(
      this, {
        board: [], //keep array of Cell objects
        detected: 0, //number of correctly detected mines
        mistaken: 0, //number of incorrectly detected mines
        statusMsg: 'Playing', //status - playing/you lost/you won
        playing: true,
        moves: 0, //number of moves made
        settings: {
          rows: 8, //number of rows, auto 8
          columns: 10, //number of columns, auto 10
          mines: 10 //number of mines, auto 10
        }
      }, { settings: options }, loadedData
    );

    //setting up number of rows, columns, mines depending on difficulty
    if (difficulty === 0) {
      this.settings['rows'] = 8;
      this.settings['columns'] = 10;
      this.settings['mines'] = 10;
    } else if (difficulty === 1)  {
      this.settings['rows'] = 14;
      this.settings['columns'] = 18;
      this.settings['mines'] = 40;
    } else if (difficulty === 2)  {
      this.settings['rows'] = 20;
      this.settings['columns'] = 24;
      this.settings['mines'] = 99;
    }

    //initialising new game and saving
    this.initialise();
    this.save();
  }

  //initialisation function to start a new game
  initialise() {

    //filling matrix with Cell instances with (c, r) coordinates
    for (let r = 0; r < this.settings['rows']; r++) {
      this.board[r] = [];
      for (let c = 0; c < this.settings['columns']; c++) {
        this.board[r].push(new Cell({ x: c, y: r }));
      }
    }

    //randomly putting mines in
    let assignedMines = 0;
    while (assignedMines < this.settings.mines) {
      const rIndex = Math.floor(Math.random() * this.settings.rows);
      const cIndex = Math.floor(Math.random() * this.settings.columns);
      const cell = this.board[rIndex][cIndex];
      if (!cell.isMine) {
        cell.isMine = true;
        cell.value = 'M';
        assignedMines++;
      }
    }

    //counting 'value' of each mine by the number of adjacent mines
    for (let r = 0; r < this.settings['rows']; r++) {
      for (let c = 0; c < this.settings['columns']; c++) {
        if (!this.board[r][c].isMine) {
          let counter = 0;
          const adjCells = this.getAdjacentCells(r, c);
          for (let i = adjCells.length; i--;) {
            if (adjCells[i].isMine) {
              counter++;
            }
          }

          this.board[r][c].value = counter;
        }
      }
    }

    //after initialisation interacting with DOM
    this.render();
  }


  //interaction with DOM
  render() {

    //identificator for CSS
    document.getElementsByClassName('content')[0].setAttribute(
      'id', `difficulty${difficulty}`);

    //initially empty container that is going to be
    //filled in with info about rows, cells, etc
    //dinamically filling it in
    const gameContainer = document.getElementById('game_container');
    gameContainer.innerHTML = '';

    let content = '';
    for (let r = 0; r < this.settings.rows; r++) {
      content += '<div class="row">';
      for (let c = 0; c < this.settings.columns; c++) {
        const cell = this.board[r][c];


        let addСlass = '';
        let txt = '';
        if (cell.isFlagged) {
          addСlass = 'flagged';
        } else if (cell.isRevealed) {
          addСlass = `revealed adj-${cell.value}`;
          txt = (!cell.isMine ? cell.value || '' : '');
        }

        //divide for odd/even necessary only for graphics
        if ((c + r) % 2 === 0) {
          content += `<div class='cell ${addСlass}' id='cell0' data-x='${c}'
          data-y='${r}'>${txt}</div>`;
        } else {
          content += `<div class='cell ${addСlass}' id='cell1' data-x='${c}'
          data-y='${r}'>${txt}</div>`;
        }
      }
      content += '</div>';
    }

    gameContainer.innerHTML = content;

    //replacing default data with initialised
    document.getElementById('rows').value = this.settings['rows'];
    document.getElementById('columns').value = this.settings['columns'];
    document.getElementById('mines').value = this.settings['mines'];
    document.getElementById('mine_count').textContent =
      this.settings['mines'] - (this.mistaken + this.detected);
    document.getElementById('moves_made').textContent = this.moves;
    document.getElementById('game_status').textContent = this.statusMsg;
  }

  //getting adjacent cells
  getAdjacentCells(row, col) {
    const res = [];
    for (let rowPos = row > 0 ? -1 : 0;
      rowPos <= (row < this.settings.rows - 1 ? 1 : 0); rowPos++) {
      for (let colPos = col > 0 ? -1 : 0;
        colPos <= (col < this.settings.columns - 1 ? 1 : 0); colPos++) {
        res.push(this.board[row + rowPos][col + colPos]);
      }
    }
    return res;
  }

  //controlling flow after the cell is open
  revealCell(cell) {

    //starting timer with the first move
    if (!timer) this.startTimer();

    //cell is neither opened nor flagged
    if (!cell.isRevealed && !cell.isFlagged && this.playing) {
      const cellElement = cell.getElement();

      //protectig first move to make it 'safe'
      //if you hit mine with the first move reinitialisation happens
      if (parseInt(document.getElementById('moves_made').textContent, 10) === 1 &&
      cell.isMine) {
        timer = false;
        sessionStorage.clear();
        newGame();
      }

      //add revealed and adj-meaning to cell's classList
      cell.isRevealed = true;
      cellElement.classList.add('revealed', `adj-${cell.value}`);
      cellElement.textContent = (!cell.isMine ? cell.value || '' : '');
      this.validate();

      //end game if cell is mine
      if (cell.isMine &&
      parseInt(document.getElementById('moves_made').textContent, 10) !== 0) {
        this.show();
        timer = false;
        this.statusMsg = 'Sorry, you lost!';
        this.playing = false;
        document.getElementById('game_status').textContent = this.statusMsg;
      } else if (!cell.isFlagged && cell.value === 0) {
        //if cell's value is 0 starting recursion
        //to open adjacent cells
        const adjCells = this.getAdjacentCells(cell.y, cell.x);
        for (let i = 0, j = adjCells.length; i < j; i++) {
          this.revealCell(adjCells[i]);
          this.validate();
        }
      }
    }
  }

  //show all bombs when the game is over
  show() {
    for (let r = 0; r < this.settings['rows']; r++) {
      for (let c = 0; c < this.settings['columns']; c++) {
        if (this.board[r][c].isMine &&
          parseInt(document.getElementById('moves_made').textContent, 10) !== 0) {
          this.revealCell(this.board[r][c]);
        }
      }
    }
  }

  //mark a cell
  flagCell(cell) {
    if (!cell.isRevealed && this.playing) {
      const cellElement = cell.getElement();
      const mineCount = document.getElementById('mine_count');

      if (!cell.isFlagged) {
        cell.isFlagged = true;
        cellElement.classList.add('flagged');
        mineCount.textContent = parseFloat(mineCount.textContent) - 1;
        if (cell.isMine) {
          this.detected++;
        } else {
          this.mistaken++;
        }
        this.validate();
      } else {
        cell.isFlagged = false;
        cellElement.classList.remove('flagged');
        cellElement.textContent = '';
        mineCount.textContent = parseFloat(mineCount.textContent) + 1;
        if (cell.isMine) {
          this.detected--;
        } else {
          this.mistaken--;
        }
      }
    }
  }

  //changing game status
  validate() {
    const gameStatus = document.getElementById('game_status');
    if (this.detected === this.settings.mines && this.mistaken === 0) {
      this.statusMsg = 'You won!';
      this.playing = false;
      gameStatus.textContent = this.statusMsg;
    } else {
      this.statusMsg = 'Playing';
      this.playing = true;
      gameStatus.textContent = this.statusMsg;
    }
    this.save();
  }

  //controlling timer
  countInterval() {
    setInterval(() => {
      const time = document.getElementById('timer');
      if (timer) {
        const now = new Date();
        const secs = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        time.innerHTML = (secs > 999 ? '&#8734' : '' + secs);
      }
    }, 1000);
  }

  //starting timer
  startTimer() {
    startTime = new Date();
    timer = true;
    this.countInterval();
  }

  //saving data in storage
  save() {
    if (!hasSessionStorage) {
      return false;
    } else {
      const data = JSON.stringify(this);
      sessionStorage['minesweeper.data'] = data;
    }
  }
}

//class Cell to track info of internal state
class Cell {
  constructor({
    x, //x coordinate - column
    y, //y coordinate - row
    value = 0,
    //value - M-mine, F-marked, number - quantity of bombs in adjscent cells
    isMine = false, //mine or not
    isRevealed = false, //open or not
    isFlagged = false //marked or not
  }) {
    Object.assign(this, {
      x,
      y,
      value,
      isMine,
      isRevealed,
      isFlagged
    });
  }


  //get cell
  getElement() {
    return document.querySelector(`.cell[data-x='${this.x}'][data-y='${this.y}']`);
  }

}

//function to create new game/Minesweeper class
function newGame(options = {}) {
  game = new Minesweeper(options);
}

//functionality on load
window.onload = function() {

  //initialise game on load
  const options = {
    rows: parseInt(document.getElementById('rows').value, 10),
    columns: parseInt(document.getElementById('columns').value, 10),
    mines: parseInt(document.getElementById('mines').value, 10)
  };

  if (hasSessionStorage) sessionStorage.clear();
  newGame(options);

  //create new game by pressing new game button
  document.getElementById('new_game_button').addEventListener('click', () => {
    if (hasSessionStorage) {
      sessionStorage.clear();
    }
    newGame(options);
  });

  //press left side to open a field
  document.getElementById('game_container').addEventListener('click', e => {
    const target = e.target;
    if (target.classList.contains('cell')) {
      const cell =
      game.board[target.getAttribute('data-y')][target.getAttribute('data-x')];
      if (!cell.isRevealed && game.playing) {
        game.moves++;
        document.getElementById('moves_made').textContent = game.moves;
        game.revealCell(cell);
        game.save();
      }
    }
  });

  //press right side to mark a field as a bomb
  document.getElementById('game_container').addEventListener('contextmenu',
    e => {
      e.preventDefault();
      const target = e.target;
      if (target.classList.contains('cell')) {
        const cell =
        game.board[target.getAttribute('data-y')][target.getAttribute('data-x')];

        if (!cell.isRevealed && game.playing) {
          game.moves++;
          document.getElementById('moves_made').textContent = game.moves;
          game.flagCell(cell);
          game.save();
        }
      }
    });

  //create new game
  newGame();
};

//storage
const hasSessionStorage = (function() {
  try {
    return 'sessionStorage' in window && window['sessionStorage'] !== null;
  } catch (e) {
    return false;
  }
})();
