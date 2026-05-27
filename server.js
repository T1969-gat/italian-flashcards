const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const vocabulary = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'vocabulary.json'), 'utf8')
);

// Strip diacritics for fuzzy comparison
function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Strip leading articles for lenient matching
function stripArticles(str) {
  return str.replace(/^(the|a|an|to|il|lo|la|i|gli|le|un|uno|una)\s+/i, '').trim();
}

// Normalize a string for comparison
function normalize(str) {
  return stripDiacritics(str.trim().toLowerCase());
}

// Check if user answer matches any accepted translation
function checkAnswer(userAnswer, correctAnswer) {
  const userNorm = normalize(userAnswer);
  const userNoArticle = stripArticles(userNorm);

  // Split on / for multiple accepted translations
  const accepted = correctAnswer.split('/').map(a => a.trim());

  for (const ans of accepted) {
    const ansNorm = normalize(ans);
    const ansNoArticle = stripArticles(ansNorm);

    if (userNorm === ansNorm || userNoArticle === ansNoArticle) {
      return true;
    }
    // Also check user without article vs answer with article and vice versa
    if (userNorm === ansNoArticle || userNoArticle === ansNorm) {
      return true;
    }
  }
  return false;
}

// GET /api/words — return full vocabulary
app.get('/api/words', (req, res) => {
  res.json(vocabulary);
});

// GET /api/quiz — return a random quiz card
app.get('/api/quiz', (req, res) => {
  const word = vocabulary[Math.floor(Math.random() * vocabulary.length)];
  // 70% Italian→English, 30% English→Italian
  const direction = Math.random() < 0.7 ? 'it-en' : 'en-it';

  const prompt = direction === 'it-en' ? word.italian : word.english;
  const answer = direction === 'it-en' ? word.english : word.italian;

  res.json({
    prompt,
    answer,
    direction,
    category: word.category,
    difficulty: word.difficulty
  });
});

// POST /api/check — check user's answer with fuzzy matching
app.post('/api/check', (req, res) => {
  const { userAnswer, correctAnswer } = req.body;

  if (!userAnswer || !correctAnswer) {
    return res.status(400).json({ error: 'userAnswer and correctAnswer are required' });
  }

  const correct = checkAnswer(userAnswer, correctAnswer);
  res.json({ correct });
});

app.listen(PORT, () => {
  console.log(`Italian Flashcards running on http://localhost:${PORT}`);
});
