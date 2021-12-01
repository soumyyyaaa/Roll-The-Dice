'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.2/firebase-app.js';
import { getDatabase, ref, get, set, child, onValue, off }
    from 'https://www.gstatic.com/firebasejs/9.0.2/firebase-database.js';

// Selecting elements
const score0El = document.querySelector('#score--0');
const score1El = document.getElementById('score--1');
const current0El = document.getElementById('current--0');
const current1El = document.getElementById('current--1');

const diceEl = document.querySelector('.dice');
const player0El = document.querySelector('.player--0');
const player1El = document.querySelector('.player--1');

let currentScore = 0;
let activePlayer = 0;
let scores = [0, 0];
let playing = true;
let lobby = 0;
var mpBtnDisabled = false;
var selfPlayer = 0;
let audio = new Audio('ding.mp3');

class MP {
    static initialized = false;
    static connected = false;
    static db = null;
    static firstRun = true;
    static waiting = true;

    static init() {
        if (this.initialized) return;

        initializeApp({
            apiKey: "AIzaSyDJRYKceU0s4JGKGh9so2APSFlHUWWuTn0",
            authDomain: "roll-a-dice-247.firebaseapp.com",
            databaseURL: "https://roll-a-dice-247-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "roll-a-dice-247",
            storageBucket: "roll-a-dice-247.appspot.com",
            messagingSenderId: "553490756756",
            appId: "1:553490756756:web:23cfa21c8b518528dcf081"
        });
        MP.db = getDatabase();
        MP.initialized = true;
    }

    static connect() {
        if (mpBtnDisabled)
            return;

        newGame();
        playing = false;
        mpBtnDisabled = true;
        document.querySelector(".btn--mp").innerHTML = "⌛ Connecting...";
        
        if (MP.firstRun) {
            MP.init();
            MP.firstRun = false;
        }

        // find a lobby
        get(child(ref(MP.db), 'mm')).then(snapshot => {
            var mminfo = { next: 1, waiting: false };
            if (!snapshot.exists())
                set(ref(MP.db, 'mm'), mminfo);
            else
                mminfo = snapshot.val();
        
            lobby = mminfo.next;
        
            var mminfoNew = mminfo;
            if (mminfo.waiting) {
                mminfoNew.next++;
                selfPlayer = 1;
                MP.waiting = false;
            } else {
                selfPlayer = 0;
                MP.waiting = true;
            }
            mminfoNew.waiting = !mminfo.waiting;
            set(ref(MP.db, 'mm'), mminfoNew);
            MP.connected = true;

            // join (set up) that lobby
            set(ref(MP.db, `${lobby}/data/p${selfPlayer}`), true);
            document.getElementById(`name--${selfPlayer}`).innerHTML = "YOU"
            onValue(ref(MP.db, `${lobby}/moves/p${1-selfPlayer}`), ss => {
                if (!ss.exists()) return;

                var move = ss.val().move;
                if (move === 'hold')
                    hold();
                else if (move.startsWith('roll'))
                    roll(parseInt(move.substring(5)));
            });
            onValue(ref(MP.db, `${lobby}/data/p${1-selfPlayer}`), ss => {
                if (ss.exists() && !ss.val())
                    MP.opponentLeft();
            });

            if (selfPlayer === 0) {
                document.querySelector(".btn--mp").innerHTML = "⌛ Waiting...";
                onValue(ref(MP.db, `${lobby}/data`), ss => {
                    if (!ss.exists()) return;
                    if (MP.waiting) {
                        if (ss.val()[`p${1-selfPlayer}`]) {
                            MP.waiting = false;
                            document.querySelector(".btn--mp").innerHTML = "🎲 Joined";
                            playing = true;
                            audio.play();
                            off(ref(MP.db, `${lobby}/data`));
                        } else return;
                    }
                })
            } else {
                document.querySelector(".btn--mp").innerHTML = "🎲 Joined";
                audio.play();
                playing = true;
            }
        })
    }

    static sendMoveHold() {
        set(ref(MP.db, `${lobby}/moves/p${selfPlayer}`), {
            id: Date.now(),
            move: 'hold'
        });
    }

    static sendMoveRoll(num) {
        set(ref(MP.db, `${lobby}/moves/p${selfPlayer}`), {
            id: Date.now(),
            move: `roll ${num}`
        });
    }

    static opponentLeft() {
        document.querySelector(".btn--mp").innerHTML = "🏃‍♀️ Opp. left";
        playing = false;
        off(ref(MP.db, `${lobby}/data/p${1-selfPlayer}`));
    }

    static disconnect() {
        if (!MP.connected) return;

        document.querySelector(".btn--mp").innerHTML = "⌛ Disconnecting...";
        off(ref(MP.db, `${lobby}/moves/p${1-selfPlayer}`));
        off(ref(MP.db, `${lobby}/data/p${1-selfPlayer}`));

        if (MP.waiting)
            set(ref(MP.db, 'mm/waiting'), false);
        else
            set(ref(MP.db, `${lobby}/data/p${selfPlayer}`), false);

        document.querySelector(".btn--mp").innerHTML = "🎲 Multiplayer";
        MP.connected = false;
    }
};

function switchPlayer() {
    document.getElementById(`current--${activePlayer}`).textContent = 0;
    activePlayer = 1 - activePlayer;
    currentScore = 0;
    player0El.classList.toggle('player--active');
    player1El.classList.toggle('player--active');
}

function roll(preset = 0) {
    if (playing) {
        // Generating random dice roll
        const dice = (preset == 0) ? (Math.trunc(Math.random() * 6) + 1) : preset;

        // Display dice
        diceEl.classList.remove('hidden');
        diceEl.src = `dice-${dice}.png`;

        // Check fir rolled 1
        if (dice !== 1) {
            // Add dice to current score
            currentScore = currentScore + dice;
            document.getElementById(`current--${activePlayer}`).textContent =
                currentScore;
        } else {
            // Switch player
            switchPlayer();
        }

        return dice;
    }
}

function hold() {
    if (playing) {
        // Adding current score to active player's score
        scores[activePlayer] += currentScore;
        document.getElementById(`score--${activePlayer}`).textContent =
            scores[activePlayer];

        // Checking score>=100 and finish game
        if (scores[activePlayer] >= 100) {
            playing = false;
            diceEl.classList.add('hidden');
            document
                .querySelector(`.player--${activePlayer}`)
                .classList.add('player--winner');
            document
                .querySelector(`.player--${activePlayer}`)
                .classList.remove('player--active');
        } else {
            switchPlayer();
        }
    }
}

function newGame() {
    score0El.textContent = 0;
    score1El.textContent = 0;
    current0El.textContent = 0;
    current1El.textContent = 0;
    currentScore = 0;
    document
        .querySelector(`.player--${activePlayer}`)
        .classList.remove('player--winner');
    activePlayer = 0;
    scores = [0, 0];
    MP.disconnect();
    playing = true;
    mpBtnDisabled = false;
    diceEl.classList.add('hidden');
    player0El.classList.add('player--active');
    player1El.classList.remove('player--active');

    document.getElementById('name--0').innerHTML = 'Player 1';
    document.getElementById('name--1').innerHTML = 'Player 2';
}

document.getElementById('btnNew').addEventListener('click', newGame);
document.getElementById('btnMp').addEventListener('click', MP.connect);
document.getElementById('btnRoll').addEventListener('click', () => {
    if (MP.connected) {
        if (activePlayer === selfPlayer)
            MP.sendMoveRoll(roll());
    } else roll();
});
document.getElementById('btnHold').addEventListener('click', () => {
    if (MP.connected) {
        if (activePlayer === selfPlayer) {
            hold();
            MP.sendMoveHold();
        }
    } else hold();
});

window.addEventListener('unload', MP.disconnect());

newGame();