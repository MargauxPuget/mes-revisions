	const STORAGE_KEY = "mes-revisions-v1";
	const chapters = [
		{ id: "second-degre", title: "Le second degré", count: 35 },
		{ id: "derivation", title: "La dérivation", count: 28 },
	];

	// Variables globales
	let state;
	let active = null;


	const $ = (s) => document.querySelector(s);
	const today = () => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
	};
	const iso = (d) => {
	const x = new Date(d);
	x.setHours(12, 0, 0, 0);
	return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
	};
	const fromISO = (s) => {
	if (!s || typeof s !== "string") return new Date(NaN);

	const [y, m, d] = s.split("-").map(Number);

	if (!y || !m || !d) return new Date(NaN);

	const date = new Date(y, m - 1, d, 12);

	if (
		date.getFullYear() !== y ||
		date.getMonth() !== m - 1 ||
		date.getDate() !== d
	) {
		return new Date(NaN);
	}

	return date;
	};
	const addDays = (d, n) => {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
	};
	const addBusinessDays = (d, n) => {
	const x = new Date(d);
	let added = 0;
	while (added < n) {
		x.setDate(x.getDate() + 1);
		if (x.getDay() !== 0 && x.getDay() !== 6) added++;
	}
	return x;
	};

	const mondayOf = (d) => {
	const x = new Date(d);
	const shift = (x.getDay() + 6) % 7;
	x.setDate(x.getDate() - shift);
	x.setHours(12, 0, 0, 0);
	return x;
	};

	const weekNumber = (date) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));

	const firstThursday = new Date(d.getFullYear(), 0, 4);
	firstThursday.setDate(
		firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
	);

	return 1 + Math.round((d - firstThursday) / 604800000);
	};


	const dayLabel = (d) => d.toLocaleDateString("fr-FR", { weekday: "long" });
	const dateLabel = (d) =>
	d.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const makeInitial = () => {
	const first = mondayOf(today());
	return {
		version: 1,
		weeks: [0, 1, 2].map((i) => iso(addDays(first, i * 7))),
		selectedWeek: iso(first),
		exercises: {},
	};
	};

	try {
	state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || makeInitial();
	} catch {
	state = makeInitial();
	}
	if (!Array.isArray(state.weeks) || !state.exercises) state = makeInitial();
	state.weeks = state.weeks.filter((v, i, a) => a.indexOf(v) === i).sort();
	function ensureFutureWeeks() {
	const base = mondayOf(today());
	const required = [0, 1, 2].map((i) => iso(addDays(base, i * 7)));
	required.forEach((w) => {
		if (!state.weeks.includes(w)) state.weeks.push(w);
	});
	state.weeks.sort();
	// Keep all historical weeks; never prune stored work.
	if (!state.weeks.includes(state.selectedWeek))
		state.selectedWeek = iso(base);
	}

	// Sauvegarder les données du projet dans le navigateur
	function save() {
		// Vérifier que les semaines nécessaires sont disponibles
		ensureFutureWeeks();

		// Convertir les données en texte JSON
		const savedData = JSON.stringify(state);

		// Enregistrer les données dans le stockage local
		localStorage.setItem(STORAGE_KEY, savedData);
	}

	function key(ch, id) {
	return `${ch}:${id}`;
	}

	// Récupérer les données d'un exercice
	function getExercise(chapterId, exerciseNumber) {
		// Identifier l'exercice
		const exerciseKey = key(chapterId, exerciseNumber);

		// Récupérer les données de l'exercice
		const exerciseData = state.exercises[exerciseKey];

		// Définir les données à retourner
		let result;

		if (exerciseData) {
			result = exerciseData;
		} else {
			result = {
			status: "todo",
			date: null
			};
		}

		return result;
	}

	// Mettre à jour les données d'un exercice et sauvegarder les modifications
	function setExercise(chapterId, exerciseNumber, exerciseData) {
		// Identifier l'exercice à modifier
		const exerciseKey = key(chapterId, exerciseNumber);

		// Mettre à jour les informations de l'exercice
		state.exercises[exerciseKey] = exerciseData;

		// Sauvegarder les modifications
		save();
	}

	function ensureWeek(date) {
	const monday = iso(mondayOf(date));
	if (!state.weeks.includes(monday)) {
		state.weeks.push(monday);
		state.weeks.sort();
	}
	return monday;
	}
	function toast(msg) {
	const el = $("#toast");
	el.textContent = msg;
	el.classList.add("show");
	clearTimeout(toast.timer);
	toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
	}

	function renderTabs() {
	const host = $("#week-tabs");
	host.innerHTML = "";

	// Ne conserver que les semaines avec une date valide
	state.weeks = state.weeks.filter(
		(w) => typeof w === "string" && !isNaN(fromISO(w).getTime()),
	);

	// Éliminer les doublons
	state.weeks = [...new Set(state.weeks)].sort();

	// Garantir qu'il existe au moins une semaine
	if (state.weeks.length === 0) {
		const first = iso(mondayOf(today()));
		state.weeks = [first];
		state.selectedWeek = first;
	}

	// Corriger la semaine sélectionnée si elle est invalide
	if (!state.weeks.includes(state.selectedWeek)) {
		state.selectedWeek = iso(mondayOf(today()));
	}

	state.weeks.forEach((w) => {
		const b = document.createElement("button");
		b.className = "week-tab" + (w === state.selectedWeek ? " active" : "");
		const date = fromISO(w);

		const title = document.createElement("strong");
		title.textContent = `Semaine ${weekNumber(date)}`;

		const subtitle = document.createElement("small");
		subtitle.textContent = `du ${date.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
		})}`;

		b.append(title, subtitle);
		b.setAttribute("role", "tab");
		b.setAttribute("aria-selected", String(w === state.selectedWeek));

		b.addEventListener("click", () => {
		state.selectedWeek = w;
		save();
		render();
		});

		host.append(b);
	});

	const current = mondayOf(today());
	const shown = fromISO(state.selectedWeek);

	$("#week-summary").textContent =
		state.selectedWeek === iso(current)
		? "La semaine en cours"
		: shown < current
			? "Une semaine passée — ton historique est conservé"
			: "Une semaine à venir";
	}

	function renderChapters() {
	const host = $("#chapters-list");
	host.innerHTML = "";
	chapters.forEach((ch) => {
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
			const due = fromISO(ex.date);
			if (iso(mondayOf(due)) === state.selectedWeek)
			cell.classList.add("same-week");
		}
		const number = document.createElement("span");
		number.className = 'cell-number';
		number.textContent = i;

		cell.append(number);

		if (ex.status === "postponed") {
			const due = fromISO(ex.date);

			if (isNaN(due.getTime())) {
			ex.status = "todo";
			ex.date = null;
			} else {
			const dueWeek = iso(mondayOf(due));
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
				small.textContent = dayLabel(due);
				cell.append(small);
			} else if (selected < dueWeek) {
				// Semaines avant la date prévue : diagonale
				cell.classList.add("postponed-diagonal");
			}
			// Semaines après la date prévue : case normale, sans jour
			}

			cell.title = `Reporté au ${dateLabel(due)}`;
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
	chapters.forEach((ch) => {
		total += ch.count;
		for (let i = 1; i <= ch.count; i++)
		if (getExercise(ch.id, i).status === "done") done++;
	});
	$("#progress-count").textContent = `${done} / ${total}`;
	$("#progress-bar").style.width = `${(done / total) * 100}%`;
	}


	function renderPlanning() {
	const host = $('#daily-planning');
	host.innerHTML = '';

	const start = mondayOf(today());

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
		`Semaine ${weekNumber(weekStart)} · du ${
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
		const dateKey = iso(date);
		const tasks = [];

		chapters.forEach(ch => {
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
		heading.textContent = dayLabel(date);

		const sub = document.createElement('span');
		sub.textContent = dateLabel(date);
		heading.append(sub);

		day.append(heading);

		if (dateKey === iso(today())) {
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
			toast('Exercice validé, bravo !');
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

	
	// Ouvrir la fenêtre permettant de gérer un exercice
	function openExercise(chapter, exerciseNumber) {
		// Mémoriser l'exercice actuellement sélectionné
		active = {
			ch: chapter,
			n: exerciseNumber
		};

		// Récupérer les données de l'exercice
		const exerciseData = getExercise(chapter.id, exerciseNumber);

		// Afficher le titre de la fenêtre
		$("#dialog-title").textContent =
			`${chapter.title} · Exercice ${exerciseNumber}`;

		// Préparer le message correspondant à l'état de l'exercice
		let dialogMessage;

		if (exerciseData.status === "postponed") {
			dialogMessage = `Prévu le ${dateLabel(fromISO(exerciseData.date))}`;
		} else if (exerciseData.status === "done") {
			dialogMessage = "Cet exercice est validé.";
		} else {
			dialogMessage = "À toi de jouer !";
		}

		// Afficher le message dans la fenêtre
		$("#dialog-date").textContent = dialogMessage;

		// Réinitialiser le choix de report
		$("#postpone-choice").value = "";

		// Afficher le commentaire déjà enregistré
		$("#postpone-comment").value = exerciseData.comment || "";

		// Ouvrir la fenêtre
		$("#exercise-dialog").showModal();
	}

	function closeDialog() {
	$("#exercise-dialog").close();
	}
	$("#mark-done").addEventListener("click", () => {
	if (!active) return;
	setExercise(active.ch.id, active.n, { status: "done", date: null });
	closeDialog();
	render();
	toast("Exercice validé, bravo !");
	});
	$("#reset-exercise").addEventListener("click", () => {
	if (!active) return;
	setExercise(active.ch.id, active.n, { status: "todo", date: null });
	closeDialog();
	render();
	toast("Exercice remis dans la liste.");
	});
	$("#confirm-postpone").addEventListener("click", () => {
	if (!active) return;
	const choice = $("#postpone-choice").value;
	if (!choice) {
		toast("Choisis une échéance pour continuer.");
		return;
	}
	const base = today();
	let due;
	if (choice === "business") due = addBusinessDays(base, 2);
	else if (choice === "week") due = addDays(base, 7);
	else due = addDays(base, 14);
	const dueISO = iso(due);
	ensureWeek(due);
	setExercise(active.ch.id, active.n, { status: "postponed", date: dueISO, comment: $('#postpone-comment').value.trim() });
	closeDialog();
	render();
	toast(`Exercice reporté au ${dateLabel(due)}.`);
	});
	
	// Actualiser l'affichage du site et sauvegarder les données
	function render() {
		// Vérifier que les semaines nécessaires sont disponibles
		ensureFutureWeeks();

		// Afficher les onglets des semaines
		renderTabs();

		// Afficher les chapitres et leurs exercices
		renderChapters();

		// Actualiser la progression des exercices
		renderProgress();

		// Actualiser le planning
		renderPlanning();

		// Sauvegarder les données
		save();
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
	$("#back-to-week").addEventListener("click", () => switchPage("chapters"));
	$("#add-week").addEventListener("click", () => {
	const latest = fromISO(state.weeks[state.weeks.length - 1]);
	const next = iso(addDays(latest, 7));
	state.weeks.push(next);
	state.weeks.sort();
	state.selectedWeek = next;
	save();
	render();
	toast("Une nouvelle semaine a été ajoutée.");
	});
	$("#export-data").addEventListener("click", () => {
	save();
	const blob = new Blob([JSON.stringify(state, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `mes-revisions-sauvegarde-${iso(today())}.json`;
	a.click();
	URL.revokeObjectURL(url);
	toast("Sauvegarde téléchargée.");
	});
	$("#import-data").addEventListener("change", async (e) => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		const imported = JSON.parse(await file.text());
		if (!Array.isArray(imported.weeks) || !imported.exercises)
		throw new Error("format");
		if (
		!confirm(
			"Restaurer cette sauvegarde ? Les données actuelles seront remplacées.",
		)
		)
		return;
		state = imported;
		ensureFutureWeeks();
		save();
		render();
		toast("Sauvegarde restaurée.");
	} catch {
		toast(
		"Ce fichier ne semble pas être une sauvegarde Mes révisions valide.",
		);
	}
	e.target.value = "";
	});
	ensureFutureWeeks();
	render();
