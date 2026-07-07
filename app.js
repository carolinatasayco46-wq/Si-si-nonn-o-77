/* ====================================================================
   SKILLSWAP — MVP de Trueque de Conocimientos
   Conectado con la Base de Datos Real de Supabase
   ==================================================================== */

/* ------------------------------------------------------------------ */
/* CONFIG / METADATA & SUPABASE                                       */
/* ------------------------------------------------------------------ */
// REEMPLAZA ESTAS DOS LÍNEAS CON TUS CREDENCIALES REALES DE SUPABASE:
const SUPABASE_URL = "https://TU_ID_DE_PROYECTO.supabase.co"; 
const SUPABASE_KEY = "TU_API_KEY_PUBLISHABLE_DE_LA_CAPTURA";

// Inicialización del cliente oficial de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CURRENT_USER_ID = "u1";

const CATEGORY_META = {
  Programación: { icon: "code-2", color: "#4F46E5" },
  Matemáticas: { icon: "sigma", color: "#0EA5E9" },
  Idiomas: { icon: "languages", color: "#F59E0B" },
  Diseño: { icon: "palette", color: "#EC4899" },
  Ciencias: { icon: "flask-conical", color: "#10B981" },
  Música: { icon: "music-2", color: "#8B5CF6" },
};
const CATEGORIES = Object.keys(CATEGORY_META);

/* ------------------------------------------------------------------ */
/* ESTADO GLOBAL (Mantenemos los filtros y la UI)                     */
/* ------------------------------------------------------------------ */
const state = {
  users: {}, // Se rellenará desde la base de datos o se mantendrá una simulación
  questions: [], // Ahora vendrán directamente de Supabase
  filters: { category: "Todas", status: "Todas", search: "" },
  expandedId: null,
  drafts: {},
  modalOpen: false,
};

// Usuarios por defecto en caso de que no uses tabla de usuarios aún
const fallbackUsers = {
  u1: { id: "u1", nombre: "Tú", avatar: "https://i.pravatar.cc/150?img=12", expertise: ["Programación", "Diseño"], puntos: 100 },
  u2: { id: "u2", nombre: "Marina Vidal", avatar: "https://i.pravatar.cc/150?img=47", expertise: ["Matemáticas"], puntos: 260 },
  u3: { id: "u3", nombre: "Kenji Sato", avatar: "https://i.pravatar.cc/150?img=15", expertise: ["Programación"], puntos: 340 },
  u4: { id: "u4", nombre: "Lucía Fernández", avatar: "https://i.pravatar.cc/150?img=32", expertise: ["Idiomas"], puntos: 190 },
  u5: { id: "u5", nombre: "Diego Ramírez", avatar: "https://i.pravatar.cc/150?img=53", expertise: ["Diseño"], puntos: 150 },
  u6: { id: "u6", nombre: "Amara Boateng", avatar: "https://i.pravatar.cc/150?img=28", expertise: ["Ciencias"], puntos: 410 },
  u7: { id: "u7", nombre: "Iker Otxoa", avatar: "https://i.pravatar.cc/150?img=8", expertise: ["Música"], puntos: 95 },
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */
function currentUser() {
  return state.users[CURRENT_USER_ID] || fallbackUsers[CURRENT_USER_ID];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getFilteredQuestions() {
  const { category, status, search } = state.filters;
  return state.questions
    .filter((q) => (category === "Todas" ? true : q.categoria === category))
    .filter((q) => {
      if (status === "Todas") return true;
      if (status === "Destacada") return q.destacada;
      return q.estado === status;
    })
    .filter((q) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return q.titulo.toLowerCase().includes(s) || q.descripcion.toLowerCase().includes(s);
    });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

/* ------------------------------------------------------------------ */
/* TOASTS & BALANCE                                                   */
/* ------------------------------------------------------------------ */
function pushToast(message, sub) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast-card";
  el.innerHTML = `
    <div class="toast-icon"><i data-lucide="coins" class="h-4 w-4 text-emerald-500"></i></div>
    <div>
      <p class="text-sm font-semibold text-slate-900">${escapeHtml(message)}</p>
      ${sub ? `<p class="text-xs text-slate-500">${escapeHtml(sub)}</p>` : ""}
    </div>
  `;
  container.appendChild(el);
  refreshIcons();
  setTimeout(() => el.remove(), 2600);
}

function bumpBalance() {
  const badge = document.getElementById("balance-badge");
  badge.classList.add("balance-pulse");
  setTimeout(() => badge.classList.remove("balance-pulse"), 350);
}

/* ------------------------------------------------------------------ */
/* CONEXIÓN DIRECTA CON SUPABASE (CARGAR DATOS)                      */
/* ------------------------------------------------------------------ */
async function loadDataFromSupabase() {
  try {
    // 1. Cargamos las dudas desde la tabla 'questions' ordenadas por fecha reciente
    let { data: questions, error: qError } = await supabase
      .from('questions')
      .select('*, respuestas(*)') // Trae la pregunta y sus respuestas asociadas
      .order('fecha', { ascending: false });

    if (qError) throw qError;

    state.questions = questions || [];
    state.users = fallbackUsers; // Mantenemos los avatares simulados vinculados por ID
    
    render();
  } catch (err) {
    console.error("Error conectando con Supabase:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* RENDERS DE LA INTERFAZ                                             */
/* ------------------------------------------------------------------ */
function renderUserBar() {
  const u = currentUser();
  document.getElementById("current-user-avatar").src = u.avatar;
  document.getElementById("current-user-avatar").alt = u.nombre;
  document.getElementById("current-user-name").textContent = u.nombre;
  document.getElementById("balance-value").textContent = u.puntos;
}

function renderLeftSidebar() {
  const statuses = [
    { key: "Todas", label: "Todas" },
    { key: "Abierta", label: "Abiertas" },
    { key: "Destacada", label: "Destacadas" },
    { key: "Resuelta", label: "Resueltas" },
  ];

  const statusHtml = statuses
    .map((s) => {
      const active = state.filters.status === s.key;
      return `
      <button data-action="filter-status" data-status="${s.key}"
        class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
        }">
        ${s.label}
        ${active ? '<i data-lucide="chevron-right" class="h-3.5 w-3.5"></i>' : ""}
      </button>`;
    })
    .join("");
  document.getElementById("status-filters").innerHTML = statusHtml;

  const allActive = state.filters.category === "Todas";
  let catHtml = `
    <button data-action="filter-category" data-category="Todas"
      class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        allActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
      }">
      <i data-lucide="sparkles" class="h-[15px] w-[15px]"></i> Todas
    </button>`;
  catHtml += CATEGORIES.map((cat) => {
    const meta = CATEGORY_META[cat];
    const active = state.filters.category === cat;
    return `
      <button data-action="filter-category" data-category="${cat}"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
        }">
        <i data-lucide="${meta.icon}" class="h-4 w-4" style="color:${meta.color}"></i> ${cat}
      </button>`;
  }).join("");
  document.getElementById("category-filters").innerHTML = catHtml;

  refreshIcons();
}

function renderQuestionCard(q) {
  const author = state.users[q.usuarioId] || fallbackUsers.u2;
  const meta = CATEGORY_META[q.categoria] || { icon: "help-circle", color: "#64748B" };
  const isAuthor = q.usuarioId === CURRENT_USER_ID;
  const isResolved = q.estado === "Resuelta";
  const expanded = state.expandedId === q.id;

  const respuestasArray = q.respuestas || [];

  const answersHtml = respuestasArray
    .map((r) => {
      const responder = state.users[r.usuarioId] || fallbackUsers.u3;
      return `
      <div class="rounded-xl border p-3 ${r.esAceptada ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/60"}">
        <div class="flex items-start gap-2.5">
          <img src="${responder.avatar}" alt="${responder.nombre}" class="h-[30px] w-[30px] rounded-full object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-slate-800">${responder.nombre}</span>
              <span class="text-xs text-slate-400">· ${r.fecha}</span>
              ${r.esAceptada ? '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><i data-lucide="badge-check" class="h-[11px] w-[11px]"></i> Respuesta útil</span>' : ""}
            </div>
            <p class="mt-1 text-sm text-slate-600">${escapeHtml(r.contenido)}</p>
          </div>
          ${
            isAuthor && !isResolved && !r.esAceptada
              ? `<button data-action="accept-answer" data-qid="${q.id}" data-aid="${r.id}"
                  class="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600">
                  <i data-lucide="check-circle-2" class="h-[13px] w-[13px]"></i> Marcar útil
                </button>`
              : ""
          }
        </div>
      </div>`;
    })
    .join("");

  const draftValue = state.drafts[q.id] || "";

  return `
  <div class="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-sm">
    <div class="flex items-start gap-3">
      <img src="${author.avatar}" alt="${author.nombre}" class="h-[42px] w-[42px] rounded-full object-cover" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-slate-800">${author.nombre}</span>
          <span class="text-xs text-slate-400">· ${q.fecha}</span>
          ${q.destacada ? '<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600"><i data-lucide="flame" class="h-[11px] w-[11px]"></i> Destacada</span>' : ""}
          ${isResolved ? '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600"><i data-lucide="check-circle-2" class="h-[11px] w-[11px]"></i> Resuelta</span>' : ""}
        </div>

        <button data-action="toggle-expand" data-qid="${q.id}" class="mt-1 block text-left">
          <h3 class="font-display text-[17px] font-bold leading-snug text-slate-900 hover:text-indigo-700">${escapeHtml(q.titulo)}</h3>
        </button>
        <p class="mt-1.5 text-sm text-slate-600 ${expanded ? "" : "line-clamp-2"}">${escapeHtml(q.descripcion)}</p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style="background-color:${meta.color}14; color:${meta.color}">
            <i data-lucide="${meta.icon}" class="h-[13px] w-[13px]"></i> ${q.categoria}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
            <i data-lucide="message-circle" class="h-[13px] w-[13px]"></i> ${respuestasArray.length} respuestas
          </span>
          <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
            <i data-lucide="coins" class="h-[13px] w-[13px]"></i> ${q.puntos} pts en juego
          </span>
        </div>
      </div>
    </div>

    <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
      <button data-action="toggle-expand" data-qid="${q.id}" class="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
        <i data-lucide="message-circle" class="h-[14px] w-[14px]"></i> ${expanded ? "Ocultar" : "Ayudar / Responder"}
      </button>
    </div>

    ${
      expanded
        ? `
    <div class="mt-4 space-y-3 border-t border-slate-100 pt-4">
      ${respuestasArray.length === 0 ? '<p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Todavía nadie respondió esta duda. ¡Sé el primero en ayudar!</p>' : ""}
      ${answersHtml}
      ${
        !isResolved
          ? `
      <div class="flex items-start gap-2.5 pt-1">
        <img src="${currentUser().avatar}" alt="${currentUser().nombre}" class="h-[30px] w-[30px] rounded-full object-cover" />
        <div class="flex-1">
          <textarea data-draft-for="${q.id}" rows="2"
            placeholder="${isAuthor ? "Añade una aclaración a tu propia duda…" : "Comparte tu conocimiento para ayudar…"}"
            class="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">${escapeHtml(draftValue)}</textarea>
          <div class="mt-1.5 flex justify-end">
            <button data-action="submit-answer" data-qid="${q.id}"
              class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700">
              <i data-lucide="send" class="h-[13px] w-[13px]"></i> Enviar respuesta
            </button>
          </div>
        </div>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
  </div>`;
}

function renderFeed() {
  const filtered = getFilteredQuestions();
  const countLabel = `${filtered.length} ${filtered.length === 1 ? "duda encontrada" : "dudas encontradas"}`;
  document.getElementById("feed-count").textContent = countLabel;

  const list = document.getElementById("feed-list");
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p class="font-display text-base font-bold text-slate-700">Ninguna duda coincide con tu filtro</p>
        <p class="mt-1 text-sm text-slate-500">Prueba con otra categoría o cambia tu búsqueda.</p>
      </div>`;
  } else {
    list.innerHTML = filtered.map(renderQuestionCard).join("");
  }
  refreshIcons();
}

function renderRightSidebar() {
  const ranking = Object.values(fallbackUsers).sort((a, b) => b.puntos - a.puntos).slice(0, 5);
  const html = ranking
    .map(
      (u, i) => `
    <div class="flex items-center gap-2.5">
      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
      }">${i + 1}</span>
      <img src="${u.avatar}" alt="${u.nombre}" class="h-8 w-8 rounded-full object-cover" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-800">${u.nombre}</p>
        <p class="truncate text-[11px] text-slate-400">${u.expertise.join(" · ")}</p>
      </div>
      <span class="flex items-center gap-1 text-xs font-bold text-indigo-600">
        <i data-lucide="coins" class="h-3 w-3"></i> ${u.puntos}
      </span>
    </div>`
    )
    .join("");
  document.getElementById("ranking-list").innerHTML = html;
  refreshIcons();
}

function render() {
  renderUserBar();
  renderLeftSidebar();
  renderFeed();
  renderRightSidebar();
}

/* ------------------------------------------------------------------ */
/* MODAL & PUBLICAR DUDA EN SUPABASE                                 */
/* ------------------------------------------------------------------ */
function populateCategorySelect() {
  const select = document.getElementById("form-categoria");
  select.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function updateFormHint() {
  const puntos = Number(document.getElementById("form-puntos").value) || 0;
  document.getElementById("form-hint").innerHTML =
    `Al publicar se descontarán <b>${puntos} pts</b> de tu saldo actual (${currentUser().puntos} pts). ` +
    `Los recuperas si tu duda queda resuelta y decides marcar una respuesta como útil.`;
}

function openModal() {
  document.getElementById("form-titulo").value = "";
  document.getElementById("form-descripcion").value = "";
  document.getElementById("form-puntos").value = 20;
  populateCategorySelect();
  updateFormHint();
  document.getElementById("form-error").classList.add("hidden");
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
}

// GUARDA DE VERDAD EN LA BASE DE DATOS
async function submitPublish() {
  const titulo = document.getElementById("form-titulo").value.trim();
  const descripcion = document.getElementById("form-descripcion").value.trim();
  const categoria = document.getElementById("form-categoria").value;
  const puntos = Number(document.getElementById("form-puntos").value);
  const errorEl = document.getElementById("form-error");

  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  };

  if (!titulo || !descripcion) return showError("Completa el título y la descripción.");
  if (puntos < 5) return showError("Ofrece al menos 5 puntos.");
  if (puntos > currentUser().puntos) return showError(`No tienes suficiente saldo.`);

  try {
    // Insertar en tu tabla de Supabase
    const { data, error } = await supabase
      .from('questions')
      .insert([
        {
          usuarioId: CURRENT_USER_ID,
          titulo,
          descripcion,
          categoria,
          puntos,
          fecha: new Date().toISOString().slice(0, 10),
          estado: "Abierta",
          destacada: false
        }
      ]);

    if (error) throw error;

    fallbackUsers[CURRENT_USER_ID].puntos -= puntos;
    closeModal();
    
    // Recargar datos frescos de la nube
    await loadDataFromSupabase();
    
    bumpBalance();
    pushToast(`Duda publicada en la nube: -${puntos} pts`, "Sincronizado con Supabase");
  } catch (err) {
    showError("Error en base de datos: " + err.message);
  }
}

/* ------------------------------------------------------------------ */
/* ACCIONES                                                           */
/* ------------------------------------------------------------------ */
function toggleExpand(qId) {
  state.expandedId = state.expandedId === qId ? null : qId;
  renderFeed();
}

async function submitAnswer(qId) {
  const contenido = (state.drafts[qId] || "").trim();
  if (!contenido) return;

  try {
    const { error } = await supabase
      .from('respuestas')
      .insert([
        {
          question_id: qId,
          usuarioId: CURRENT_USER_ID,
          contenido,
          fecha: new Date().toISOString().slice(0, 10),
          esAceptada: false
        }
      ]);

    if (error) throw error;

    state.drafts[qId] = "";
    await loadDataFromSupabase();
    pushToast("Respuesta enviada a Supabase", "Guardada correctamente");
  } catch(err) {
    console.error("Error al responder:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* EVENTOS                                                            */
/* ------------------------------------------------------------------ */
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case "open-modal":
      openModal();
      break;
    case "close-modal":
      closeModal();
      break;
    case "submit-publish":
      submitPublish();
      break;
    case "filter-category":
      state.filters.category = target.dataset.category;
      renderLeftSidebar();
      renderFeed();
      break;
    case "filter-status":
      state.filters.status = target.dataset.status;
      renderLeftSidebar();
      renderFeed();
      break;
    case "toggle-expand":
      toggleExpand(target.dataset.qid);
      break;
    case "submit-answer":
      submitAnswer(target.dataset.qid);
      break;
  }
});

document.getElementById("search-input").addEventListener("input", (e) => {
  state.filters.search = e.target.value;
  renderFeed();
});

document.addEventListener("input", (e) => {
  if (e.target.matches("[data-draft-for]")) {
    state.drafts[e.target.dataset.draftFor] = e.target.value;
  }
  if (e.target.id === "form-puntos") {
    updateFormHint();
  }
});

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

/* ------------------------------------------------------------------ */
/* INIT                                                               */
/* ------------------------------------------------------------------ */
function init() {
  loadDataFromSupabase(); // Llama a la base de datos directo al iniciar
  refreshIcons();
}

document.addEventListener("DOMContentLoaded", init);
