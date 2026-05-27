(function () {
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

  let currentCard = null;
  let correct = 0;
  let total = 0;
  let streak = 0;
  let awaitingNext = false;

  function updateStats() {
    scoreEl.textContent = correct + ' / ' + total;
    streakEl.textContent = streak;
    pctEl.textContent = total === 0 ? '--%' : Math.round((correct / total) * 100) + '%';
  }

  async function nextCard() {
    awaitingNext = false;
    feedbackEl.classList.add('hidden');
    cardEl.classList.remove('correct', 'incorrect');
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.focus();

    try {
      const res = await fetch('/api/quiz');
      currentCard = await res.json();

      promptEl.textContent = currentCard.prompt;
      directionEl.textContent = currentCard.direction === 'it-en'
        ? 'Translate to English'
        : 'Traduci in italiano';
      categoryEl.textContent = currentCard.category;
    } catch (err) {
      promptEl.textContent = 'Error loading card';
    }
  }

  async function submitAnswer() {
    if (!currentCard || awaitingNext) return;

    const userAnswer = inputEl.value.trim();
    if (!userAnswer) return;

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAnswer: userAnswer,
          correctAnswer: currentCard.answer
        })
      });
      const result = await res.json();

      total++;

      if (result.correct) {
        correct++;
        streak++;
        cardEl.classList.add('correct');
        feedbackIcon.textContent = '\u2713';
        feedbackText.textContent = 'Correct!';
        feedbackText.className = 'feedback-text correct';
        feedbackCorrect.textContent = '';
      } else {
        streak = 0;
        cardEl.classList.add('incorrect');
        feedbackIcon.textContent = '\u2717';
        feedbackText.textContent = 'Not quite';
        feedbackText.className = 'feedback-text incorrect';
        feedbackCorrect.textContent = 'Answer: ' + currentCard.answer;
      }

      feedbackEl.classList.remove('hidden');
      inputEl.disabled = true;
      awaitingNext = true;
      updateStats();
    } catch (err) {
      feedbackText.textContent = 'Error checking answer';
      feedbackEl.classList.remove('hidden');
    }
  }

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

  // Start
  updateStats();
  nextCard();
})();
