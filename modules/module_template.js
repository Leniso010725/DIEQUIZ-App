window.quizData = {
  moduleName: "MODULNAME HIER",

  categories: {
    "Offene Fragen": [
      {
        id: "OF1",
        type: "open",
        question: "Frage hier",
        short: "Kurzantwort",
        full: "Lange Musterlösung"
      }
    ],

    "Multiple Choice": [
      {
        id: "MC1",
        type: "mc",
        question: "Frage hier",
        answers: ["A", "B", "C", "D"],
        correct: 2
      }
    ],

    "Multi Select": [
      {
        id: "MS1",
        type: "multi",
        question: "Frage hier",
        answers: ["A", "B", "C"],
        correctIndices: [0, 2]
      }
    ]
  }
};
