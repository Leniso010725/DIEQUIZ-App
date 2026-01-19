/* =======================
   GRUNDLAGEN & STATE
======================= */
const questions = window.quizData.categories;

let currentCategory = null;
let currentIndex = 0;
let filterMode = "all"; // all | open | wrong | favorites
let learnMode = "normal"; // normal | weaknesses | spaced | wrongOnly
let answerMode = "short"; // short | long

let userAnswers = JSON.parse(localStorage.getItem("userAnswers")) || {};
let stats = JSON.parse(localStorage.getItem("stats")) || {
  wrongCount: {},
  lastWrong: {}
};
let favorites = JSON.parse(localStorage.getItem("favorites")) || {};
let dailyStats = JSON.parse(localStorage.getItem("dailyStats")) || {};
let dailyGoal = JSON.parse(localStorage.getItem("dailyGoal")) || 40;
let relevance = JSON.parse(localStorage.getItem("relevance")) || {};

let examMode = false;
let examQuestions = [];
let examIndex = 0;
let examCorrect = 0;
let examReview = [];

// Multi-Select Lernmodus: wurde die Frage schon ausgewertet?
let multiChecked = {}; // q.id -> true/false

/* =======================
   HILFSFUNKTIONEN
======================= */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function incDailyProgress() {
  const key = todayKey();
  dailyStats[key] = (dailyStats[key] || 0) + 1;
  saveAll();
}

function saveAll() {
  localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
  localStorage.setItem("stats", JSON.stringify(stats));
  localStorage.setItem("favorites", JSON.stringify(favorites));
  localStorage.setItem("dailyStats", JSON.stringify(dailyStats));
  localStorage.setItem("dailyGoal", JSON.stringify(dailyGoal));
  localStorage.setItem("relevance", JSON.stringify(relevance));
  localStorage.setItem("multiChecked", JSON.stringify(multiChecked));
}

function getAllQuestionsArray() {
  return Object.values(questions).flat();
}

function shuffle(arr) {
  return arr
    .map(x => ({ x, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(o => o.x);
}

/* =======================
   STATISTIK
======================= */
function getStats() {
  let total = 0;
  let answered = 0;
  let correct = 0;

  for (const cat in questions) {
    questions[cat].forEach(q => {
      total++;

      if (userAnswers[q.id] !== undefined) {
        answered++;

        if (q.type === "mc") {
          if (userAnswers[q.id] === q.correct) correct++;
        }

        if (q.type === "multi") {
          const chosen = userAnswers[q.id] || [];
          const correctIndices = q.correctIndices || [];
          if (chosen.sort().join(",") === correctIndices.sort().join(",")) {
            correct++;
          }
        }
      }
    });
  }

  return { total, answered, correct };
}

/* =======================
   FILTER & FRAGENLISTEN
======================= */
function getBaseQuestions(category) {
  return questions[category] || [];
}

function getWeaknessQuestions(category) {
  return getBaseQuestions(category).filter(q => (stats.wrongCount[q.id] || 0) > 0);
}

function getSpacedQuestions(category) {
  const base = getBaseQuestions(category);

  const weighted = base.flatMap(q => {
    const wrong = stats.wrongCount[q.id] || 0;
    const answered = userAnswers[q.id] !== undefined;

    const correct =
      q.type === "mc"
        ? answered && userAnswers[q.id] === q.correct
        : q.type === "multi"
        ? JSON.stringify(userAnswers[q.id] || []) === JSON.stringify(q.correctIndices)
        : false;

    if (wrong > 0) return Array(3 + wrong).fill(q);
    if (correct) return [q];
    return [q, q];
  });

  return shuffle(weighted);
}

function getFilteredQuestions(category) {
  let list =
    learnMode === "weaknesses"
      ? getWeaknessQuestions(category)
      : learnMode === "spaced"
      ? getSpacedQuestions(category)
      : getBaseQuestions(category);

  if (learnMode === "wrongOnly") {
    list = list.filter(q => {
      if (userAnswers[q.id] === undefined) return false;

      if (q.type === "mc") return userAnswers[q.id] !== q.correct;

      if (q.type === "multi") {
        const chosen = userAnswers[q.id] || [];
        return chosen.sort().join(",") !== q.correctIndices.sort().join(",");
      }

      return false;
    });
  }

  if (filterMode === "open") {
    list = list.filter(q => userAnswers[q.id] === undefined);
  } else if (filterMode === "wrong") {
    list = list.filter(q => {
      if (userAnswers[q.id] === undefined) return false;

      if (q.type === "mc") return userAnswers[q.id] !== q.correct;

      if (q.type === "multi") {
        const chosen = userAnswers[q.id] || [];
        return chosen.sort().join(",") !== q.correctIndices.sort().join(",");
      }

      return false;
    });
  } else if (filterMode === "favorites") {
    list = list.filter(q => favorites[q.id]);
  }

  return list;
}

/* =======================
   DASHBOARD
======================= */
function showDashboard() {
  const app = document.getElementById("app");
  const stats = getStats();
  const today = todayKey();
  const todayProgress = dailyStats[today] || 0;

  let html = `
    <h1>📊 Dashboard</h1>

    <div class="stat-card">
      <h2>Gesamtübersicht</h2>
      <p>Beantwortet: ${stats.answered} / ${stats.total}</p>
      <p>Richtig: ${stats.correct}</p>

      <div class="progress">
        <div class="progress-fill" style="width:${(stats.answered / stats.total) * 100}%"></div>
      </div>

      <h3>🎯 Tagesziel</h3>
      <p>${todayProgress} / ${dailyGoal}</p>

      <div class="progress">
        <div class="progress-fill" style="width:${Math.min(100, (todayProgress / dailyGoal) * 100)}%"></div>
      </div>

      <button onclick="changeDailyGoal()">Ziel ändern</button>
      <br><br>
      <button onclick="resetAll()">🔄 Fortschritt zurücksetzen</button>
    </div>

    <h2>Kategorien</h2>
    <div class="dashboard-grid">
  `;

  for (const cat in questions) {
    const list = questions[cat];
    const answered = list.filter(q => userAnswers[q.id] !== undefined).length;

    html += `
      <div class="stat-card">
        <h3>${cat}</h3>
        <p>${answered} / ${list.length}</p>

        <div class="progress">
          <div class="progress-fill" style="width:${(answered / list.length) * 100}%"></div>
        </div>

        <button onclick="startCategory('${cat}')">Lernen</button>
        <button onclick="startWeaknessMode('${cat}')">Schwächen</button>
        <button onclick="startSpacedMode('${cat}')">Spaced</button>
        <button onclick="startWrongOnlyMode('${cat}')">Nur falsche</button>
      </div>
    `;
  }

  html += `
    </div>
    <br>
    <button onclick="showMenu()">🏠 Menü</button>
  `;

  app.innerHTML = html;
}

/* =======================
   RESET
======================= */
function resetAll() {
  if (!confirm("Alles wirklich löschen?")) return;

  userAnswers = {};
  stats = { wrongCount: {}, lastWrong: {} };
  favorites = {};
  dailyStats = {};
  relevance = {};
  multiChecked = {};
  saveAll();
  showDashboard();
}

/* =======================
   MENÜ
======================= */
function showMenu() {
  examMode = false;
  const app = document.getElementById("app");
  const stats = getStats();

  app.innerHTML = `
    <h1>📘 Quiz App</h1>
    <p>${stats.answered} / ${stats.total} beantwortet</p>

    <button onclick="showDashboard()">📊 Dashboard</button>
    <button onclick="startExam()">🎓 Prüfungsmodus</button>

    <h3>Kategorien</h3>
    ${Object.keys(questions)
      .map(cat => `<button onclick="startCategory('${cat}')">${cat}</button>`)
      .join("")}
  `;
}
/* =======================
   LERNMODI START
======================= */
function startCategory(category) {
  currentCategory = category;
  currentIndex = 0;
  learnMode = "normal";
  filterMode = "all";
  examMode = false;
  showQuestion();
}

function startWeaknessMode(category) {
  currentCategory = category;
  currentIndex = 0;
  learnMode = "weaknesses";
  filterMode = "all";
  examMode = false;
  showQuestion();
}

function startSpacedMode(category) {
  currentCategory = category;
  currentIndex = 0;
  learnMode = "spaced";
  filterMode = "all";
  examMode = false;
  showQuestion();
}

function startWrongOnlyMode(category) {
  currentCategory = category;
  currentIndex = 0;
  learnMode = "wrongOnly";
  filterMode = "all";
  examMode = false;
  showQuestion();
}

/* =======================
   FRAGEN ANZEIGEN
======================= */
function showQuestion() {
  if (examMode) return showExamQuestion();

  const app = document.getElementById("app");
  const list = getFilteredQuestions(currentCategory);

  if (!list.length) {
    app.innerHTML = `
      <p>Keine Fragen im aktuellen Modus.</p>
      <button onclick="showMenu()">Zurück</button>
    `;
    return;
  }

  const q = list[currentIndex];
  const progress = `${currentIndex + 1} / ${list.length}`;
  const chosen = userAnswers[q.id] || [];
  const isChecked = multiChecked[q.id] === true;

  let html = `
    <h2>${currentCategory}</h2>
    <p>${progress}</p>

    <div class="progress">
      <div class="progress-fill" style="width:${((currentIndex + 1) / list.length) * 100}%"></div>
    </div>

    <div class="question-box">
      <p><strong>${q.question}</strong></p>

      <button onclick="toggleFavorite('${q.id}')">
        ${favorites[q.id] ? "⭐ Markiert" : "☆ Merken"}
      </button>

      <span>Relevanz:
        <button onclick="setRelevance('${q.id}','🔥')">🔥</button>
        <button onclick="setRelevance('${q.id}','⭐')">⭐</button>
        <button onclick="setRelevance('${q.id}','🟢')">🟢</button>
        ${relevance[q.id] || ""}
      </span>
  `;

  /* =======================
     OFFENE FRAGEN
  ======================== */
  if (q.type === "open") {
    const isShort = answerMode === "short";

    html += `
      <div style="margin-top:10px;">
        <button onclick="setAnswerMode('short')" ${isShort ? "disabled" : ""}>Kurz</button>
        <button onclick="setAnswerMode('long')" ${!isShort ? "disabled" : ""}>Lang</button>
      </div>

      <div class="answer-box">
        ${isShort ? `<p><em>${q.short}</em></p>` : `<p>${q.full}</p>`}
      </div>
    `;
  }

  /* =======================
     MULTI-SELECT & SINGLE-CHOICE
======================= */
  if (Array.isArray(q.answers)) {
    if (q.type === "multi") {
      html += `<p style="color:#6b8f71; font-size:0.9em;"><em>Mehrere Antworten möglich – klicke auf „Auswerten“, wenn du fertig bist.</em></p>`;
    }

    html += q.answers
      .map((a, i) => {
        let cls = "mc-option";

        if (q.type === "multi") {
          const isCorrectIndex = q.correctIndices.includes(i);
          const isChosen = chosen.includes(i);

          if (!isChecked) {
            // Auswahlphase: neutral markieren
            if (isChosen) cls += " selected";
          } else {
            // Auswertungsphase
            if (isCorrectIndex && isChosen) cls += " correct";
            else if (!isCorrectIndex && isChosen) cls += " wrong";
            else if (isCorrectIndex && !isChosen) cls += " correct";
          }
        }

        if (q.type === "mc" && userAnswers[q.id] !== undefined) {
          if (i === q.correct) cls += " correct";
          else if (i === userAnswers[q.id]) cls += " wrong";
        }

        return `
          <div class="${cls}" onclick="answerMC(${i})">
            ${a}
          </div>
        `;
      })
      .join("");

    // Auswerten-Button (C2: dezent rechts unten)
    if (q.type === "multi" && !isChecked) {
      html += `
        <div style="text-align:right; margin-top:10px;">
          <button onclick="checkMulti('${q.id}')">Auswerten</button>
        </div>
      `;
    }
  }

  html += `
    </div>

    <button onclick="prevQuestion()">⬅</button>
    <button onclick="nextQuestion()">➡</button>

    <div class="filter-buttons">
      <button onclick="setFilter('all')">Alle</button>
      <button onclick="setFilter('open')">Offen</button>
      <button onclick="setFilter('wrong')">Falsch</button>
      <button onclick="setFilter('favorites')">Markiert</button>
    </div>

    <button onclick="showMenu()">🏠 Menü</button>
  `;

  app.innerHTML = html;
}

/* =======================
   INTERAKTION (MC + MULTI)
======================= */
function setAnswerMode(mode) {
  answerMode = mode;
  showQuestion();
}

function toggleFavorite(id) {
  favorites[id] = !favorites[id];
  saveAll();
  showQuestion();
}

function setRelevance(id, level) {
  relevance[id] = level;
  saveAll();
  showQuestion();
}

function answerMC(index) {
  const list = getFilteredQuestions(currentCategory);
  const q = list[currentIndex];

  /* ---- MULTI-SELECT ---- */
  if (q.type === "multi") {
    // B2: Sobald man wieder klickt → Auswertung zurücksetzen
    multiChecked[q.id] = false;

    if (!Array.isArray(userAnswers[q.id])) {
      userAnswers[q.id] = [];
    }

    if (userAnswers[q.id].includes(index)) {
      userAnswers[q.id] = userAnswers[q.id].filter(i => i !== index);
    } else {
      userAnswers[q.id].push(index);
    }

    saveAll();
    showQuestion();
    return;
  }

  /* ---- SINGLE-CHOICE ---- */
  if (userAnswers[q.id] !== undefined) return;

  userAnswers[q.id] = index;

  if (index !== q.correct) {
    stats.wrongCount[q.id] = (stats.wrongCount[q.id] || 0) + 1;
    stats.lastWrong[q.id] = todayKey();
  }

  incDailyProgress();
  saveAll();
  showQuestion();
}

/* =======================
   MULTI-SELECT AUSWERTEN
======================= */
function checkMulti(id) {
  multiChecked[id] = true;
  saveAll();
  showQuestion();
}

/* =======================
   NAVIGATION
======================= */
function nextQuestion() {
  const list = getFilteredQuestions(currentCategory);
  if (currentIndex < list.length - 1) {
    currentIndex++;
    showQuestion();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    showQuestion();
  }
}

function setFilter(mode) {
  filterMode = mode;
  currentIndex = 0;
  showQuestion();
}
/* =======================
   PRÜFUNGSMODUS
======================= */
function startExam() {
  examMode = true;
  examCorrect = 0;
  examIndex = 0;
  examReview = [];

  // Alle Fragen mit Antwortmöglichkeiten
  const all = getAllQuestionsArray().filter(
    q => Array.isArray(q.answers) && q.answers.length > 0
  );

  examQuestions = shuffle(all).slice(0, 20); // z.B. 20 Fragen
  showExamQuestion();
}

function showExamQuestion() {
  const app = document.getElementById("app");
  const q = examQuestions[examIndex];
  const chosen = userAnswers[q.id] || [];

  let html = `
    <h2>Prüfungsmodus</h2>
    <p>${examIndex + 1} / ${examQuestions.length}</p>

    <div class="progress">
      <div class="progress-fill" style="width:${((examIndex + 1) / examQuestions.length) * 100}%"></div>
    </div>

    <div class="question-box">
      <p><strong>${q.question}</strong></p>
  `;

  if (q.type === "multi") {
    html += `<p style="color:#6b8f71; font-size:0.9em;"><em>Mehrere Antworten möglich</em></p>`;
  }

  html += q.answers
    .map((a, i) => {
      let cls = "mc-option";

      if (q.type === "multi" && chosen.includes(i)) {
        cls += " selected";
      }

      return `
        <div class="${cls}" onclick="answerExam(${i})">
          ${a}
        </div>
      `;
    })
    .join("");

  html += `
    </div>
    <button onclick="cancelExam()">❌ Abbrechen</button>
  `;

  app.innerHTML = html;
}

/* =======================
   ANTWORTEN IM PRÜFUNGSMODUS
======================= */
function answerExam(index) {
  const q = examQuestions[examIndex];

  /* ---- MULTI-SELECT ---- */
  if (q.type === "multi") {
    if (!Array.isArray(userAnswers[q.id])) {
      userAnswers[q.id] = [];
    }

    if (userAnswers[q.id].includes(index)) {
      userAnswers[q.id] = userAnswers[q.id].filter(i => i !== index);
    } else {
      userAnswers[q.id].push(index);
    }

    saveAll();
    showExamQuestion();
    return;
  }

  /* ---- SINGLE-CHOICE ---- */
  userAnswers[q.id] = index;

  examIndex++;

  if (examIndex >= examQuestions.length) {
    return showExamResult();
  }

  showExamQuestion();
}

/* =======================
   PRÜFUNG – ERGEBNIS
======================= */
function showExamResult() {
  const app = document.getElementById("app");

  examCorrect = 0;
  examReview = [];

  examQuestions.forEach(q => {
    const chosen = userAnswers[q.id];

    if (q.type === "mc") {
      const isCorrect = chosen === q.correct;
      if (isCorrect) examCorrect++;

      examReview.push({
        type: "mc",
        question: q.question,
        answers: q.answers,
        chosen,
        correct: q.correct,
        relevance: relevance[q.id] || null
      });
    }

    if (q.type === "multi") {
      const chosenArr = chosen || [];
      const correctArr = q.correctIndices || [];

      const isCorrect =
        chosenArr.sort().join(",") === correctArr.sort().join(",");

      if (isCorrect) examCorrect++;

      examReview.push({
        type: "multi",
        question: q.question,
        answers: q.answers,
        chosen: chosenArr,
        correctIndices: correctArr,
        relevance: relevance[q.id] || null
      });
    }
  });

  const total = examQuestions.length;
  const percent = Math.round((examCorrect / total) * 100);
  const passed = percent >= 60;

  let html = `
    <h2>Ergebnis</h2>
    <p>${examCorrect} / ${total} richtig</p>
    <p>${percent}%</p>
    <p><strong>${passed ? "Bestanden 🎉" : "Nicht bestanden ❌"}</strong></p>

    <h3>Auswertung</h3>
  `;

  examReview.forEach((item, i) => {
    html += `
      <div class="stat-card">
        <p><strong>Frage ${i + 1}:</strong> ${item.question}</p>
        ${item.relevance ? `<p>Relevanz: ${item.relevance}</p>` : ""}
    `;

    if (item.type === "mc") {
      const isCorrect = item.chosen === item.correct;

      html += `
        <p><strong>Deine Antwort:</strong>
          <span style="color:${isCorrect ? "#6b8f71" : "#c97a7a"};">
            ${item.answers[item.chosen] || "—"}
          </span>
        </p>

        <p><strong>Richtig:</strong>
          <span style="color:#6b8f71;">
            ${item.answers[item.correct]}
          </span>
        </p>
      `;
    }

    if (item.type === "multi") {
      const chosen = item.chosen || [];
      const correct = item.correctIndices || [];

      const isCorrect =
        chosen.sort().join(",") === correct.sort().join(",");

      html += `
        <p><strong>Deine Auswahl:</strong>
          <span style="color:${isCorrect ? "#6b8f71" : "#c97a7a"};">
            ${chosen.map(i => item.answers[i]).join(", ") || "—"}
          </span>
        </p>

        <p><strong>Richtige Antworten:</strong>
          <span style="color:#6b8f71;">
            ${correct.map(i => item.answers[i]).join(", ")}
          </span>
        </p>
      `;
    }

    html += `</div>`;
  });

  html += `
    <button onclick="startExam()">🔁 Wiederholen</button>
    <button onclick="showMenu()">🏠 Menü</button>
  `;

  app.innerHTML = html;
}

/* =======================
   PRÜFUNG ABBRECHEN
======================= */
function cancelExam() {
  if (confirm("Prüfung abbrechen?")) {
    examMode = false;
    showMenu();
  }
}

/* =======================
   START
======================= */
showMenu();
