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
  const progressBtn = document.getElementById('progress-btn');
  const progressModal = document.getElementById('progress-modal');
  const progressList = document.getElementById('progress-list');
  const modalClose = document.getElementById('modal-close');
  const modalFilters = document.getElementById('modal-filters');

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

  // --- Progress modal ---

  var progressFilter = 'struggling'; // 'struggling', 'learning', 'mastered', 'unseen'

  function buildWordMap() {
    // Merge stats with full word list to include unseen words
    var map = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var keyIt = w.italian + '|it-en';
      var keyEn = w.italian + '|en-it';
      var sIt = stats[keyIt] || null;
      var sEn = stats[keyEn] || null;

      // Best box across both directions (for categorisation)
      var bestBox = Math.max(sIt ? sIt.box : 0, sEn ? sEn.box : 0);
      var worstBox = 0;
      if (sIt && sEn) worstBox = Math.min(sIt.box, sEn.box);
      else if (sIt) worstBox = sIt.box;
      else if (sEn) worstBox = sEn.box;

      var totalCorrect = (sIt ? sIt.correct : 0) + (sEn ? sEn.correct : 0);
      var totalWrong = (sIt ? sIt.wrong : 0) + (sEn ? sEn.wrong : 0);
      var seen = sIt || sEn;

      map[w.italian] = {
        italian: w.italian,
        english: w.english,
        category: w.category,
        bestBox: bestBox,
        worstBox: worstBox,
        correct: totalCorrect,
        wrong: totalWrong,
        seen: !!seen,
        itBox: sIt ? sIt.box : 0,
        enBox: sEn ? sEn.box : 0
      };
    }
    return map;
  }

  function getFilteredWords(map) {
    var arr = [];
    for (var key in map) {
      if (map.hasOwnProperty(key)) arr.push(map[key]);
    }

    if (progressFilter === 'struggling') {
      arr = arr.filter(function (w) { return w.seen && w.worstBox <= 2; });
      arr.sort(function (a, b) { return b.wrong - a.wrong || a.worstBox - b.worstBox; });
    } else if (progressFilter === 'learning') {
      arr = arr.filter(function (w) { return w.seen && w.bestBox >= 2 && w.bestBox <= 3; });
      arr.sort(function (a, b) { return a.bestBox - b.bestBox; });
    } else if (progressFilter === 'mastered') {
      arr = arr.filter(function (w) { return w.bestBox >= 4; });
      arr.sort(function (a, b) { return b.bestBox - a.bestBox || b.correct - a.correct; });
    } else {
      arr = arr.filter(function (w) { return !w.seen; });
      arr.sort(function (a, b) { return a.italian.localeCompare(b.italian); });
    }

    return arr;
  }

  function boxLabel(box) {
    if (box === 0) return '--';
    if (box <= 1) return 'New';
    if (box <= 2) return 'Weak';
    if (box <= 3) return 'OK';
    if (box <= 4) return 'Good';
    return 'Solid';
  }

  function boxClass(box) {
    if (box <= 1) return 'box-new';
    if (box <= 2) return 'box-weak';
    if (box <= 3) return 'box-ok';
    return 'box-good';
  }

  function renderFilters(map) {
    var all = [];
    for (var k in map) { if (map.hasOwnProperty(k)) all.push(map[k]); }
    var counts = { struggling: 0, learning: 0, mastered: 0, unseen: 0 };
    for (var i = 0; i < all.length; i++) {
      var w = all[i];
      if (!w.seen) counts.unseen++;
      else if (w.worstBox <= 2) counts.struggling++;
      if (w.seen && w.bestBox >= 2 && w.bestBox <= 3) counts.learning++;
      if (w.bestBox >= 4) counts.mastered++;
    }

    var filters = [
      { key: 'struggling', label: 'Struggling', count: counts.struggling },
      { key: 'learning', label: 'Learning', count: counts.learning },
      { key: 'mastered', label: 'Mastered', count: counts.mastered },
      { key: 'unseen', label: 'Unseen', count: counts.unseen }
    ];

    modalFilters.innerHTML = '';
    for (var j = 0; j < filters.length; j++) {
      var f = filters[j];
      var btn = document.createElement('button');
      btn.className = 'filter-btn' + (f.key === progressFilter ? ' active' : '');
      btn.textContent = f.label + ' (' + f.count + ')';
      btn.setAttribute('data-filter', f.key);
      btn.addEventListener('click', function (e) {
        progressFilter = e.target.getAttribute('data-filter');
        showProgress();
      });
      modalFilters.appendChild(btn);
    }
  }

  function renderProgress(filtered) {
    progressList.innerHTML = '';

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'progress-empty';
      empty.textContent = progressFilter === 'struggling'
        ? 'Nothing here yet — keep practising!'
        : progressFilter === 'mastered'
        ? 'No words mastered yet — you\'ll get there!'
        : progressFilter === 'unseen'
        ? 'You\'ve seen every word!'
        : 'No words in this category yet.';
      progressList.appendChild(empty);
      return;
    }

    for (var i = 0; i < filtered.length; i++) {
      var w = filtered[i];
      var row = document.createElement('div');
      row.className = 'progress-row';

      var wordDiv = document.createElement('div');
      wordDiv.className = 'progress-word';

      var it = document.createElement('span');
      it.className = 'progress-italian';
      it.textContent = w.italian;
      wordDiv.appendChild(it);

      var en = document.createElement('span');
      en.className = 'progress-english';
      en.textContent = w.english;
      wordDiv.appendChild(en);

      var metaDiv = document.createElement('div');
      metaDiv.className = 'progress-meta';

      if (w.seen) {
        var score = document.createElement('span');
        score.className = 'progress-score';
        score.textContent = w.correct + ' right, ' + w.wrong + ' wrong';
        metaDiv.appendChild(score);

        var boxes = document.createElement('span');
        boxes.className = 'progress-boxes';

        var itTag = document.createElement('span');
        itTag.className = 'box-tag ' + boxClass(w.itBox);
        itTag.textContent = 'IT\u2192EN ' + boxLabel(w.itBox);
        boxes.appendChild(itTag);

        var enTag = document.createElement('span');
        enTag.className = 'box-tag ' + boxClass(w.enBox);
        enTag.textContent = 'EN\u2192IT ' + boxLabel(w.enBox);
        boxes.appendChild(enTag);

        metaDiv.appendChild(boxes);
      } else {
        var unseen = document.createElement('span');
        unseen.className = 'progress-score';
        unseen.textContent = 'Not seen yet';
        metaDiv.appendChild(unseen);
      }

      row.appendChild(wordDiv);
      row.appendChild(metaDiv);
      progressList.appendChild(row);
    }
  }

  function showProgress() {
    var map = buildWordMap();
    renderFilters(map);
    var filtered = getFilteredWords(map);
    renderProgress(filtered);
    progressModal.classList.remove('hidden');
  }

  if (progressBtn) {
    progressBtn.addEventListener('click', showProgress);
  }

  if (modalClose) {
    modalClose.addEventListener('click', function () {
      progressModal.classList.add('hidden');
    });
  }

  if (progressModal) {
    progressModal.addEventListener('click', function (e) {
      if (e.target === progressModal) {
        progressModal.classList.add('hidden');
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
