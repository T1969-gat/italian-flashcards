(function () {
  const STORAGE_KEY = 'italianFlashcards';
  const BOX_WEIGHTS = [0, 16, 8, 4, 2, 1]; // index 0 unused, boxes 1-5

  const promptEl = document.getElementById('prompt');
  const directionEl = document.getElementById('direction');
  const categoryEl = document.getElementById('category');
  const cardEl = document.getElementById('card');
  const inputEl = document.getElementById('answer-input');
  const submitBtn = document.getElementById('submit-btn');
  const feedbackEl = document.getElementById('feedback');
  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackText = document.getElementById('feedback-text');
  const feedbackCorrect = document.getElementById('feedback-correct');
  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  const pctEl = document.getElementById('pct');
  const masteredEl = document.getElementById('mastered');
  const resetBtn = document.getElementById('reset-btn');

  let words = [];
  let stats = {};
  let currentCard = null;
  let correct = 0;
  let total = 0;
  let streak = 0;
  let awaitingNext = false;

  // --- localStorage helpers ---

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        stats = data.stats || {};
      }
    } catch (e) {
      stats = {};
    }
  }

  function saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: stats }));
  }

  function getWordStats(key) {
    if (!stats[key]) {
      stats[key] = { box: 1, correct: 0, wrong: 0, lastSeen: 0 };
    }
    return stats[key];
  }

  function resetProgress() {
    stats = {};
    correct = 0;
    total = 0;
    streak = 0;
    localStorage.removeItem(STORAGE_KEY);
    updateStats();
    nextCard();
  }

  // --- Weighted random card selection ---

  function pickCard() {
    if (words.length === 0) return null;

    // Build candidates: each word x each direction
    var candidates = [];
    for (var i = 0; i < words.length; i++) {
      candidates.push({ word: words[i], direction: 'it-en' });
      candidates.push({ word: words[i], direction: 'en-it' });
    }

    // Apply 70/30 direction weighting combined with box weighting
    var totalWeight = 0;
    var weights = [];
    for (var j = 0; j < candidates.length; j++) {
      var c = candidates[j];
      var key = c.word.italian + '|' + c.direction;
      var ws = getWordStats(key);
      var boxWeight = BOX_WEIGHTS[ws.box] || BOX_WEIGHTS[1];
      var dirWeight = c.direction === 'it-en' ? 0.7 : 0.3;
      var w = boxWeight * dirWeight;
      weights.push(w);
      totalWeight += w;
    }

    // Weighted random selection
    var r = Math.random() * totalWeight;
    var cumulative = 0;
    for (var k = 0; k < candidates.length; k++) {
      cumulative += weights[k];
      if (r <= cumulative) {
        return candidates[k];
      }
    }

    // Fallback (shouldn't reach here)
    return candidates[candidates.length - 1];
  }

  // --- Stats display ---

  function countMastered() {
    var count = 0;
    var seen = {};
    for (var key in stats) {
      if (stats.hasOwnProperty(key)) {
        // Count unique words (either direction at box >= 4 counts the word)
        var word = key.split('|')[0];
        if (stats[key].box >= 4 && !seen[word]) {
          seen[word] = true;
          count++;
        }
      }
    }
    return count;
  }

  function updateStats() {
    scoreEl.textContent = correct + ' / ' + total;
    streakEl.textContent = streak;
    pctEl.textContent = total === 0 ? '--%' : Math.round((correct / total) * 100) + '%';
    if (masteredEl) {
      masteredEl.textContent = countMastered();
    }
  }

  // --- Card flow ---

  function nextCard() {
    awaitingNext = false;
    feedbackEl.classList.add('hidden');
    cardEl.classList.remove('correct', 'incorrect');
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.focus();

    var pick = pickCard();
    if (!pick) {
      promptEl.textContent = 'No words loaded';
      return;
    }

    var word = pick.word;
    var direction = pick.direction;

    var prompt = direction === 'it-en' ? word.italian : word.english;
    var answer = direction === 'it-en' ? word.english : word.italian;

    currentCard = {
      prompt: prompt,
      answer: answer,
      direction: direction,
      category: word.category,
      difficulty: word.difficulty,
      italian: word.italian
    };

    promptEl.textContent = currentCard.prompt;
    directionEl.textContent = direction === 'it-en'
      ? 'Translate to English'
      : 'Traduci in italiano';
    categoryEl.textContent = currentCard.category;
  }

  async function submitAnswer() {
    if (!currentCard || awaitingNext) return;

    var userAnswer = inputEl.value.trim();
    if (!userAnswer) return;

    try {
      var res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAnswer: userAnswer,
          correctAnswer: currentCard.answer
        })
      });
      var result = await res.json();

      total++;
      var key = currentCard.italian + '|' + currentCard.direction;
      var ws = getWordStats(key);
      ws.lastSeen = Date.now();

      if (result.correct) {
        correct++;
        streak++;
        ws.correct++;
        ws.box = Math.min(ws.box + 1, 5);
        cardEl.classList.add('correct');
        feedbackIcon.textContent = '\u2713';
        feedbackText.textContent = 'Correct!';
        feedbackText.className = 'feedback-text correct';
        feedbackCorrect.textContent = '';
      } else {
        streak = 0;
        ws.wrong++;
        ws.box = 1;
        cardEl.classList.add('incorrect');
        feedbackIcon.textContent = '\u2717';
        feedbackText.textContent = 'Not quite';
        feedbackText.className = 'feedback-text incorrect';
        feedbackCorrect.textContent = 'Answer: ' + currentCard.answer;
      }

      saveStats();
      feedbackEl.classList.remove('hidden');
      inputEl.disabled = true;
      awaitingNext = true;
      updateStats();
    } catch (err) {
      feedbackText.textContent = 'Error checking answer';
      feedbackEl.classList.remove('hidden');
    }
  }

  // --- Event listeners ---

  submitBtn.addEventListener('click', function () {
    if (awaitingNext) {
      nextCard();
    } else {
      submitAnswer();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      if (awaitingNext) {
        nextCard();
      } else {
        submitAnswer();
      }
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (confirm('Reset all progress? This will clear your spaced repetition data.')) {
        resetProgress();
      }
    });
  }

  // --- Init ---

  loadStats();
  updateStats();

  fetch('/api/words')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      words = data;
      nextCard();
    })
    .catch(function () {
      promptEl.textContent = 'Error loading words';
    });
})();
