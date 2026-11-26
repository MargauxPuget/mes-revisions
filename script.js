 
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

// Exercice actuellement sélectionné
let active = null;

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









  function renderChapters() {
    const host = selectElement("#chapters-list");
    host.innerHTML = "";
    CHAPTERS.forEach((ch) => {
      const card = document.createElement("article");
      card.className = "chapter-card";
      const done = Array.from({ length: ch.count }, (_, i) =>
        getExercise(ch.id, i + 1),
      ).filter((x) => x.status === "done").length;
      card.innerHTML = `<div class="chapter-head"><div><h3>${ch.title}</h3><p>${ch.count} exercices pour progresser</p></div><span class="chapter-count">${done} / ${ch.count} validés</span></div><div class="exercise-grid"></div>`;
      const grid = card.querySelector(".exercise-grid");
      for (let i = 1; i <= ch.count; i++) {
        const ex = getExercise(ch.id, i),
          cell = document.createElement("button");
        cell.className = "exercise-cell";
        cell.type = "button";
        if (ex.status === "done") cell.classList.add("done");
        if (ex.status === "postponed") {
          cell.classList.add("postponed");
          const due = parseISODate(ex.date);
          if (formatDateToISO(getMondayOfWeek(due)) === state.selectedWeek)
            cell.classList.add("same-week");
        }
        const number = document.createElement("span");
        number.className = 'cell-number';
        number.textContent = i;

        cell.append(number);

        if (ex.status === "postponed") {
          const due = parseISODate(ex.date);

          if (isNaN(due.getTime())) {
            ex.status = "todo";
            ex.date = null;
          } else {
            const dueWeek = formatDateToISO(getMondayOfWeek(due));
            const selected = state.selectedWeek;

            // Afficher le commentaire à partir de la semaine prévue
            if (selected >= dueWeek && ex.comment) {
              const comment = document.createElement("small");
              comment.className = "exercise-comment";
              comment.textContent = ex.comment;
              cell.append(comment);
            }

            if (selected === dueWeek) {
              // Semaine prévue : case normale avec le jour
              const small = document.createElement("small");
              small.textContent = formatDayLabel(due);
              cell.append(small);
            } else if (selected < dueWeek) {
              // Semaines avant la date prévue : diagonale
              cell.classList.add("postponed-diagonal");
            }
            // Semaines après la date prévue : case normale, sans jour
          }

          cell.title = `Reporté au ${formatDateLabel(due)}`;
        } else
          cell.title =
            ex.status === "done"
              ? "Exercice validé"
              : "Cliquer pour gérer cet exercice";
        cell.addEventListener("click", () => openExercise(ch, i));
        grid.append(cell);
      }
      host.append(card);
    });
  }

  function renderProgress() {
    let total = 0,
      done = 0;
    CHAPTERS.forEach((ch) => {
      total += ch.count;
      for (let i = 1; i <= ch.count; i++)
        if (getExercise(ch.id, i).status === "done") done++;
    });
    selectElement("#progress-count").textContent = `${done} / ${total}`;
    selectElement("#progress-bar").style.width = `${(done / total) * 100}%`;
  }



function renderTracking() {
  const host = selectElement("#tracking-content");
  host.innerHTML = "";

  CHAPTERS.forEach((ch) => {
    const exercises = [];

    for (let i = 1; i <= ch.count; i++) {
      const ex = getExercise(ch.id, i);

      if (ex.history && ex.history.length > 0) {
        exercises.push({
          number: i,
          history: ex.history
        });
      }
    }

    if (exercises.length === 0) return;

    // Accordéon du chapitre (niveau 1)
    const chapter = document.createElement("details");
    chapter.className = "tracking-chapter";
    chapter.open = false;

    const title = document.createElement("summary");
    title.className = "tracking-chapter-title";
    title.textContent = ch.title;

    chapter.append(title);

    // Contenu du chapitre : accordéons des exercices
    const chapterContent = document.createElement("div");
    chapterContent.className = "tracking-chapter-content";

    exercises.forEach((exercise) => {
      const card = document.createElement("details");
      card.className = "tracking-exercise";
      card.open = false;

      const heading = document.createElement("summary");
      heading.className = "tracking-exercise-title";
      heading.textContent = `Exercice ${exercise.number}`;

      card.append(heading);

      const history = document.createElement("div");
      history.className = "tracking-history";

      const events = [...exercise.history].reverse();

      events.forEach((event) => {
        const item = document.createElement("div");
        item.className = `tracking-event ${event.type}`;

        const date = document.createElement("p");
        date.textContent = event.date
          ? formatDateLabel(parseISODate(event.date))
          : "Date inconnue";

        const description = document.createElement("p");

        if (event.type === "postponed") {
          description.textContent = event.dueDate
            ? `Exercice reporté au ${formatDateLabel(parseISODate(event.dueDate))}`
            : "Exercice reporté";
        } else if (event.type === "done") {
          description.textContent = "Exercice validé ✓";
        } else {
          description.textContent = "Exercice remis à faire";
        }

        item.append(date, description);

        if (event.comment) {
          const comment = document.createElement("p");
          comment.className = "tracking-comment";
          comment.textContent = event.comment;
          item.append(comment);
        }

        history.append(item);
      });

      card.append(history);
      chapterContent.append(card);
    });

    chapter.append(chapterContent);
    host.append(chapter);
  });

  if (host.children.length === 0) {
    host.textContent =
      "Aucun historique pour le moment. Tes prochains reports et validations apparaîtront ici.";
  }
}





function renderPlanning() {
  const host = selectElement('#daily-planning');
  host.innerHTML = '';

  const start = getMondayOfWeek(getToday());

  // Afficher 3 semaines
  for (let week = 0; week < 3; week++) {
    const weekStart = addDays(start, week * 7);
    const weekEnd = addDays(weekStart, 6);

    // Créer le bloc déroulant
    const weekSection = document.createElement('details');
    weekSection.className = 'planning-week';
    weekSection.open = week === 0;

    // Titre de la semaine
    const summary = document.createElement('summary');
    summary.className = 'planning-week-title';
    summary.textContent =
      `Semaine ${getWeekNumber(weekStart)} · du ${
        weekStart.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short'
        })
      } au ${
        weekEnd.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short'
        })
      }`;

    weekSection.append(summary);

    // Conteneur des journées
    const daysContainer = document.createElement('div');
    daysContainer.className = 'planning-week-days';

    // Afficher les 7 jours de la semaine
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateKey = formatDateToISO(date);
      const tasks = [];

      CHAPTERS.forEach(ch => {
        for (let n = 1; n <= ch.count; n++) {
          const ex = getExercise(ch.id, n);

          if (
            ex.status === 'postponed' &&
            ex.date === dateKey
          ) {
            tasks.push({ ch, n, ex });
          }
        }
      });

      const day = document.createElement('article');
      day.className = 'day-card';

      const heading = document.createElement('h4');
      heading.textContent = formatDayLabel(date);

      const sub = document.createElement('span');
      sub.textContent = formatDayLabel(date);
      heading.append(sub);

      day.append(heading);

      if (dateKey === formatDateToISO(getToday())) {
        day.classList.add('is-today');
      }

      if (tasks.length === 0) {
        const p = document.createElement('p');
        p.className = 'empty-day';
        p.textContent = 'Aucun exercice programmé pour le moment.';
        day.append(p);
      }

      tasks.forEach(t => {
        const row = document.createElement('div');
        row.className = 'day-task';

        const dot = document.createElement('i');
        dot.className = 'task-dot';
        row.append(dot);

        const label = document.createElement('span');
        label.textContent = `${t.ch.title} — exercice ${t.n}`;
        row.append(label);

        const done = document.createElement('button');
        done.textContent = 'Valider ✓';

        done.addEventListener('click', () => {
          setExercise(t.ch.id, t.n, {
            status: 'done',
            date: null
          });

          render();
          showNotification('Exercice validé, bravo !');
        });

        row.append(done);
        day.append(row);
      });

      daysContainer.append(day);
    }

    weekSection.append(daysContainer);
    host.append(weekSection);
  }
}


  function openExercise(ch, n) {
    active = { ch, n };
    const ex = getExercise(ch.id, n);
    selectElement("#dialog-title").textContent = `${ch.title} · Exercice ${n}`;
    selectElement("#dialog-date").textContent =
      ex.status === "postponed"
        ? `Prévu le ${formatDateLabel(parseISODate(ex.date))}`
        : ex.status === "done"
          ? "Cet exercice est validé."
          : "À toi de jouer !";
    selectElement("#postpone-choice").value = "";
    selectElement('#postpone-comment').value = ex.comment || '';
    selectElement("#exercise-dialog").showModal();
  }
  function closeDialog() {
    selectElement("#exercise-dialog").close();
  }
  selectElement("#mark-done").addEventListener("click", () => {
    if (!active) return;
    setExercise(active.ch.id, active.n, { status: "done", date: null });
    closeDialog();
    render();
    showNotification("Exercice validé, bravo !");
  });
  selectElement("#reset-exercise").addEventListener("click", () => {
    if (!active) return;
    setExercise(active.ch.id, active.n, { status: "todo", date: null });
    closeDialog();
    render();
    showNotification("Exercice remis dans la liste.");
  });
  selectElement("#confirm-postpone").addEventListener("click", () => {
    if (!active) return;
    const choice = selectElement("#postpone-choice").value;
    if (!choice) {
      showNotification("Choisis une échéance pour continuer.");
      return;
    }
    const base = getToday();
    let due;
    if (choice === "business") due = addBusinessDays(base, 2);
    else if (choice === "week") due = addDays(base, 7);
    else due = addDays(base, 14);
    const dueISO = formatDateToISO(due);
    ensureWeekExists(due);
    setExercise(active.ch.id, active.n, { status: "postponed", date: dueISO, comment: selectElement('#postpone-comment').value.trim() });
    closeDialog();
    render();
    showNotification(`Exercice reporté au ${formatDateLabel(due)}.`);
  });

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
