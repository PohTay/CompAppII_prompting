/**
 * DYNAMIC SPRITE GENERATION
 * Creates a card sprite sheet on the fly so we don't need external images.
 * Layout: 13 columns (ranks), 5 rows (Clubs, Diamonds, Hearts, Spades, Back)
 */
const suits = ['♣', '♦', '♥', '♠'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function generateSprite() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const cardW = 80;
    const cardH = 112;
    
    // 13 columns, 5 rows (4 suits + 1 row for card back)
    canvas.width = cardW * 13;
    canvas.height = cardH * 5;

    // Draw Card Fronts
    suits.forEach((suit, rowIndex) => {
        ranks.forEach((rank, colIndex) => {
            const x = colIndex * cardW;
            const y = rowIndex * cardH;
            
            // Card Background
            ctx.fillStyle = 'white';
            ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
            
            // Border
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 2, y + 2, cardW - 4, cardH - 4);

            // Color
            ctx.fillStyle = (suit === '♥' || suit === '♦') ? '#d40000' : '#222';
            
            // Draw Corner Rank/Suit
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(rank, x + 12, y + 18);
            ctx.font = '14px sans-serif';
            ctx.fillText(suit, x + 12, y + 34);

            // Draw Center Suit (Larger)
            ctx.font = '40px sans-serif';
            ctx.fillText(suit, x + cardW / 2, y + cardH / 2 + 15);
            
            // Draw Face Card Letters if J, Q, K
            if (['J', 'Q', 'K'].includes(rank)) {
                ctx.globalAlpha = 0.1;
                ctx.font = 'bold 50px serif';
                ctx.fillText(rank, x + cardW/2, y + cardH/2 + 10);
                ctx.globalAlpha = 1.0;
            }
        });
    });

    // Draw Card Back (Row 4)
    const backY = 4 * cardH;
    for (let i = 0; i < 13; i++) {
        const x = i * cardW;
        ctx.fillStyle = 'white';
        ctx.fillRect(x + 2, backY + 2, cardW - 4, cardH - 4); // Border edge
        
        // Pattern
        ctx.fillStyle = '#b71c1c'; // Red back
        ctx.fillRect(x + 6, backY + 6, cardW - 12, cardH - 12);
        
        ctx.fillStyle = '#d32f2f'; // Pattern detail
        ctx.beginPath();
        ctx.arc(x + cardW/2, backY + cardH/2, 20, 0, Math.PI * 2);
        ctx.fill();
    }

    // Apply to CSS
    const dataUrl = canvas.toDataURL();
    document.documentElement.style.setProperty('--card-sprite', `url(${dataUrl})`);
}

generateSprite();

/**
 * SOUND EFFECTS SYSTEM
 */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    // AudioContext requires user interaction to start
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    switch (type) {
        case 'card': // "Thwip" sound for dealing
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;

        case 'win': // Cheerful major arpeggio
            osc.type = 'sine';
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'sine';
                o.frequency.value = freq;
                o.connect(g);
                g.connect(audioCtx.destination);
                g.gain.setValueAtTime(0.1, now + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
                o.start(now + i * 0.1);
                o.stop(now + i * 0.1 + 0.3);
            });
            break;

        case 'lose': // Sad wobble
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
            break;
            
        case 'chip': // Click for buttons/start
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
    }
}

/**
 * GAME LOGIC
 */
const deck = [];
const suitsMap = { '♣': 0, '♦': 1, '♥': 2, '♠': 3 };
const ranksMap = { '2':0, '3':1, '4':2, '5':3, '6':4, '7':5, '8':6, '9':7, '10':8, 'J':9, 'Q':10, 'K':11, 'A':12 };

let playerHand = [];
let dealerHand = [];
let gameOver = false;
let deckIndex = 0;
let wins = 0;
let losses = 0;
let busts = 0;

const els = {
    playerHand: document.getElementById('player-hand'),
    dealerHand: document.getElementById('dealer-hand'),
    playerScore: document.getElementById('player-score'),
    dealerScore: document.getElementById('dealer-score'),
    msgOverlay: document.getElementById('message-overlay'),
    msgText: document.getElementById('message-text'),
    btnHit: document.getElementById('btn-hit'),
    btnStand: document.getElementById('btn-stand'),
    btnNew: document.getElementById('btn-new'),
    winCount: document.getElementById('win-count'),
    lossCount: document.getElementById('loss-count'),
    bustCount: document.getElementById('bust-count')
};

function createDeck() {
    deck.length = 0;
    for (let s of suits) {
        for (let r of ranks) {
            let value = parseInt(r);
            if (['J', 'Q', 'K'].includes(r)) value = 10;
            if (r === 'A') value = 11;
            deck.push({ rank: r, suit: s, value: value });
        }
    }
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    deckIndex = 0;
}

function dealCard() {
    if (deckIndex >= deck.length) {
        shuffleDeck();
    }
    return deck[deckIndex++];
}

function createCardEl(card, isHidden = false) {
    const el = document.createElement('div');
    el.className = 'card';
    
    if (isHidden) {
        el.style.backgroundPosition = `0% 100%`; 
        el.id = 'dealer-hidden-card';
    } else {
        const col = ranksMap[card.rank];
        const row = suitsMap[card.suit];
        const xPct = col * (100 / 12);
        const yPct = row * (100 / 4);
        el.style.backgroundPosition = `${xPct}% ${yPct}%`;
    }
    return el;
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (let c of hand) {
        score += c.value;
        if (c.rank === 'A') aces++;
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

function renderTable(showDealerHidden = false) {
    els.playerHand.innerHTML = '';
    els.dealerHand.innerHTML = '';

    playerHand.forEach(c => els.playerHand.appendChild(createCardEl(c)));
    
    dealerHand.forEach((c, index) => {
        if (index === 0 && !showDealerHidden) {
            els.dealerHand.appendChild(createCardEl(c, true));
        } else {
            els.dealerHand.appendChild(createCardEl(c));
        }
    });

    els.playerScore.innerText = `Player: ${calculateScore(playerHand)}`;
    
    if (showDealerHidden) {
        els.dealerScore.innerText = `Dealer: ${calculateScore(dealerHand)}`;
    } else {
        els.dealerScore.innerText = `Dealer: ?`; 
    }
}

function showMessage(text, color = '#d4af37') {
    els.msgText.innerText = text;
    els.msgText.style.color = color;
    els.msgOverlay.classList.add('show');
}

function hideMessage() {
    els.msgOverlay.classList.remove('show');
}

function endGame() {
    gameOver = true;
    els.btnHit.disabled = true;
    els.btnStand.disabled = true;
    els.btnNew.disabled = false;
}

function startNewGame() {
    // Sound effect: New Game / Chip Click
    playSound('chip');
    
    hideMessage();
    gameOver = false;
    playerHand = [];
    dealerHand = [];
    els.btnHit.disabled = false;
    els.btnStand.disabled = false;
    els.btnNew.disabled = true;

    if (deck.length === 0) {
        createDeck();
        shuffleDeck();
    }

    // Deal initial cards
    playerHand.push(dealCard());
    dealerHand.push(dealCard()); // Hidden
    playerHand.push(dealCard());
    dealerHand.push(dealCard());
    
    // Sound effect: Dealing
    playSound('card');

    renderTable();

    const pScore = calculateScore(playerHand);
    if (pScore === 21) {
        handleRoundEnd();
    }
}

function updateStats() {
    els.winCount.innerText = wins;
    els.lossCount.innerText = losses;
    els.bustCount.innerText = busts;
}

function playerHit() {
    if (gameOver) return;
    
    // Sound effect: Deal one card
    playSound('card');
    
    playerHand.push(dealCard());
    renderTable();
    
    if (calculateScore(playerHand) > 21) {
        renderTable(true);
        showMessage("BUST! You lose.", "#ff4444");
        busts++;
        
        // Sound effect: Lose
        playSound('lose');
        
        updateStats();
        endGame();
    }
}

async function playerStand() {
    if (gameOver) return;
    
    renderTable(true);
    
    let dScore = calculateScore(dealerHand);
    while (dScore < 17) {
        await new Promise(r => setTimeout(r, 600));
        playSound('card'); // Sound effect: Dealer hits
        dealerHand.push(dealCard());
        dScore = calculateScore(dealerHand);
        renderTable(true);
    }

    handleRoundEnd();
}

function handleRoundEnd() {
    const pScore = calculateScore(playerHand);
    const dScore = calculateScore(dealerHand);
    
    renderTable(true);

    if (pScore > 21) {
        showMessage("BUST! You lose.", "#ff4444");
        busts++;
        playSound('lose');
    } else if (dScore > 21) {
        showMessage("Dealer BUSTS! You Win!", "#4CAF50");
        wins++;
        playSound('win');
    } else if (pScore > dScore) {
        showMessage("You Win!", "#4CAF50");
        wins++;
        playSound('win');
    } else if (dScore > pScore) {
        showMessage("Dealer Wins.", "#ff4444");
        losses++;
        playSound('lose');
    } else {
        showMessage("Push (Tie).", "#fff");
        playSound('chip');
    }
    
    updateStats();
    endGame();
}

createDeck();
shuffleDeck();
startNewGame();