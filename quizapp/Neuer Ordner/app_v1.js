let currentCategory = null;
let currentIndex = 0;
let filterMode = "all"; // all | open | wrong

let userAnswers = JSON.parse(localStorage.getItem("userAnswers")) || {};

function saveState() {
  localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
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
        if (q.type === "mc" && userAnswers[q.id] === q.correct) {
          correct++;
        }
      }
    });
  }

  return { total, answered, correct };
}

/* =======================
   FILTER
======================= */
function getFilteredQuestions(category) {
  const all = questions[category];

  if (filterMode === "open") {
    return all.filter(q => userAnswers[q.id] === undefined);
  }

  if (filterMode === "wrong") {
    return all.filter(q => {
      if (userAnswers[q.id] === undefined) return false;
      if (q.type === "mc") return userAnswers[q.id] !== q.correct;
      return false;
    });
  }

  return all;
}

/* =======================
   MENÃœ
======================= */
function showMenu() {
  const app = document.getElementById("app");
  const stats = getStats();

  app.innerHTML = `
    <h1>ðŸ“˜ Quiz App</h1>

    <p>
      Gesamt beantwortet: ${stats.answered} / ${stats.total}<br>
      Richtige MC: ${stats.correct}
    </p>

    <h3>Kategorien</h3>
    ${Object.keys(questions).map(cat => `
      <button onclick="startCategory('${cat}')">
        ${cat} (${questions[cat].length})
      </button>
    `).join("")}
  `;
}

/* =======================
   KATEGORIE START
======================= */
function startCategory(category) {
  currentCategory = category;
  currentIndex = 0;
  filterMode = "all";
  showQuestion();
}

/* =======================
   FRAGEN
======================= */
function showQuestion() {
  const app = document.getElementById("app");
  const list = getFilteredQuestions(currentCategory);

  if (!list.length) {
    app.innerHTML = `
      <p>Keine Fragen im aktuellen Filter.</p>
      <button onclick="showMenu()">â¬… MenÃ¼</button>
    `;
    return;
  }

  const q = list[currentIndex];
  const progress = ${currentIndex + 1} / ${list.length};

  let html = `
    <h3>${currentCategory}</h3>
    <p>Fortschritt: ${progress}</p>
    <p><strong>${q.question}</strong></p>
  `;

  // OFFENE FRAGEN
  if (q.type === "open") {
    html += `
      <button onclick="toggleAnswer()">Kurz / Lang</button>
      <div id="answer" style="display:none">
        <p><em>${q.short}</em></p>
        <p>${q.full}</p>
      </div>
    `;
  }

  // MULTIPLE CHOICE
  if (q.type === "mc") {
    const answered = userAnswers[q.id] !== undefined;

    html += q.answers.map((a, i) => {
      let color = "";

      if (answered) {
        color = i === q.correct ? "green" : "red";
      }

      return `
        <div style="color:${color}">
          <input type="radio"
            name="mc"
            ${answered ? "disabled" : ""}
            onclick="answerMC(${i})"
            ${userAnswers[q.id] === i ? "checked" : ""}
          >
          ${a}
        </div>
      `;
    }).join("");
  }

  html += `
    <br>
    <button onclick="prevQuestion()">â¬…</button>
    <button onclick="nextQuestion()">âž¡</button>
    <br><br>

    Filter:
    <button onclick="setFilter('all')">Alle</button>
    <button onclick="setFilter('open')">Offen</button>
    <button onclick="setFilter('wrong')">Falsch</button>
    <br><br>

    <button onclick="showMenu()">ðŸ  MenÃ¼</button>
  `;

  app.innerHTML = html;
}

/* =======================
   INTERAKTION
======================= */
function toggleAnswer() {
  const el = document.getElementById("answer");
  el.style.display = el.style.display === "none" ? "block" : "none";
}

function answerMC(index) {
  const list = getFilteredQuestions(currentCategory);
  const q = list[currentIndex];

  if (userAnswers[q.id] !== undefined) return;

  userAnswers[q.id] = index;
  saveState();
  showQuestion();
}

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
   START
======================= */
showMenu();