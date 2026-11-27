 
/* =========================================================
   1. CONFIGURATION
   ========================================================= */

// Stockage
const STORAGE_KEY = "mes-revisions-v1";

// Chapitres et nombre d'exercices
const CHAPTERS = [
  { id: "second-degre", title: "Le second degré", count: 35 },
  { id: "derivation", title: "La dérivation", count: 28 },
  { id: "suite_numerique", title: "Les suites numériques", count: 28 }
];

// Paramètres du planning
const PLANNING_WEEKS = 3;

// Délais de report en jours
const POSTPONE_DELAYS = {
  businessDays: 2,
  oneWeek: 7,
  twoWeeks: 14
};

// Durée d'affichage d'une notification en millisecondes.
const NOTIFICATION_DURATION = 2600;


/* =========================================================
   2. VARIABLES GLOBALES
   ========================================================= */

// Données de l'application
let state = null;

// Exercice actuellement sélectionné dans la fenêtre de gestion.
let activeExercise = null;

// Identifiant du minuteur de la notification en cours.
let notificationTimeout = null;


/* =========================================================
   3. SÉLECTEURS
   ========================================================= */

// Sélectionne un élément HTML à partir de son sélecteur CSS (id, classe, etc.).
const selectElement = (selector) => document.querySelector(selector);


/* =========================================================
   3. FONCTIONS UTILITAIRES
   ========================================================= */

/* ---------------------------------------------------------
   3.1 GESTION DES DATES
   --------------------------------------------------------- */

// Récupère la date du jour en remettant l'heure à zéro.
const getToday = () => {
	const currentDate = new Date();
	currentDate.setHours(0, 0, 0, 0);

	return currentDate;
};

// Convertit une date JavaScript au format AAAA-MM-JJ.
// L'heure est fixée à midi pour éviter les problèmes de changement de jour.
const formatDateToISO = (date) => {
	const formattedDate = new Date(date);
	formattedDate.setHours(12, 0, 0, 0);

	const year = formattedDate.getFullYear();
	const month = String(formattedDate.getMonth() + 1).padStart(2, "0");
	const day = String(formattedDate.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
};

// Convertit une date au format AAAA-MM-JJ en objet Date.
// Vérifie également que la date existe réellement.
const parseISODate = (dateString) => {
	let parsedDate = new Date(NaN);

	if (dateString && typeof dateString === "string") {
		const [year, month, day] = dateString.split("-").map(Number);

		if (year && month && day) {
			const candidateDate = new Date(year, month - 1, day, 12);

			const isValidDate =
				candidateDate.getFullYear() === year &&
				candidateDate.getMonth() === month - 1 &&
				candidateDate.getDate() === day;

			if (isValidDate) {
				parsedDate = candidateDate;
			}
		}
  }

  return parsedDate;
};

// Ajoute un nombre de jours calendaires à une date.
const addDays = (date, numberOfDays) => {
	const updatedDate = new Date(date);
	updatedDate.setDate(updatedDate.getDate() + numberOfDays);

	return updatedDate;
};

// Ajoute un nombre de jours ouvrés à une date.
// Les samedis et dimanches ne sont pas comptabilisés.
const addBusinessDays = (date, numberOfDays) => {
	const updatedDate = new Date(date);
	let addedDays = 0;

	while (addedDays < numberOfDays) {
		updatedDate.setDate(updatedDate.getDate() + 1);

		const dayOfWeek = updatedDate.getDay();
		const isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6;

		if (isBusinessDay) {
			addedDays++;
		}
	}

	return updatedDate;
};

// Récupère le lundi de la semaine correspondant à une date.
const getMondayOfWeek = (date) => {
	const mondayDate = new Date(date);
	const dayOfWeek = mondayDate.getDay();
	const daysSinceMonday = (dayOfWeek + 6) % 7;

	mondayDate.setDate(mondayDate.getDate() - daysSinceMonday);
	mondayDate.setHours(12, 0, 0, 0);

	return mondayDate;
};

// Calcule le numéro de semaine selon la norme ISO 8601.
const getWeekNumber = (date) => {
	const adjustedDate = new Date(date);
	adjustedDate.setHours(0, 0, 0, 0);

	adjustedDate.setDate(
		adjustedDate.getDate() + 3 - ((adjustedDate.getDay() + 6) % 7),
	);

	const firstThursday = new Date(adjustedDate.getFullYear(), 0, 4);

	firstThursday.setDate(
		firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
	);

	const millisecondsPerWeek = 604800000;
	const weekNumber = 1 + Math.round((adjustedDate - firstThursday) / millisecondsPerWeek);

	return weekNumber;
};

// Affiche le nom complet du jour (exemple : lundi).
const formatDayLabel = (date) => {
  const dayLabel = date.toLocaleDateString("fr-FR", {
    weekday: "long",
  });

  return dayLabel;
};

// Affiche une date complète (exemple : 23 novembre 2026).
const formatDateLabel = (date) => {
  const dateLabel = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return dateLabel;
};

// Crée les données initiales de l'application.
function createInitialState() {
  const currentMonday = getMondayOfWeek(getToday());

  const initialWeeks = Array.from(
    { length: PLANNING_WEEKS },
    (_, weekIndex) =>
      formatDateToISO(addDays(currentMonday, weekIndex * 7))
  );

  return {
    weeks: initialWeeks,
    selectedWeek: initialWeeks[0],
    exercises: {}
  };
}

// Charge les données enregistrées ou crée un état initial.
function initializeState() {
  let savedState = null;

  try {
    savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    savedState = null;
  }

  const isValidState =
    savedState &&
    Array.isArray(savedState.weeks) &&
    savedState.exercises;

  state = isValidState ? savedState : createInitialState();

  // Éliminer les semaines en double et les trier.
  state.weeks = [...new Set(state.weeks)].sort();
}

initializeState();


// Garantit la présence des semaines nécessaires au planning.
function ensurePlanningWeeks() {
  const currentMonday = getMondayOfWeek(getToday());

  const requiredWeeks = Array.from(
    { length: PLANNING_WEEKS },
    (_, weekIndex) =>
      formatDateToISO(addDays(currentMonday, weekIndex * 7))
  );

  // Conserver uniquement les semaines avec une date valide.
  const validWeeks = state.weeks.filter((weekStart) => {
    return (
      typeof weekStart === "string" &&
      !Number.isNaN(parseISODate(weekStart).getTime())
    );
  });

  // Conserver l'historique et ajouter les semaines nécessaires.
  state.weeks = [...new Set([...validWeeks, ...requiredWeeks])].sort();

  // Sélectionner la semaine actuelle si la sélection est invalide.
  if (!state.weeks.includes(state.selectedWeek)) {
    state.selectedWeek = requiredWeeks[0];
  }
}

// Ajoute une semaine à la liste si elle n'existe pas encore.
function ensureWeekExists(date) {
  const weekStart = formatDateToISO(getMondayOfWeek(date));

  if (!state.weeks.includes(weekStart)) {
    state.weeks.push(weekStart);
    state.weeks.sort();
  }

  return weekStart;
}

// Sélectionne une semaine et actualise l'affichage.
function selectWeek(weekStart) {
  if (!state.weeks.includes(weekStart)) return;

  state.selectedWeek = weekStart;

  render();
}

// Crée et sélectionne une nouvelle semaine après la dernière.
function addNextWeek() {
  const latestWeek = state.weeks[state.weeks.length - 1];
  const nextWeekDate = addDays(parseISODate(latestWeek), 7);
  const nextWeek = ensureWeekExists(nextWeekDate);

  state.selectedWeek = nextWeek;

  render();

  showNotification("Une nouvelle semaine a été ajoutée.");
}




// Enregistre les données de l'application dans le stockage local.
function saveState() {
  ensurePlanningWeeks();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


// Construit l'identifiant unique d'un exercice.
function createExerciseKey(chapterId, exerciseNumber) {
  return `${chapterId}:${exerciseNumber}`;
}

// Récupère un exercice et garantit la présence de son historique.
function getExercise(chapterId, exerciseNumber) {
  const exercise =
    state.exercises[createExerciseKey(chapterId, exerciseNumber)] || {
      status: "todo",
      date: null
    };

  if (!Array.isArray(exercise.history)) {
    exercise.history = [];
  }

  return exercise;
}

// Crée un événement retraçant une modification de l'exercice.
function createExerciseHistoryEvent(updatedValues) {
  return {
    type: updatedValues.status,
    date: formatDateToISO(getToday()),
    dueDate:
      updatedValues.status === "postponed"
        ? updatedValues.date
        : null,
    comment:
      updatedValues.status === "postponed"
        ? updatedValues.comment || ""
        : ""
  };
}

// Met à jour un exercice en conservant son historique.
function setExercise(chapterId, exerciseNumber, updatedValues) {
  const exerciseKey = createExerciseKey(chapterId, exerciseNumber);
  const previousExercise = getExercise(chapterId, exerciseNumber);
  const historyEvent = createExerciseHistoryEvent(updatedValues);

  state.exercises[exerciseKey] = {
    ...previousExercise,
    ...updatedValues,
    history: [...previousExercise.history, historyEvent]
  };

  saveState();
}

/* ---------------------------------------------------------
   3.3 NOTIFICATIONS
   --------------------------------------------------------- */

// Affiche une notification temporaire à l'écran.
const showNotification = (message) => {
  const notificationElement = selectElement("#toast");

  notificationElement.textContent = message;
  notificationElement.classList.add("show");

  clearTimeout(notificationTimeout);

  notificationTimeout = setTimeout(() => {
    notificationElement.classList.remove("show");
  }, NOTIFICATION_DURATION);
};


// Affiche les onglets permettant de sélectionner une semaine.
function renderTabs() {
  const tabsContainer = selectElement("#week-tabs");
  tabsContainer.innerHTML = "";

  state.weeks.forEach((weekStart) => {
    const weekDate = parseISODate(weekStart);

    const tabButton = document.createElement("button");
    tabButton.className =
      "week-tab" +
      (weekStart === state.selectedWeek ? " active" : "");

    const title = document.createElement("strong");
    title.textContent = `Semaine ${getWeekNumber(weekDate)}`;

    const subtitle = document.createElement("small");
    subtitle.textContent = `du ${weekDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    })}`;

    tabButton.append(title, subtitle);

    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute(
      "aria-selected",
      String(weekStart === state.selectedWeek)
    );

    tabButton.addEventListener("click", () => {
      selectWeek(weekStart);
    });

    tabsContainer.append(tabButton);
  });

  const currentMonday = getMondayOfWeek(getToday());
  const selectedWeekDate = parseISODate(state.selectedWeek);

  selectElement("#week-summary").textContent =
    state.selectedWeek === formatDateToISO(currentMonday)
      ? "La semaine en cours"
      : selectedWeekDate < currentMonday
        ? "Une semaine passée — ton historique est conservé"
        : "Une semaine à venir";
}











// Affiche les chapitres et les cases de leurs exercices.
function renderChapters() {
  const chaptersContainer = selectElement("#chapters-list");
  chaptersContainer.innerHTML = "";

  CHAPTERS.forEach((chapter) => {
    const chapterCard = document.createElement("article");
    chapterCard.className = "chapter-card";

    const chapterHeader = document.createElement("div");
    chapterHeader.className = "chapter-head";

    const chapterInformation = document.createElement("div");

    const chapterTitle = document.createElement("h3");
    chapterTitle.textContent = chapter.title;

    const chapterDescription = document.createElement("p");
    chapterDescription.textContent =
      `${chapter.count} exercices pour progresser`;

    chapterInformation.append(chapterTitle, chapterDescription);

    const chapterProgress = document.createElement("span");
    chapterProgress.className = "chapter-count";

    chapterHeader.append(chapterInformation, chapterProgress);
    chapterCard.append(chapterHeader);

    const exercisesGrid = document.createElement("div");
    exercisesGrid.className = "exercise-grid";

    let completedExercises = 0;

    for (
      let exerciseNumber = 1;
      exerciseNumber <= chapter.count;
      exerciseNumber++
    ) {
      const exercise = getExercise(chapter.id, exerciseNumber);

      const exerciseCell = document.createElement("button");
      exerciseCell.className = "exercise-cell";
      exerciseCell.type = "button";

      if (exercise.status === "done") {
        completedExercises++;
        exerciseCell.classList.add("done");
        exerciseCell.title = "Exercice validé";
      } else if (exercise.status === "postponed") {
        exerciseCell.classList.add("postponed");
      } else {
        exerciseCell.title = "Cliquer pour gérer cet exercice";
      }

      const exerciseNumberLabel = document.createElement("span");
      exerciseNumberLabel.className = "cell-number";
      exerciseNumberLabel.textContent = exerciseNumber;

      exerciseCell.append(exerciseNumberLabel);

      if (exercise.status === "postponed") {
        const dueDate = parseISODate(exercise.date);
        const isValidDueDate = !Number.isNaN(dueDate.getTime());

        if (!isValidDueDate) {
          exercise.status = "todo";
          exercise.date = null;
          exerciseCell.classList.remove("postponed");
          exerciseCell.title = "Cliquer pour gérer cet exercice";
        } else {
          const dueWeek = formatDateToISO(getMondayOfWeek(dueDate));
          const selectedWeek = state.selectedWeek;

          if (dueWeek === selectedWeek) {
            exerciseCell.classList.add("same-week");
          }

          // Afficher le commentaire à partir de la semaine prévue.
          if (selectedWeek >= dueWeek && exercise.comment) {
            const exerciseComment = document.createElement("small");
            exerciseComment.className = "exercise-comment";
            exerciseComment.textContent = exercise.comment;

            exerciseCell.append(exerciseComment);
          }

          if (selectedWeek === dueWeek) {
            const dueDayLabel = document.createElement("small");
            dueDayLabel.textContent = formatDayLabel(dueDate);

            exerciseCell.append(dueDayLabel);
          } else if (selectedWeek < dueWeek) {
            exerciseCell.classList.add("postponed-diagonal");
          }

          exerciseCell.title =
            `Reporté au ${formatDateLabel(dueDate)}`;
        }
      }

      exerciseCell.addEventListener("click", () => {
        openExercise(chapter, exerciseNumber);
      });

      exercisesGrid.append(exerciseCell);
    }

    chapterProgress.textContent =
      `${completedExercises} / ${chapter.count} validés`;

    chapterCard.append(exercisesGrid);
    chaptersContainer.append(chapterCard);
  });
}

// Calcule et affiche la progression globale des exercices.
function renderProgress() {
  let totalExercises = 0;
  let completedExercises = 0;

  CHAPTERS.forEach((chapter) => {
    totalExercises += chapter.count;

    for (
      let exerciseNumber = 1;
      exerciseNumber <= chapter.count;
      exerciseNumber++
    ) {
      const exercise = getExercise(chapter.id, exerciseNumber);

      if (exercise.status === "done") {
        completedExercises++;
      }
    }
  });

  const progressPercentage =
    (completedExercises / totalExercises) * 100;

  selectElement("#progress-count").textContent =
    `${completedExercises} / ${totalExercises}`;

  selectElement("#progress-bar").style.width =
    `${progressPercentage}%`;
}

// Affiche l'historique des modifications de chaque exercice.
function renderTracking() {
  const trackingContainer = selectElement("#tracking-content");
  trackingContainer.innerHTML = "";

  CHAPTERS.forEach((chapter) => {
    const exercisesWithHistory = [];

    for (
      let exerciseNumber = 1;
      exerciseNumber <= chapter.count;
      exerciseNumber++
    ) {
      const exercise = getExercise(chapter.id, exerciseNumber);

      if (exercise.history.length > 0) {
        exercisesWithHistory.push({
          number: exerciseNumber,
          history: exercise.history
        });
      }
    }

    if (exercisesWithHistory.length === 0) return;

    const chapterAccordion = document.createElement("details");
    chapterAccordion.className = "tracking-chapter";
    chapterAccordion.open = false;

    const chapterTitle = document.createElement("summary");
    chapterTitle.className = "tracking-chapter-title";
    chapterTitle.textContent = chapter.title;

    chapterAccordion.append(chapterTitle);

    const chapterContent = document.createElement("div");
    chapterContent.className = "tracking-chapter-content";

    exercisesWithHistory.forEach((exercise) => {
      const exerciseAccordion = document.createElement("details");
      exerciseAccordion.className = "tracking-exercise";
      exerciseAccordion.open = false;

      const exerciseTitle = document.createElement("summary");
      exerciseTitle.className = "tracking-exercise-title";
      exerciseTitle.textContent = `Exercice ${exercise.number}`;

      exerciseAccordion.append(exerciseTitle);

      const historyContainer = document.createElement("div");
      historyContainer.className = "tracking-history";

      const historyEvents = [...exercise.history].reverse();

      historyEvents.forEach((historyEvent) => {
        const eventContainer = document.createElement("div");
        eventContainer.className =
          `tracking-event ${historyEvent.type}`;

        const eventDate = document.createElement("p");
        const parsedEventDate = parseISODate(historyEvent.date);

        eventDate.textContent =
          !Number.isNaN(parsedEventDate.getTime())
            ? formatDateLabel(parsedEventDate)
            : "Date inconnue";

        const eventDescription = document.createElement("p");

        if (historyEvent.type === "postponed") {
          const parsedDueDate = parseISODate(historyEvent.dueDate);

          eventDescription.textContent =
            !Number.isNaN(parsedDueDate.getTime())
              ? `Exercice reporté au ${formatDateLabel(parsedDueDate)}`
              : "Exercice reporté";
        } else if (historyEvent.type === "done") {
          eventDescription.textContent = "Exercice validé ✓";
        } else {
          eventDescription.textContent = "Exercice remis à faire";
        }

        eventContainer.append(eventDate, eventDescription);

        if (historyEvent.comment) {
          const eventComment = document.createElement("p");
          eventComment.className = "tracking-comment";
          eventComment.textContent = historyEvent.comment;

          eventContainer.append(eventComment);
        }

        historyContainer.append(eventContainer);
      });

      exerciseAccordion.append(historyContainer);
      chapterContent.append(exerciseAccordion);
    });

    chapterAccordion.append(chapterContent);
    trackingContainer.append(chapterAccordion);
  });

  if (trackingContainer.children.length === 0) {
    trackingContainer.textContent =
      "Aucun historique pour le moment. Tes prochains reports et validations apparaîtront ici.";
  }
}

// Affiche les exercices reportés dans le planning des semaines à venir.
function renderPlanning() {
  const planningContainer = selectElement("#daily-planning");
  planningContainer.innerHTML = "";

  const currentMonday = getMondayOfWeek(getToday());

  for (
    let weekIndex = 0;
    weekIndex < PLANNING_WEEKS;
    weekIndex++
  ) {
    const weekStart = addDays(currentMonday, weekIndex * 7);
    const weekEnd = addDays(weekStart, 6);

    const weekSection = document.createElement("details");
    weekSection.className = "planning-week";
    weekSection.open = weekIndex === 0;

    const weekTitle = document.createElement("summary");
    weekTitle.className = "planning-week-title";

    const formattedWeekStart = weekStart.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short"
    });

    const formattedWeekEnd = weekEnd.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short"
    });

    weekTitle.textContent =
      `Semaine ${getWeekNumber(weekStart)} · du ${formattedWeekStart} au ${formattedWeekEnd}`;

    weekSection.append(weekTitle);

    const daysContainer = document.createElement("div");
    daysContainer.className = "planning-week-days";

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const currentDate = addDays(weekStart, dayIndex);
      const currentDateISO = formatDateToISO(currentDate);
      const scheduledExercises = [];

      CHAPTERS.forEach((chapter) => {
        for (
          let exerciseNumber = 1;
          exerciseNumber <= chapter.count;
          exerciseNumber++
        ) {
          const exercise = getExercise(chapter.id, exerciseNumber);

          if (
            exercise.status === "postponed" &&
            exercise.date === currentDateISO
          ) {
            scheduledExercises.push({
              chapter,
              exerciseNumber
            });
          }
        }
      });

      const dayCard = document.createElement("article");
      dayCard.className = "day-card";

      const dayTitle = document.createElement("h4");
      dayTitle.textContent = formatDayLabel(currentDate);

      const daySubtitle = document.createElement("span");
      daySubtitle.textContent = formatDayLabel(currentDate);

      dayTitle.append(daySubtitle);
      dayCard.append(dayTitle);

      if (currentDateISO === formatDateToISO(getToday())) {
        dayCard.classList.add("is-today");
      }

      if (scheduledExercises.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-day";
        emptyMessage.textContent =
          "Aucun exercice programmé pour le moment.";

        dayCard.append(emptyMessage);
      }

      scheduledExercises.forEach((scheduledExercise) => {
        const taskRow = document.createElement("div");
        taskRow.className = "day-task";

        const taskIndicator = document.createElement("i");
        taskIndicator.className = "task-dot";

        const taskLabel = document.createElement("span");
        taskLabel.textContent =
          `${scheduledExercise.chapter.title} — exercice ${scheduledExercise.exerciseNumber}`;

        const validateButton = document.createElement("button");
        validateButton.textContent = "Valider ✓";

        validateButton.addEventListener("click", () => {
          markExerciseAsDone(
            scheduledExercise.chapter.id,
            scheduledExercise.exerciseNumber
          );
        });

        taskRow.append(
          taskIndicator,
          taskLabel,
          validateButton
        );

        dayCard.append(taskRow);
      });

      daysContainer.append(dayCard);
    }

    weekSection.append(daysContainer);
    planningContainer.append(weekSection);
  }
}




// Ouvre la fenêtre de gestion d'un exercice.
function openExercise(chapter, exerciseNumber) {
  activeExercise = {
    chapter,
    exerciseNumber
  };

  const exercise = getExercise(chapter.id, exerciseNumber);

  selectElement("#dialog-title").textContent =
    `${chapter.title} · Exercice ${exerciseNumber}`;

  selectElement("#dialog-date").textContent =
    exercise.status === "postponed"
      ? `Prévu le ${formatDateLabel(parseISODate(exercise.date))}`
      : exercise.status === "done"
        ? "Cet exercice est validé."
        : "À toi de jouer !";

  selectElement("#postpone-choice").value = "";
  selectElement("#postpone-comment").value = exercise.comment || "";

  selectElement("#exercise-dialog").showModal();
}

// Ferme la fenêtre de gestion d'un exercice.
function closeExerciseDialog() {
  selectElement("#exercise-dialog").close();
  activeExercise = null;
}

// Valide un exercice et actualise l'affichage.
function markExerciseAsDone(chapterId, exerciseNumber) {
  setExercise(chapterId, exerciseNumber, {
    status: "done",
    date: null
  });

  render();
  showNotification("Exercice validé, bravo !");
}

// Remet un exercice dans la liste des exercices à faire.
function resetActiveExercise() {
  if (!activeExercise) return;

  const chapterId = activeExercise.chapter.id;
  const exerciseNumber = activeExercise.exerciseNumber;

  closeExerciseDialog();

  setExercise(chapterId, exerciseNumber, {
    status: "todo",
    date: null
  });

  render();
  showNotification("Exercice remis dans la liste.");
}

// Calcule la nouvelle date en fonction du délai de report choisi.
function calculatePostponeDate(choice) {
  const today = getToday();

  if (choice === "business") {
    return addBusinessDays(today, POSTPONE_DELAYS.businessDays);
  }

  if (choice === "week") {
    return addDays(today, POSTPONE_DELAYS.oneWeek);
  }

  return addDays(today, POSTPONE_DELAYS.twoWeeks);
}

// Reporte l'exercice sélectionné à la date choisie.
function postponeActiveExercise() {
  if (!activeExercise) return;

  const postponeChoice = selectElement("#postpone-choice").value;

  if (!postponeChoice) {
    showNotification("Choisis une échéance pour continuer.");
    return;
  }

  const dueDate = calculatePostponeDate(postponeChoice);
  const dueDateISO = formatDateToISO(dueDate);

  const chapterId = activeExercise.chapter.id;
  const exerciseNumber = activeExercise.exerciseNumber;
  const comment = selectElement("#postpone-comment").value.trim();

  ensureWeekExists(dueDate);

  setExercise(chapterId, exerciseNumber, {
    status: "postponed",
    date: dueDateISO,
    comment
  });

  closeExerciseDialog();

  render();

  showNotification(
    `Exercice reporté au ${formatDateLabel(dueDate)}.`
  );
}

// Gère la validation depuis la fenêtre d'un exercice.
selectElement("#mark-done").addEventListener("click", () => {
  if (!activeExercise) return;

  const chapterId = activeExercise.chapter.id;
  const exerciseNumber = activeExercise.exerciseNumber;

  closeExerciseDialog();

  markExerciseAsDone(chapterId, exerciseNumber);
});

// Gère la remise à zéro depuis la fenêtre d'un exercice.
selectElement("#reset-exercise").addEventListener(
  "click",
  resetActiveExercise
);

// Gère le report depuis la fenêtre d'un exercice.
selectElement("#confirm-postpone").addEventListener(
  "click",
  postponeActiveExercise
);





function render() {
  ensurePlanningWeeks();
  renderTabs();
  renderChapters();
  renderProgress();
  renderPlanning();
  renderTracking();
  saveState();
}
  document
    .querySelectorAll(".nav-link")
    .forEach((b) =>
      b.addEventListener("click", () => switchPage(b.dataset.page)),
    );
  function switchPage(page) {
    document
      .querySelectorAll(".nav-link")
      .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.toggle("active", p.id === `page-${page}`));
  }
  selectElement("#back-to-week").addEventListener("click", () => switchPage("chapters"));

selectElement("#add-week").addEventListener("click", addNextWeek);

// Exporte les données de l'application dans un fichier JSON.
function exportState() {
  saveState();

  const backupBlob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });

  const downloadUrl = URL.createObjectURL(backupBlob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = `mes-revisions-sauvegarde-${formatDateToISO(getToday())}.json`;

  downloadLink.click();

  URL.revokeObjectURL(downloadUrl);

  showNotification("Sauvegarde téléchargée.");
}

// Importe une sauvegarde JSON dans l'application.
async function importState(event) {
  const importInput = event.target;
  const selectedFile = importInput.files[0];

  if (!selectedFile) return;

  try {
    const importedState = JSON.parse(await selectedFile.text());

    if (
      !Array.isArray(importedState.weeks) ||
      !importedState.exercises
    ) {
      throw new Error("format");
    }

    const userConfirmedImport = confirm(
      "Restaurer cette sauvegarde ? Les données actuelles seront remplacées.",
    );

    if (userConfirmedImport) {
      state = importedState;
      saveState();
      render();
      showNotification("Sauvegarde restaurée.");
    }
  } catch {
    showNotification(
      "Ce fichier ne semble pas être une sauvegarde Mes révisions valide.",
    );
  } finally {
    importInput.value = "";
  }
}

// Déclenche l'exportation lorsque l'utilisateur clique sur le bouton.
selectElement("#export-data").addEventListener("click", exportState);


// Déclenche l'importation lorsqu'un fichier est sélectionné.
selectElement("#import-data").addEventListener("change", importState);

ensurePlanningWeeks();
render();
