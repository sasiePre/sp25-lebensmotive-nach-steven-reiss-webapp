let statements = [];
let index = 0;
let scores = {};
let traits = {};
let answerHistory = [];
let preferredVoice = null;
let voiceEnabled = true;
const askedStatements = new Set();

Object.keys(traits).forEach((key) => (scores[key] = 0));

$.when(
  $.getJSON("js/reiss_motive_statements.json"),
  $.getJSON("js/grundbeduerfnis_auspraegung.json")
).done(function (statementsData, traitsData) {
  traits = traitsData[0];

  if (statements.length === 0) {
    Object.values(statementsData[0]).forEach((group) => {
      statements.push(...group);
    });
  }

  Object.keys(traits).forEach((key) => (scores[key] = 0));

  bindUI();
  $("#quiz-card").hide(); // hide quiz initially
});

function bindUI() {
  $("#yes").click(() => {
    const current = statements[index];
    answerHistory.push({ index, applied: true });
    scores[current.grundbedurfnis] += current.punkte;
    index++;
    showNext();
  });

  $("#no").click(() => {
    answerHistory.push({ index, applied: false });
    index++;
    showNext();
  });

  $("#back").click(() => {
    const last = answerHistory.pop();
    if (!last) return;
    index = last.index;

    if (last.applied) {
      const prevStatement = statements[index];
      scores[prevStatement.grundbedurfnis] -= prevStatement.punkte;
    }

    // ✅ Remove from askedStatements so it shows again
    const currentStatement = statements[index];
    askedStatements.delete(currentStatement.aussage);

    showNext();
  });

  $("#voice-toggle").click(() => {
    voiceEnabled = !voiceEnabled;

    if (!voiceEnabled) speechSynthesis.cancel();
    $("#voice-toggle").text(`🔈 Voice: ${voiceEnabled ? "An" : "Aus"}`);
  });

  $("#start-button").click(() => {
    index = 0;
    answerHistory = [];
    scores = {};
    Object.keys(traits).forEach((key) => (scores[key] = 0));

    $("#start-screen").hide();
    $("#quiz-card").show();

    showNext(); // ✅ starts fresh
  });
}

function setPreferredVoice() {
  const voices = speechSynthesis.getVoices();
  preferredVoice = voices.find(
    (v) => v.name === "Google Deutsch" && v.lang === "de-DE"
  );
}

if (speechSynthesis.getVoices().length) {
  setPreferredVoice();
} else {
  speechSynthesis.onvoiceschanged = setPreferredVoice;
}

function showNext() {
  if (index >= statements.length) {
    $("#quiz-card").hide();
    showResults();
    return;
  }

  let current = statements[index];

  // 🚫 Skip duplicates until we find a fresh one
  while (
    askedStatements.has(current.aussage) &&
    index < statements.length - 1
  ) {
    index++;
    current = statements[index];
  }

  // ✅ Now mark it as asked
  askedStatements.add(current.aussage);

  $("#statement").text(current.aussage);
  $("#back").toggle(index > 0);
  speakText(current.aussage);
}

function speakText(text) {
  if (!voiceEnabled || !text) return;

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.lang = "de-DE";
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}

function showResults() {
  $("#back").toggle(index < 0);
  $("#result-area").removeClass("hidden");
  $("#result-list").empty();

  Object.entries(scores).forEach(([key, sum]) => {
    let label = "";
    let description = "";
    let borderColor = "#a4e278"; // default green for neutral + strong

    if (sum <= -2) {
      label = "Schwache Ausprägung des Grundbedürfnisses";
      description = traits[key].schwach;
      borderColor = "#a4e278"; // gray
    } else if (sum >= 2) {
      label = "Starke Ausprägung des Grundbedürfnisses";
      description = traits[key].stark;
    } else {
      label = "";
      // label = "Durchschnittliche Ausprägung des Grundbedürfnisses";
      description = "Situationsabhängig wirksam, aber kein starker Antrieb.";
      borderColor = "#1B4332"; // green
    }
    // <span class="font-bold">Summe: ${sum}</span> → ${label}
    const $result = $(`
      <div class="bg-[#F8F6F0] p-6 rounded-lg border-l-4 shadow-sm" style="border-left-color: ${borderColor};">
        <h3 class="text-lg font-semibold tracking-wide text-[#1B4332] mb-1 uppercase">${key.replace(
          /_/g,
          " "
        )}</h3>
        <p class="text-sm text-[#1B4332] mb-2">
       ${label}
        </p>
        ${
          description
            ? `<p class="italic text-[#4F4F4F] text-sm">${description}</p>`
            : ""
        }
      </div>
    `);

    $("#result-list").append($result);
  });
}
