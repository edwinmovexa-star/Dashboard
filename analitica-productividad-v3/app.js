import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    setDoc,
    addDoc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
    auth,
    db
} from "./firebase-service.js";

const $ = (id) => document.getElementById(id);
let userProfile = null,
    operators = [],
    records = [],
    selected = null,
    selectedPerformanceOperator = null;
const dateKey = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());
const dateText = () => new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
}).format(new Date());
const isSunday = () => new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short"
}).format(new Date()) === "Sun";
const isActiveOperator = (operator) => operator.activo === true || operator.activo === "true";
const areas = () => [...new Set(operators.filter(isActiveOperator).map(o => o.area))];
const todayRecord = (id) => records.find(r => r.operadorId === id && r.fecha === dateKey());
const isSuper = () => userProfile?.rol === "super_admin";

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short"
  }).format(parseDateKey(value));
}

function currentWeekRange() {
  const today = parseDateKey(dateKey());
  const weekday = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - weekday + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  return [formatDateKey(start), formatDateKey(end)];
}

function countWorkingDays(start, end) {
  if (!start || !end || start > end) return 0;
  let count = 0;
  const cursor = parseDateKey(start);
  const finish = parseDateKey(end);
  while (cursor <= finish) {
    if (cursor.getDay() !== 0) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function currentWeekElapsedDays() {
  const [start, end] = currentWeekRange();
  const effectiveEnd = dateKey() < end ? dateKey() : end;
  return countWorkingDays(start, effectiveEnd);
}

function recordByDate(operatorId, fecha) {
  return records.find(record =>
    record.operadorId === operatorId &&
    record.fecha === fecha
  );
}

function firstDayCurrentMonth() {
  return `${dateKey().slice(0, 7)}-01`;
}

function isAllowedRecordDate(fecha) {
  if (!fecha) return false;

  const today = dateKey();
  const firstDay = firstDayCurrentMonth();

  if (fecha < firstDay || fecha > today) {
    return false;
  }

  const selectedDate = new Date(`${fecha}T12:00:00`);

  // Domingo no es laborable.
  return selectedDate.getDay() !== 0;
}

function lockRecordInputs(locked) {
  document
    .querySelectorAll(
      "#dynamicFields input, #errorsInput, #notesInput, #recordForm button[type='submit']"
    )
    .forEach(element => {
      element.disabled = locked;
    });
}

function validateRecordDate() {
  if (!selected) return false;

  const fecha = $("recordDate").value;
  const statusElement = $("recordDateStatus");

  if (!isAllowedRecordDate(fecha)) {
    statusElement.textContent =
      "Selecciona una fecha válida del mes actual, de lunes a sábado.";

    statusElement.className = "date-error";
    lockRecordInputs(true);

    return false;
  }

  if (recordByDate(selected.id, fecha)) {
    statusElement.textContent =
      "Este operador ya tiene un registro en esta fecha.";

    statusElement.className = "date-error";
    lockRecordInputs(true);

    return false;
  }

  statusElement.textContent = "Fecha disponible para captura.";
  statusElement.className = "date-success";
  lockRecordInputs(false);

  return true;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return location.replace("login.html");
    const profileDoc = await getDoc(doc(db, "usuarios", user.uid));
    if (!profileDoc.exists() || !profileDoc.data().activo) {
        await signOut(auth);
        return location.replace("login.html");
    }
    userProfile = {
        uid: user.uid,
        ...profileDoc.data()
    };
    if (!["admin", "super_admin"].includes(userProfile.rol)) {
        await signOut(auth);
        return location.replace("login.html");
    }
    configureUI();
    onSnapshot(collection(db, "operadores"), snapshot => {
        operators = snapshot.docs.map(item => ({
          ...item.data(),
          id: item.id,
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));
        refresh();
    });
    onSnapshot(collection(db, "registros"), snapshot => {
        records = snapshot.docs.map(item => ({
          ...item.data(),
          id: item.id,
        }));
        refresh();
    });
});
function configureUI() {
  $("loading").classList.add("hidden");
  $("app").classList.remove("hidden");

  $("dateLabel").textContent = dateText();
  $("userName").childNodes[0].nodeValue = userProfile.nombre;
  $("profileRole").textContent = isSuper()
    ? "Superadministrador"
    : "Administrador";

  $("userInitials").textContent = userProfile.nombre
    .split(" ")
    .map(x => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Para admin solo se elimina la sección Administrar.
  if (!isSuper()) {
    document.querySelectorAll(".super-only").forEach(element => {
      element.remove();
    });
  }

  $("logout").onclick = () => signOut(auth);

  document.querySelectorAll(".nav").forEach(button => {
    button.onclick = () => showView(button);
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.onclick = () => {
      const modal = $(button.dataset.close);

      if (modal) {
        modal.classList.add("hidden");
      }
    };
  });

  $("recordForm").onsubmit = saveDailyRecord;
  $("performanceWeek").onchange = renderOperatorPerformance;

  // Funciones disponibles para admin y super_admin.
  $("dashboardAreaFilter").onchange = renderAreaProgress;
  $("recordsAreaFilter").onchange = renderRecords;
  $("reportAreaFilter").onchange = renderReport;

  $("reportType").onchange = () => {
    updateReportControls();
    renderReport();
  };

  $("reportWeek").onchange = renderReport;
  $("reportMonth").onchange = renderReport;
  $("exportReport").onclick = exportReport;
  $("analyticsPeriodType").onchange = () => {
    updateAnalyticsControls();
    renderAnalytics();
  };
  $("analyticsWeek").onchange = renderAnalytics;
  $("analyticsMonth").onchange = renderAnalytics;
  $("analyticsAreaFilter").onchange = renderAnalytics;

  const now = new Date();

  $("reportMonth").value =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  $("reportWeek").value = currentISOWeek();
  $("analyticsWeek").value = currentISOWeek();
  $("analyticsWeek").max = currentISOWeek();
  $("analyticsMonth").value = $("reportMonth").value;
  $("analyticsMonth").max = $("reportMonth").value;

  // Solamente super_admin puede administrar operadores.
  if (isSuper()) {
    $("newOperator").onclick = () => openOperatorForm();
    $("operatorForm").onsubmit = saveOperator;
    $("exportOperators").onclick = exportOperators;
    $("importOperators").onchange = importOperators;
  }
}
// function configureUI() {
//     $("loading").classList.add("hidden");
//     $("app").classList.remove("hidden");
//     $("dateLabel").textContent = dateText();
//     $("userName").childNodes[0].nodeValue = userProfile.nombre;
//     $("profileRole").textContent = isSuper() ? "Superadministrador" : "Administrador";
//     $("userInitials").textContent = userProfile.nombre.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
//     if (!isSuper()) document.querySelectorAll(".super-only").forEach(el => el.remove());
//     $("logout").onclick = () => signOut(auth);
//     document.querySelectorAll(".nav").forEach(button => button.onclick = () => showView(button));
//     document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => $(button.dataset.close).classList.add("hidden"));
//     $("recordForm").onsubmit = saveDailyRecord;
//     if (isSuper()) {
//         $("newOperator").onclick = () => openOperatorForm();
//         $("operatorForm").onsubmit = saveOperator;
//         $("exportOperators").onclick = exportOperators;
//         $("importOperators").onchange = importOperators;
//         $("recordsAreaFilter").onchange = renderRecords;
//         $("dashboardAreaFilter").onchange = renderAreaProgress;
//         $("reportAreaFilter").onchange = renderReport;
//         $("reportType").onchange = () => {
//             updateReportControls();
//             renderReport();
//         };
//         $("reportWeek").onchange = renderReport;
//         $("reportMonth").onchange = renderReport;
//         $("exportReport").onclick = exportReport;
//         const now = new Date();
//         $("reportMonth").value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
//         $("reportWeek").value = currentISOWeek();
//     }
// }

// function showView(button) {
//     document.querySelectorAll(".nav").forEach(x => x.classList.remove("active"));
//     button.classList.add("active");
//     document.querySelectorAll(".view").forEach(x => x.classList.remove("active-view"));
//     $(button.dataset.view).classList.add("active-view");
//     $("viewLabel").textContent = button.textContent.trim().toUpperCase();
// }
function showView(button) {
  const viewId = button.dataset.view;
  const targetView = document.getElementById(viewId);

  if (!targetView) {
    console.error(`No existe la vista con id="${viewId}"`);
    return;
  }

  document.querySelectorAll(".nav").forEach(item => {
    item.classList.remove("active");
  });

  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active-view");
  });

  button.classList.add("active");
  targetView.classList.add("active-view");

  const viewLabel = document.getElementById("viewLabel");

  if (viewLabel) {
    viewLabel.textContent = button.textContent.trim().toUpperCase();
  }
}

// function refresh() {
//     if (!userProfile) return;
//     fillFilters();
//     renderAreaSummary();
//     renderOperators();
//     renderAreaProgress();
//     if (isSuper()) {
//         renderRecords();
//         renderReport();
//         renderAdminOperators();
//     }
// }

function refresh() {
  if (!userProfile) return;

  fillFilters();
  renderAreaSummary();
  renderOperators();
  renderAreaProgress();
  renderRecords();
  renderReport();
  renderAnalytics();

  if (selectedPerformanceOperator && !$("operatorPerformanceModal").classList.contains("hidden")) {
    selectedPerformanceOperator = operators.find(operator => operator.id === selectedPerformanceOperator.id) || selectedPerformanceOperator;
    renderOperatorPerformance();
  }

  if (isSuper()) {
    renderAdminOperators();
  }
}

// function fillFilters() {
//     const options = areas().map(area => `<option value="${area}">${area}</option>`).join("");
//     const previous = $("dashboardAreaFilter").value;
//     $("dashboardAreaFilter").innerHTML = options;
//     if (areas().includes(previous)) $("dashboardAreaFilter").value = previous;
//     if (!isSuper()) return;
//     ["recordsAreaFilter", "reportAreaFilter"].forEach(id => {
//         const value = $(id).value;
//         $(id).innerHTML = '<option value="Todas">Todas las áreas</option>' + options;
//         if (value === "Todas" || areas().includes(value)) $(id).value = value;
//     });
// }

function fillFilters() {
  const currentAreas = areas();

  const options = currentAreas
    .map(area => `<option value="${area}">${area}</option>`)
    .join("");

  const dashboardFilter = $("dashboardAreaFilter");
  const previousDashboardArea = dashboardFilter.value;

  dashboardFilter.innerHTML = options;

  if (currentAreas.includes(previousDashboardArea)) {
    dashboardFilter.value = previousDashboardArea;
  }

  ["recordsAreaFilter", "reportAreaFilter", "analyticsAreaFilter"].forEach(id => {
    const filter = $(id);
    const previousValue = filter.value;

    filter.innerHTML =
      '<option value="Todas">Todas las áreas</option>' + options;

    if (
      previousValue === "Todas" ||
      currentAreas.includes(previousValue)
    ) {
      filter.value = previousValue;
    }
  });
}

function values(operator) {
    const record = todayRecord(operator.id);
    return {
        output: record?.produccion || 0,
        errors: record?.errores || 0
    };
}

function status(operator) {
    const v = values(operator);
    if (operator.area === "Revisión de plataforma") return v.errors > 100 ? "danger" : v.errors >= 80 ? "warning" : "success";
    if (!operator.meta) return v.errors > 10 ? "danger" : "";
    const ratio = v.output / operator.meta;
    return ratio >= 1 ? "success" : ratio >= .85 ? "warning" : "danger";
}

function areaStats(area) {
    const [start, end] = currentWeekRange();
    const members = operators.filter(operator => isActiveOperator(operator) && operator.area === area);
    const memberIds = new Set(members.map(operator => operator.id));
    const weekRecords = records.filter(record =>
        memberIds.has(record.operadorId) &&
        record.fecha >= start &&
        record.fecha <= end
    );
    const production = weekRecords.reduce((sum, record) => sum + Number(record.produccion || 0), 0);
    const errors = weekRecords.reduce((sum, record) => sum + Number(record.errores || 0), 0);
    const dailyGoal = members.reduce((sum, operator) => sum + Number(operator.meta || 0), 0);
    const elapsedDays = currentWeekElapsedDays();
    const weeklyGoal = dailyGoal * 6;
    const expectedGoal = dailyGoal * elapsedDays;
    const expectedRegistrations = members.length * elapsedDays;
    const registered = weekRecords.length;
    const percent = expectedGoal
        ? production / expectedGoal * 100
        : expectedRegistrations
            ? registered / expectedRegistrations * 100
            : 0;
    const weeklyPercent = weeklyGoal ? production / weeklyGoal * 100 : 0;
    let state = percent >= 100 ? "success" : percent >= 85 ? "warning" : "danger";

    if (area === "Revisión de plataforma") {
        if (errors > 100) state = "danger";
        else if (errors >= 80) state = "warning";
    }

    return {
        area,
        start,
        end,
        members: members.length,
        production,
        dailyGoal,
        weeklyGoal,
        expectedGoal,
        errors,
        registered,
        elapsedDays,
        percent,
        weeklyPercent,
        state
    };
}

function renderAreaSummary() {
    $("areaSummary").innerHTML = areas().map(area => {
        const s = areaStats(area);
        const iconArea = area;
        let icono = "";

      switch (area) {
        case "Operación":
          icono = '<i class="fas fa-boxes"></i>';
          break;
        case "WhatsApp":
          icono = '<i class="fa-brands fa-whatsapp"></i>'
          break;
        case "Banco de imágenes":
          icono = '<i class="fa-regular fa-image"></i>'
          break;
        case "Ortografía":
          icono = '<i class="fa-regular fa-keyboard"></i>'
          break;
        case "Etiquetas":
          icono = '<i class="fa-solid fa-print"></i>';
          break;
        case "Revisión de plataforma":
          icono = '<i class="fa-solid fa-panorama"></i>'  
          break;      
        default:
      }

        const progress = Math.min(100, Math.max(0, s.percent));
        return `<article class="area-kpi ${s.state}">
          <div>
            <span>${icono} ${area}</span>
            <strong>${s.production}</strong>
            <small>${s.weeklyGoal ? `Meta semanal: ${s.weeklyGoal}` : `Registros: ${s.registered}`}</small>
          </div>
          <b>${s.percent.toFixed(0)}%</b>
          <div class="mini-progress"><i style="width:${progress}%"></i></div>
          <div class="area-kpi-footer">
            <em>Meta al día: ${s.expectedGoal || "—"}</em>
            <em>${s.errors} errores</em>
          </div>
        </article>`;
    }).join("");

    const [start, end] = currentWeekRange();
    $("dashboardWeekLabel").textContent = `${formatShortDate(start)} — ${formatShortDate(end)}`;
}

function avatar(operator) {
    return operator.imagen ? `<div class="avatar photo" style="background-image:url('${operator.imagen}')">${operator.iniciales}</div>` : `<div class="avatar" style="background:${operator.color||'#b9d8cf'}">${operator.iniciales}</div>`;
}

// function operatorCard(operator, compact = false) {
//     const v = values(operator),
//         disabled = todayRecord(operator.id) || isSunday(),
//         text = isSunday() ? "Día no laborable" : disabled ? "✓ Registrado hoy" : "Registrar actividad";
//     if (compact) return `
//     <article class="operator-row ${status(operator)}">${avatar(operator)}
//     <div>
//     <h3>${operator.nombre}</h3>
//     <p>${operator.area}</p>
//     <small>${operator.puesto}</small>
//     </div>
//     <strong>${v.output}</strong>
//     <button data-record="${operator.id}" ${disabled?"disabled":""}>${text}</button></article>`;
//     return `
//     <article class="operator-card ${status(operator)}"> 
//     <div class="person">${avatar(operator)}<div>
//     <h3>${operator.nombre}</h3><p>${operator.area}</p>
//     </div>
//     </div>
//     <div class="metric">
//     <p class="item-contador">${v.output} - <small>${operator.unidad}</small></p>
  
//     <small>${operator.meta?`meta diaria ${operator.meta}`:"sin meta"}</small></div><button class="primary" data-record="${operator.id}" ${disabled?"disabled":""}>${text}</button></article>`;
// }

// function renderOperators() {
//     const active = operators.filter(o => o.activo);
//     $("featuredCards").innerHTML = active.map(o => operatorCard(o)).join("");
//     if (isSuper()) $("allCards").innerHTML = operators.map(o => operatorCard(o, true)).join("");
//     document.querySelectorAll("[data-record]").forEach(btn => btn.onclick = () => openRecord(btn.dataset.record));
// }

function operatorCard(operator, compact = false) {
  const valuesToday = values(operator);
  const registeredToday = todayRecord(operator.id);

  const buttonText = registeredToday
    ? "Registrar otra fecha"
    : "Registrar actividad";

  if (compact) {
    return `
      <article class="operator-row ${status(operator)}">
        ${avatar(operator)}

        <div>
          <h3>${operator.nombre}</h3>
          <p>${operator.area}</p>
          <small>${operator.puesto}</small>
        </div>

        <strong>${valuesToday.output}</strong>

        <div class="operator-row-actions">
          <button class="view-performance" data-performance="${operator.id}">
            <i class="fa-solid fa-chart-column"></i> Ver productividad
          </button>
          <button data-record="${operator.id}">${buttonText}</button>
        </div>
      </article>
    `;
  }

  return `
    <article class="operator-card ${status(operator)}">
      <div class="person">
        ${avatar(operator)}

        <div>
          <h3>${operator.nombre}</h3>
          <p>${operator.area}</p>
        </div>
      </div>

      <div class="metric">
        <strong>${valuesToday.output}</strong>
        <p>${operator.unidad}</p>

        <small>
          ${operator.meta
            ? `meta diaria ${operator.meta}`
            : "sin meta"}
        </small>
      </div>

      <button class="primary" data-record="${operator.id}">
        ${buttonText}
      </button>
    </article>
  `;
}

function renderOperators() {
  const activeOperators = operators.filter(isActiveOperator);

  $("featuredCards").innerHTML = activeOperators
    .map(operator => operatorCard(operator))
    .join("");

  const allCards = $("allCards");

  if (allCards) {
    allCards.innerHTML = operators
      .map(operator => operatorCard(operator, true))
      .join("");
  }

  document.querySelectorAll("[data-record]").forEach(button => {
    button.onclick = () => openRecord(button.dataset.record);
  });

  document.querySelectorAll("[data-performance]").forEach(button => {
    button.onclick = () => openOperatorPerformance(button.dataset.performance);
  });
}

function openOperatorPerformance(operatorId) {
  const operator = operators.find(item => item.id === operatorId);
  if (!operator) return;

  selectedPerformanceOperator = operator;
  $("performanceAvatar").innerHTML = avatar(operator);
  $("performanceName").textContent = operator.nombre;
  $("performanceInfo").textContent = `${operator.area} · ${operator.puesto} · ${isActiveOperator(operator) ? "Activo" : "Inactivo"}`;
  $("performanceWeek").max = currentISOWeek();
  $("performanceWeek").value = currentISOWeek();
  $("operatorPerformanceModal").classList.remove("hidden");
  renderOperatorPerformance();
}

function renderOperatorPerformance() {
  const operator = selectedPerformanceOperator;
  if (!operator) return;

  const selectedWeek = $("performanceWeek").value || currentISOWeek();
  const [start, end] = weekRange(selectedWeek);
  const startDate = parseDateKey(start);
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dailyGoal = Number(operator.meta || 0);
  const days = dayNames.map((name, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateValue = formatDateKey(date);
    return {
      name,
      date: dateValue,
      record: recordByDate(operator.id, dateValue)
    };
  });

  const totalProduction = days.reduce((sum, day) => sum + Number(day.record?.produccion || 0), 0);
  const totalErrors = days.reduce((sum, day) => sum + Number(day.record?.errores || 0), 0);
  const registeredDays = days.filter(day => day.record).length;
  const weeklyGoal = dailyGoal * 6;
  const percent = weeklyGoal
    ? totalProduction / weeklyGoal * 100
    : registeredDays / 6 * 100;
  const average = registeredDays ? totalProduction / registeredDays : 0;
  const maxValue = Math.max(dailyGoal, ...days.map(day => Number(day.record?.produccion || 0)), 1);
  const goalPosition = dailyGoal ? dailyGoal / maxValue * 100 : 0;

  $("performancePeriod").textContent = `${formatShortDate(start)} — ${formatShortDate(end)}`;
  $("performanceProduction").textContent = totalProduction;
  $("performanceGoal").textContent = weeklyGoal || "—";
  $("performancePercent").textContent = `${percent.toFixed(1)}%`;
  $("performanceAverage").textContent = average.toFixed(1);
  $("performanceErrors").textContent = totalErrors;
  $("performanceDays").textContent = `${registeredDays}/6`;
  $("performanceEmpty").classList.toggle("hidden", registeredDays > 0);

  $("performanceChart").innerHTML = days.map(day => {
    const production = Number(day.record?.produccion || 0);
    const errors = Number(day.record?.errores || 0);
    const height = day.record ? Math.max(4, production / maxValue * 100) : 4;
    const ratio = dailyGoal ? production / dailyGoal : day.record ? 1 : 0;
    const state = !day.record
      ? "no-record"
      : ratio >= 1
        ? "success"
        : ratio >= .85
          ? "warning"
          : "danger";
    const goalMarker = dailyGoal
      ? `<i class="performance-goal-marker" style="bottom:${goalPosition}%" title="Meta diaria: ${dailyGoal}"></i>`
      : "";

    return `<article class="performance-day ${state}">
      <div class="performance-plot">
        ${goalMarker}
        <span class="performance-value">${day.record ? production : "—"}</span>
        <div class="performance-bar" style="height:${height}%" title="${day.name}: ${production}"></div>
      </div>
      <strong>${day.name}</strong>
      <small>${formatShortDate(day.date)}</small>
      <em>${day.record ? `${errors} errores` : "Sin registro"}</em>
    </article>`;
  }).join("");
}

function renderAreaProgress() {
    const area = $("dashboardAreaFilter").value;
    if (!area) return;
    const s = areaStats(area);
    $("selectedAreaTitle").textContent = area;
    $("donutValue").textContent = s.percent.toFixed(1) + "%";
    $("donut").style.setProperty("--progress", Math.min(100, Math.max(0, s.percent)) * 3.6 + "deg");
    $("areaProduction").textContent = s.production;
    $("areaWeeklyGoal").textContent = s.weeklyGoal || "—";
    $("areaExpectedGoal").textContent = s.expectedGoal || "—";
    $("areaErrors").textContent = s.errors;
}

// function openRecord(id) {
//     const operator = operators.find(o => o.id === id);
//     if (!operator || todayRecord(id) || isSunday()) return;
//     selected = operator;
//     $("modalName").textContent = operator.nombre;
//     $("modalInfo").textContent = `${operator.area} · ${operator.puesto} · ${dateText()}`;
//     const bank = operator.area === "Banco de imágenes";
//     $("dynamicFields").innerHTML = bank ? '<div class="two-fields"><label>Imágenes con IA<input id="withAI" type="number" min="0" required></label><label>Imágenes sin IA<input id="withoutAI" type="number" min="0" required></label></div>' : `<label>Cantidad de ${operator.unidad}<input id="outputInput" type="number" min="0" required></label>`;
//     $("errorsField").classList.toggle("hidden", ["WhatsApp", "Inventario", "Banco de imágenes"].includes(operator.area));
//     $("recordModal").classList.remove("hidden");
// }

function openRecord(id) {
  const operator = operators.find(item => item.id === id);

  if (!operator) return;

  selected = operator;

  $("recordForm").reset();
  $("modalName").textContent = operator.nombre;
  $("modalInfo").textContent =
    `${operator.area} · ${operator.puesto}`;

  const recordDate = $("recordDate");

  recordDate.min = firstDayCurrentMonth();
  recordDate.max = dateKey();
  recordDate.value = dateKey();
  recordDate.onchange = validateRecordDate;

  const isImageBank = operator.area === "Banco de imágenes";

  $("dynamicFields").innerHTML = isImageBank
    ? `
      <div class="two-fields">
        <label>
          Imágenes con IA
          <input id="withAI" type="number" min="0" required>
        </label>

        <label>
          Imágenes sin IA
          <input id="withoutAI" type="number" min="0" required>
        </label>
      </div>
    `
    : `
      <label>
        Cantidad de ${operator.unidad}
        <input id="outputInput" type="number" min="0" required>
      </label>
    `;

  $("errorsField").classList.toggle(
    "hidden",
    ["Inventario", "Banco de imágenes"].includes(operator.area)
  );

  $("recordModal").classList.remove("hidden");

  validateRecordDate();
}


// async function saveDailyRecord(event) {
//     event.preventDefault();
//     const operator = selected;
//     if (!operator) return;
//     const recordId = `${dateKey()}_${operator.id}`,
//         reference = doc(db, "registros", recordId);
//     if ((await getDoc(reference)).exists()) {
//         alert("Este operador ya tiene registro hoy.");
//         return $("recordModal").classList.add("hidden");
//     }
//     const bank = operator.area === "Banco de imágenes",
//         production = bank ? Number($("withAI").value) + Number($("withoutAI").value) : Number($("outputInput").value),
//         errors = $("errorsField").classList.contains("hidden") ? 0 : Number($("errorsInput").value || 0);
//     await setDoc(reference, {
//         operadorId: operator.id,
//         fecha: dateKey(),
//         area: operator.area,
//         produccion: production,
//         errores: errors,
//         observaciones: $("notesInput").value.trim(),
//         creadoPor: auth.currentUser.uid,
//         creadoEn: new Date().toISOString()
//     });
//     $("recordModal").classList.add("hidden");
//     selected = null;
//     event.target.reset();
// }

async function saveDailyRecord(event) {
  event.preventDefault();

  const operator = selected;

  if (!operator) return;

  if (!validateRecordDate()) {
    alert("La fecha seleccionada no está disponible.");
    return;
  }

  const selectedDate = $("recordDate").value;
  const recordId = `${selectedDate}_${operator.id}`;
  const reference = doc(db, "registros", recordId);

  // Se consulta Firestore nuevamente para impedir duplicados,
  // aunque dos usuarios intenten registrar al mismo tiempo.
  const existingRecord = await getDoc(reference);

  if (existingRecord.exists()) {
    alert(`Este operador ya tiene un registro para el ${selectedDate}.`);
    validateRecordDate();
    return;
  }

  const isImageBank =
    operator.area === "Banco de imágenes";

  const production = isImageBank
    ? Number($("withAI").value) +
      Number($("withoutAI").value)
    : Number($("outputInput").value);

  const errors = $("errorsField").classList.contains("hidden")
    ? 0
    : Number($("errorsInput").value || 0);

  await setDoc(reference, {
    operadorId: operator.id,
    fecha: selectedDate,
    area: operator.area,
    produccion: production,
    conIA: isImageBank ? Number($("withAI").value) : null,
    sinIA: isImageBank ? Number($("withoutAI").value) : null,
    errores: errors,
    observaciones: $("notesInput").value.trim(),
    creadoPor: auth.currentUser.uid,
    creadoEn: new Date().toISOString()
  });

  $("recordModal").classList.add("hidden");

  selected = null;
  event.target.reset();
}

function renderAdminOperators() {
    $("adminOperatorsBody").innerHTML = operators.map(o => `<tr><td>${o.nombre}</td><td>${o.area}</td><td>${o.puesto}</td><td>${o.meta??"—"} ${o.unidad||""}</td><td><span class="status-pill ${isActiveOperator(o)?'':'inactive'}">${isActiveOperator(o)?'Activo':'Inactivo'}</span></td><td><div class="action-buttons"><button class="item-edit" data-edit="${o.id}"><i class="fa-solid fa-pen-to-square"></i></button><button data-toggle="${o.id}">${isActiveOperator(o)?'Desactivar':'Activar'}</button></div></td></tr>`).join("");
    document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openOperatorForm(operators.find(o => o.id === b.dataset.edit)));
    document.querySelectorAll("[data-toggle]").forEach(b => b.onclick = () => toggleOperator(b.dataset.toggle));
}

function openOperatorForm(operator = null) {
    $("operatorForm").reset();
    $("operatorId").value = operator?.id || "";
    $("operatorModalTitle").textContent = operator ? "Editar operador" : "Nuevo operador";
    $("operatorName").value = operator?.nombre || "";
    $("operatorInitials").value = operator?.iniciales || "";
    $("operatorArea").value = operator?.area || "";
    $("operatorPosition").value = operator?.puesto || "";
    $("operatorGoal").value = operator?.meta ?? "";
    $("operatorUnit").value = operator?.unidad || "";
    $("operatorImage").value = operator?.imagen || "";
    $("operatorActive").checked = operator?.activo ?? true;
    $("operatorModal").classList.remove("hidden");
}
async function saveOperator(event) {
    event.preventDefault();
    const id = $("operatorId").value,
        data = {
            nombre: $("operatorName").value.trim(),
            iniciales: $("operatorInitials").value.trim().toUpperCase(),
            area: $("operatorArea").value.trim(),
            puesto: $("operatorPosition").value.trim(),
            meta: $("operatorGoal").value === "" ? null : Number($("operatorGoal").value),
            unidad: $("operatorUnit").value.trim(),
            imagen: $("operatorImage").value.trim(),
            activo: $("operatorActive").checked,
            actualizadoEn: new Date().toISOString()
        };
    if (id) await updateDoc(doc(db, "operadores", id), data);
    else await addDoc(collection(db, "operadores"), {
        ...data,
        creadoEn: new Date().toISOString()
    });
    $("operatorModal").classList.add("hidden");
}
async function toggleOperator(id) {
    const operator = operators.find(o => o.id === id);
    if (confirm(`${isActiveOperator(operator)?'Desactivar':'Activar'} a ${operator.nombre}?`)) await updateDoc(doc(db, "operadores", id), {
        activo: !isActiveOperator(operator),
        actualizadoEn: new Date().toISOString()
    });
}

function exportOperators() {
    downloadJSON(operators.map(({
        id,
        ...data
    }) => ({
        id,
        ...data
    })), `operadores_${dateKey()}.json`);
}
async function importOperators(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error();
        if (!confirm(`Se importarán ${data.length} operadores. ¿Continuar?`)) return;
        const batch = writeBatch(db);
        data.forEach(item => {
            const {
                id,
                ...operator
            } = item;
            batch.set(doc(db, "operadores", id || crypto.randomUUID()), {
                ...operator,
                actualizadoEn: new Date().toISOString()
            }, {
                merge: true
            });
        });
        await batch.commit();
        alert("Operadores importados correctamente.");
    } catch {
        alert("El archivo JSON no es válido.");
    } finally {
        event.target.value = "";
    }
}

function downloadJSON(data, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
}

function allRows() {
    return records.map(record => ({
        record,
        operator: operators.find(o => o.id === record.operadorId)
    })).filter(x => x.operator).sort((a, b) => b.record.fecha.localeCompare(a.record.fecha));
}

function renderRecords() {
    const area = $("recordsAreaFilter").value,
        rows = allRows().filter(x => area === "Todas" || x.operator.area === area);
    $("recordsBody").innerHTML = rows.length ? rows.map(({
        record,
        operator
    }) => `<tr><td>${record.fecha}</td><td>${operator.area}</td><td>${operator.nombre}</td><td>${record.produccion}</td><td>${record.errores}</td><td>🔒 Bloqueado</td></tr>`).join("") : '<tr><td colspan="6" class="empty">No hay registros.</td></tr>';
}

function currentISOWeek() {
    const d = new Date(),
        u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
        day = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - day);
    const start = new Date(Date.UTC(u.getUTCFullYear(), 0, 1)),
        week = Math.ceil((((u - start) / 86400000) + 1) / 7);
    return `${u.getUTCFullYear()}-W${String(week).padStart(2,"0")}`;
}

function weekRange(value) {
    if (!value) return currentWeekRange();
    const [y, w] = value.split("-W").map(Number), jan4 = new Date(y, 0, 4, 12, 0, 0), day = jan4.getDay() || 7, start = new Date(jan4);
    start.setDate(jan4.getDate() - day + 1 + (w - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    return [formatDateKey(start), formatDateKey(end)];
}

function range() {
    const type = $("reportType").value;
    if (type === "week") return weekRange($("reportWeek").value);
    if (type === "month") {
        const [y, m] = $("reportMonth").value.split("-").map(Number);
        return [`${y}-${String(m).padStart(2,"0")}-01`, `${y}-${String(m).padStart(2,"0")}-${new Date(y,m,0).getDate()}`];
    }
    return currentWeekRange();
}

function reportRows() {
    const area = $("reportAreaFilter").value,
        [start, end] = range();
    return allRows().filter(x => (area === "Todas" || x.operator.area === area) && (!start || x.record.fecha >= start && x.record.fecha <= end));
}

function workingDays() {
    const [start, end] = range();
    return countWorkingDays(start, end);
}

function updateReportControls() {
    const type = $("reportType").value;
    $("reportWeek").classList.toggle("hidden", type !== "week");
    $("reportMonth").classList.toggle("hidden", type !== "month");
}

function updateAnalyticsControls() {
    const type = $("analyticsPeriodType").value;
    $("analyticsWeek").classList.toggle("hidden", type !== "week");
    $("analyticsMonth").classList.toggle("hidden", type !== "month");
}

function analyticsRange() {
    if ($("analyticsPeriodType").value === "month") {
        const value = $("analyticsMonth").value;
        if (!value) return currentWeekRange();
        const [year, month] = value.split("-").map(Number);
        return [
            `${year}-${String(month).padStart(2, "0")}-01`,
            `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`
        ];
    }
    return weekRange($("analyticsWeek").value);
}

function analyticsRows() {
    const [start, end] = analyticsRange();
    return allRows().filter(item => item.record.fecha >= start && item.record.fecha <= end);
}

function renderAnalytics() {
    updateAnalyticsControls();

    const rows = analyticsRows();
    const [start, end] = analyticsRange();
    const days = countWorkingDays(start, end);
    const periodType = $("analyticsPeriodType").value;
    const production = rows.reduce((sum, item) => sum + Number(item.record.produccion || 0), 0);
    const errors = rows.reduce((sum, item) => sum + Number(item.record.errores || 0), 0);
    const totalDailyGoal = operators
        .filter(isActiveOperator)
        .reduce((sum, operator) => sum + Number(operator.meta || 0), 0);
    const goal = totalDailyGoal * days;
    const percent = goal ? production / goal * 100 : 0;

    $("analyticsPeriodLabel").textContent = `${periodType === "week" ? "Vista semanal" : "Vista mensual"} · ${formatShortDate(start)} al ${formatShortDate(end)} · ${days} días laborables`;
    $("analyticsProduction").textContent = production;
    $("analyticsGoal").textContent = goal || "—";
    $("analyticsPercent").textContent = goal ? `${percent.toFixed(1)}%` : "Sin meta";
    $("analyticsErrors").textContent = errors;

    const areaNames = [...new Set([
        ...operators.map(operator => operator.area),
        ...rows.map(item => item.operator.area)
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b));

    const areaData = areaNames.map(area => {
        const areaRows = rows.filter(item => item.operator.area === area);
        const areaProduction = areaRows.reduce((sum, item) => sum + Number(item.record.produccion || 0), 0);
        const areaErrors = areaRows.reduce((sum, item) => sum + Number(item.record.errores || 0), 0);
        const areaDailyGoal = operators
            .filter(operator => isActiveOperator(operator) && operator.area === area)
            .reduce((sum, operator) => sum + Number(operator.meta || 0), 0);
        const areaGoal = areaDailyGoal * days;
        return {
            area,
            production: areaProduction,
            errors: areaErrors,
            goal: areaGoal,
            percent: areaGoal ? areaProduction / areaGoal * 100 : 0
        };
    });

    const maxAreaErrors = Math.max(...areaData.map(item => item.errors), 1);
    $("analyticsAreaChart").innerHTML = areaData.length
        ? areaData.map(item => {
            const productivityWidth = item.goal ? Math.min(100, item.percent) : item.production ? 100 : 0;
            const errorWidth = item.errors / maxAreaErrors * 100;
            const state = item.percent >= 100 ? "success" : item.percent >= 85 ? "warning" : "danger";
            return `<article class="analytics-area-item ${state}">
              <div class="analytics-item-heading"><strong>${item.area}</strong><b>${item.goal ? item.percent.toFixed(1) + "%" : "Sin meta"}</b></div>
              <div class="analytics-track"><i class="analytics-production-bar" style="width:${productivityWidth}%"></i></div>
              <div class="analytics-item-meta"><span>${item.production} producción</span><span>Meta ${item.goal || "—"}</span></div>
              <div class="analytics-error-row"><span>Errores</span><div><i style="width:${errorWidth}%"></i></div><b>${item.errors}</b></div>
            </article>`;
        }).join("")
        : '<p class="performance-empty">No existen áreas para mostrar.</p>';

    const selectedArea = $("analyticsAreaFilter").value || "Todas";
    const people = operators
        .filter(operator => selectedArea === "Todas" || operator.area === selectedArea)
        .map(operator => {
            const operatorRows = rows.filter(item => item.operator.id === operator.id);
            const operatorProduction = operatorRows.reduce((sum, item) => sum + Number(item.record.produccion || 0), 0);
            const operatorErrors = operatorRows.reduce((sum, item) => sum + Number(item.record.errores || 0), 0);
            const operatorGoal = Number(operator.meta || 0) * days;
            return {
                operator,
                production: operatorProduction,
                errors: operatorErrors,
                goal: operatorGoal,
                percent: operatorGoal ? operatorProduction / operatorGoal * 100 : 0,
                records: operatorRows.length
            };
        })
        .filter(item => item.records > 0 || isActiveOperator(item.operator))
        .sort((a, b) => b.production - a.production);

    const maxPersonErrors = Math.max(...people.map(item => item.errors), 1);
    $("analyticsPeopleTitle").textContent = selectedArea === "Todas" ? "Productividad por persona" : `Productividad · ${selectedArea}`;
    $("analyticsPeopleEmpty").classList.toggle("hidden", people.length > 0);
    $("analyticsPeopleChart").innerHTML = people.map(item => {
        const productivityWidth = item.goal ? Math.min(100, item.percent) : item.production ? 100 : 0;
        const errorWidth = item.errors / maxPersonErrors * 100;
        const state = item.percent >= 100 ? "success" : item.percent >= 85 ? "warning" : "danger";
        return `<article class="analytics-person-item ${state}">
          <div class="analytics-person-profile">${avatar(item.operator)}<div><strong>${item.operator.nombre}</strong><span>${item.operator.area} · ${item.operator.puesto}</span></div></div>
          <div class="analytics-person-metrics">
            <div class="analytics-item-heading"><span>Productividad</span><b>${item.goal ? item.percent.toFixed(1) + "%" : item.production}</b></div>
            <div class="analytics-track"><i class="analytics-production-bar" style="width:${productivityWidth}%"></i></div>
            <div class="analytics-item-meta"><span>${item.production} producción</span><span>Meta ${item.goal || "—"}</span></div>
            <div class="analytics-error-row"><span>Errores</span><div><i style="width:${errorWidth}%"></i></div><b>${item.errors}</b></div>
          </div>
        </article>`;
    }).join("");
}

function renderReport() {
    updateReportControls();
    const rows = reportRows(),
        area = $("reportAreaFilter").value,
        type = $("reportType").value,
        production = rows.reduce((s, x) => s + Number(x.record.produccion || 0), 0),
        errors = rows.reduce((s, x) => s + Number(x.record.errores || 0), 0),
        dailyGoal = operators.filter(o => isActiveOperator(o) && (area === "Todas" || o.area === area)).reduce((s, o) => s + (Number(o.meta) || 0), 0),
        days = workingDays(),
        goal = dailyGoal * days,
        percent = goal ? production / goal * 100 : 0,
        recordedDays = new Set(rows.map(item => item.record.fecha)).size,
        dailyAverage = recordedDays ? production / recordedDays : 0,
        [start, end] = range(),
        imageAI = rows.reduce((sum, item) => sum + Number(item.record.conIA || 0), 0),
        imageNoAI = rows.reduce((sum, item) => sum + Number(item.record.sinIA || 0), 0),
        imageDetail = area === "Banco de imágenes"
            ? `<article class="report image-breakdown">Con IA<strong>${imageAI}</strong><small>Sin IA: ${imageNoAI}</small></article>`
            : "";

    $("reportPeriodLabel").textContent = `${type === "week" ? "Reporte semanal" : "Reporte mensual"} · ${area} · ${formatShortDate(start)} al ${formatShortDate(end)}`;
    $("reportCards").innerHTML = `
      <article class="report">Producción<strong>${production}</strong><small>Total del periodo</small></article>
      <article class="report">Meta<strong>${goal || "—"}</strong><small>${days} días laborables</small></article>
      <article class="report">Errores<strong>${errors}</strong><small>Acumulados del periodo</small></article>
      <article class="report">Promedio diario<strong>${dailyAverage.toFixed(1)}</strong><small>${recordedDays} días con captura</small></article>
      <article class="report">Cumplimiento<strong>${goal ? percent.toFixed(1) + "%" : "Sin meta"}</strong><small>Producción contra meta</small></article>
      ${imageDetail}
    `;
    $("reportBody").innerHTML = rows.length ? rows.map(({
        record,
        operator
    }) => `<tr><td>${record.fecha}</td><td>${operator.area}</td><td>${operator.nombre}</td><td>${operator.puesto}</td><td>${record.produccion}</td><td>${operator.meta??"—"}</td><td>${record.errores}</td><td>${operator.meta?(record.produccion/operator.meta*100).toFixed(1)+"%":"—"}</td></tr>`).join("") : '<tr><td colspan="8" class="empty">No hay registros.</td></tr>';
}

function exportReport() {
    const rows = reportRows();
    if (!rows.length) return alert("No hay registros para exportar.");
    const headers = ["Fecha", "Área", "Operador", "Puesto", "Producción", "Meta diaria", "Errores", "Con IA", "Sin IA", "Cumplimiento"],
        data = rows.map(({
            record,
            operator
        }) => [
          record.fecha,
          operator.area,
          operator.nombre,
          operator.puesto,
          record.produccion,
          operator.meta ?? "",
          record.errores,
          record.conIA ?? "",
          record.sinIA ?? "",
          operator.meta ? (Number(record.produccion || 0) / Number(operator.meta) * 100).toFixed(1) + "%" : ""
        ]),
        csv = "\uFEFF" + [headers, ...data].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),
        link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {
        type: "text/csv;charset=utf-8"
    }));
    const safeArea = $("reportAreaFilter").value.toLowerCase().replaceAll(" ", "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const period = $("reportType").value === "week" ? $("reportWeek").value : $("reportMonth").value;
    link.download = `reporte_${safeArea}_${$("reportType").value}_${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}
