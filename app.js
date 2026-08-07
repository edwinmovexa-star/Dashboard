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
    selected = null;
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
const areas = () => [...new Set(operators.filter(o => o.activo).map(o => o.area))];
const todayRecord = (id) => records.find(r => r.operadorId === id && r.fecha === dateKey());
const isSuper = () => userProfile?.rol === "super_admin";

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

  const now = new Date();

  $("reportMonth").value =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  $("reportWeek").value = currentISOWeek();

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

  ["recordsAreaFilter", "reportAreaFilter"].forEach(id => {
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
    const members = operators.filter(o => o.activo && o.area === area),
        production = members.reduce((s, o) => s + values(o).output, 0),
        goal = members.reduce((s, o) => s + (Number(o.meta) || 0), 0),
        errors = members.reduce((s, o) => s + values(o).errors, 0),
        registered = members.filter(o => todayRecord(o.id)).length;
    return {
        area,
        members: members.length,
        production,
        goal,
        errors,
        registered,
        percent: goal ? Math.min(100, production / goal * 100) : (members.length ? registered / members.length * 100 : 0)
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

        return `<article class="area-kpi"><div><span>${icono} ${area}</span><strong>${s.production}</strong><small>${s.goal?`Meta: ${s.goal}`:`Registros: ${s.registered}/${s.members}`}</small></div><b>${s.percent.toFixed(0)}%</b><div class="mini-progress"><i style="width:${s.percent}%"></i></div><em>${s.errors} errores</em></article>`
    }).join("");
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

        <button data-record="${operator.id}">
          ${buttonText}
        </button>
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
  const activeOperators = operators.filter(operator => operator.activo);

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
}

function renderAreaProgress() {
    const area = $("dashboardAreaFilter").value;
    if (!area) return;
    const s = areaStats(area);
    $("selectedAreaTitle").textContent = area;
    $("donutValue").textContent = s.percent.toFixed(1) + "%";
    $("donut").style.setProperty("--progress", s.percent * 3.6 + "deg");
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
    ["WhatsApp", "Inventario", "Banco de imágenes"].includes(operator.area)
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

    console.log({
  selectedDate,
  operatorId: operator.id,
  operatorName: operator.nombre,
  recordId
});

  // Se consulta Firestore nuevamente para impedir duplicados,
  // aunque dos usuarios intenten registrar al mismo tiempo.
  const existingRecord = await getDoc(reference);

if (existingRecord.exists()) {
  const existingData = existingRecord.data();

  console.error("Registro encontrado:", {
    recordId,
    operadorSeleccionado: {
      id: operator.id,
      nombre: operator.nombre
    },
    registroExistente: existingData
  });

  alert(
    `Conflicto detectado. Registro: ${recordId}. Revisa la consola.`
  );

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
    $("adminOperatorsBody").innerHTML = operators.map(o => `<tr><td>${o.nombre}</td><td>${o.area}</td><td>${o.puesto}</td><td>${o.meta??"—"} ${o.unidad||""}</td><td><span class="status-pill ${o.activo?'':'inactive'}">${o.activo?'Activo':'Inactivo'}</span></td><td><div class="action-buttons"><button class="item-edit" data-edit="${o.id}"><i class="fa-solid fa-pen-to-square"></i></button><button data-toggle="${o.id}">${o.activo?'Desactivar':'Activar'}</button></div></td></tr>`).join("");
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
    if (confirm(`${operator.activo?'Desactivar':'Activar'} a ${operator.nombre}?`)) await updateDoc(doc(db, "operadores", id), {
        activo: !operator.activo,
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
    const [y, w] = value.split("-W").map(Number), jan4 = new Date(`${y}-01-04T12:00:00`), day = jan4.getDay() || 7, start = new Date(jan4);
    start.setDate(jan4.getDate() - day + 1 + (w - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function range() {
    const type = $("reportType").value;
    if (type === "week") return weekRange($("reportWeek").value);
    if (type === "month") {
        const [y, m] = $("reportMonth").value.split("-").map(Number);
        return [`${y}-${String(m).padStart(2,"0")}-01`, `${y}-${String(m).padStart(2,"0")}-${new Date(y,m,0).getDate()}`];
    }
    return [null, null];
}

function reportRows() {
    const area = $("reportAreaFilter").value,
        [start, end] = range();
    return allRows().filter(x => (area === "Todas" || x.operator.area === area) && (!start || x.record.fecha >= start && x.record.fecha <= end));
}

function workingDays() {
    const [start, end] = range();
    if (!start) return [...new Set(reportRows().map(x => x.record.fecha))].length;
    let count = 0,
        cursor = new Date(start + "T12:00:00"),
        finish = new Date(end + "T12:00:00");
    while (cursor <= finish) {
        if (cursor.getDay() !== 0) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

function updateReportControls() {
    const type = $("reportType").value;
    $("reportWeek").classList.toggle("hidden", type !== "week");
    $("reportMonth").classList.toggle("hidden", type !== "month");
}

function renderReport() {
    updateReportControls();
    const rows = reportRows(),
        area = $("reportAreaFilter").value,
        type = $("reportType").value,
        production = rows.reduce((s, x) => s + x.record.produccion, 0),
        errors = rows.reduce((s, x) => s + x.record.errores, 0),
        dailyGoal = operators.filter(o => o.activo && (area === "Todas" || o.area === area)).reduce((s, o) => s + (Number(o.meta) || 0), 0),
        days = workingDays(),
        goal = dailyGoal * days,
        percent = goal ? production / goal * 100 : 0;
    $("reportPeriodLabel").textContent = `${type==="general"?"Reporte general":type==="week"?"Reporte semanal":"Reporte mensual"} · ${area}`;
    $("reportCards").innerHTML = `<article class="report">Producción<strong>${production}</strong></article><article class="report">Meta<strong>${goal||"—"}</strong></article><article class="report">Errores<strong>${errors}</strong></article><article class="report">Cumplimiento<strong>${goal?percent.toFixed(1)+"%":"Sin meta"}</strong></article>`;
    $("reportBody").innerHTML = rows.length ? rows.map(({
        record,
        operator
    }) => `<tr><td>${record.fecha}</td><td>${operator.area}</td><td>${operator.nombre}</td><td>${operator.puesto}</td><td>${record.produccion}</td><td>${operator.meta??"—"}</td><td>${record.errores}</td><td>${operator.meta?(record.produccion/operator.meta*100).toFixed(1)+"%":"—"}</td></tr>`).join("") : '<tr><td colspan="8" class="empty">No hay registros.</td></tr>';
}

function exportReport() {
    const rows = reportRows();
    if (!rows.length) return alert("No hay registros para exportar.");
    const headers = ["Fecha", "Área", "Operador", "Puesto", "Producción", "Meta diaria", "Errores"],
        data = rows.map(({
            record,
            operator
        }) => [record.fecha, operator.area, operator.nombre, operator.puesto, record.produccion, operator.meta ?? "", record.errores]),
        csv = "\uFEFF" + [headers, ...data].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),
        link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {
        type: "text/csv;charset=utf-8"
    }));
    link.download = `reporte_${$("reportType").value}_${dateKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}
