/* ====================================================================
   SKILLSWAP — MVP de Trueque de Conocimientos
   Conectado con la Base de Datos Real de Supabase
   ==================================================================== */

/* ------------------------------------------------------------------ */
/* CONFIG / METADATA & SUPABASE                                       */
/* ------------------------------------------------------------------ */
// 1. REEMPLAZA ESTAS DOS LÍNEAS CON TUS CREDENCIALES REALES DE SUPABASE:
const SUPABASE_URL = "https://TU_ID_DE_PROYECTO.supabase.co"; 
const SUPABASE_KEY = "TU_API_KEY_PUBLISHABLE_DE_LA_CAPTURA";

// 2. CORRECCIÓN DEFINITIVA: Evita declarar 'const supabase' para que no choque con el navegador
if (typeof window.supabaseClient === 'undefined') {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
// Asignamos la referencia sin usar const/let que cause SyntaxError
var supabase = window.supabaseClient;

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
/* ESTADO GLOBAL (Filtros y UI)                                       */
/* ------------------------------------------------------------------ */
const state = {
  users: {}, 
  questions: [], 
  filters: { category: "Todas", status: "Todas", search: "" },
  expandedId: null,
  drafts: {},
  modalOpen: false,
};

// Usuarios simulados para la visualización estética del diseño
const fallbackUsers = {
  u1: { id: "u1", nombre: "Tú", avatar: "https://i.pravatar.cc/150?img=12", expertise: ["Programación", "Diseño"], puntos: 100 },
  u2: { id: "u2", nombre: "Marina Vidal", avatar: "https://i.pravatar.cc/150?img=47", expertise: ["Matemáticas"], puntos: 260 },
  u3: { id: "u3", nombre: "Kenji Sato", avatar: "https://i.pravatar.cc/150?img=15", expertise: ["Programación"], puntos: 340 },
  u4: { id: "u4", nombre: "Lucía Fernández", avatar: "https://i.pravatar.cc/150?img=32", expertise: ["Idiomas"], puntos: 190 },
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */
function currentUser() {
  return state.users[CURRENT_USER_ID] || fallbackUsers[CURRENT_USER_ID];
}

function escapeHtml(str) {
  if (!str) return "";
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
      return (q.titulo && q.titulo.toLowerCase().includes(s)) || (q.descripcion && q.descripcion.toLowerCase().includes(s));
    });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

/* ------------------------------------------------------------------ */
/* FEEDBACK VISUAL                                                    */
/* ------------------------------------------------------------------ */
function pushToast(message, sub) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast-card";
  el.innerHTML = `
    <div class="toast-icon"><i data-lucide="coins" class="h-4 w-4 text-emerald-500"></i></div>
    <div>
      <p class="text-sm font-semibold text-slate-900">${escapeHtml(message)}</p>
      ${sub ? `<p class="text-xs text-slate-500">${escapeHtml(sub)}</p>` : ""}
    </div>`;
  container.appendChild(el);
  refreshIcons();
  setTimeout(() => el.remove(), 2600);
}

function bumpBalance() {
  const badge = document.getElementById("balance-badge");
  if (!badge) return;
  badge.classList.add("balance-pulse");
  setTimeout(() => badge.classList.remove("balance-pulse"), 350);
}

/* ------------------------------------------------------------------ */
/* CONEXIÓN CON SUPABASE (CARGA)                                      */
/* ------------------------------------------------------------------ */
async function loadDataFromSupabase() {
  try {
    let { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      console.error("Error al leer Supabase:", error.message);
      return;
    }

    // Adaptación inteligente tolerante a columnas en minúsculas o mayúsculas
    state.questions = (questions || []).map(q => ({
      id: q.id,
      usuarioId: q.usuarioId || q.usuarioid || "u2",
      titulo: q.titulo || "Sin título",
      descripcion: q.descripcion || "",
      categoria: q.categoria || "Programación",
      puntos: Number(q.puntos) || 0,
      fecha: q.fecha || new Date().toISOString().slice(0, 10),
      estado: q.estado || "Abierta",
      destacada: q.destacada === true,
      respuestas: []
    }));

    state.users = fallbackUsers;
    render();
  } catch (err) {
    console.error("Error crítico de inicialización:", err);
  }
}

/* ------------------------------------------------------------------ */
/* RENDERS DE LA INTERFAZ                                             */
/* ------------------------------------------------------------------ */
function renderUserBar() {
  const u = currentUser();
  const avatarEl = document.getElementById("current-user-avatar");
  const nameEl = document.getElementById("current-user-name");
  const valEl = document.getElementById("balance-value");
  
  if (avatarEl) { avatarEl.src = u.avatar; avatarEl.alt = u.nombre; }
  if (nameEl) nameEl.textContent = u.nombre;
  if (valEl) valEl.textContent = u.puntos;
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
  
  const statusContainer = document.getElementById("status-filters");
  if (statusContainer) statusContainer.innerHTML = statusHtml;

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
  
  const categoryContainer = document.getElementById("category-filters");
  if (categoryContainer) categoryContainer.innerHTML = catHtml;

  refreshIcons();
}

function renderQuestionCard(q) {
  const author = state.users[q.usuarioId] || fallbackUsers.u2;
  const meta = CATEGORY_META[q.categoria] || { icon: "help-circle", color: "#64748B" };
  const expanded = state.expandedId === q.id;

  return `
  <div class="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 shadow-sm">
    <div class="flex items-start gap-3">
      <img src="${author.avatar}" class="h-[42px] w-[42px] rounded-full object-cover" />
      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-slate-800">${author.nombre}</span> <span class="text-xs text-slate-400">· ${q.fecha}</span>
        <button data-action="toggle-expand" data-qid="${q.id}" class="mt-1 block text-left">
          <h3 class="font-display text-[17px] font-bold text-slate-900 hover:text-indigo-700">${escapeHtml(q.titulo)}</h3>
        </button>
        <p class="mt-1.5 text-sm text-slate-600 ${expanded ? "" : "line-clamp-2"}">${escapeHtml(q.descripcion)}</p>
        <div class="mt-3 flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style="background-color:${meta.color}14; color:${meta.color}"><i data-lucide="${meta.icon}" class="h-3 w-3"></i> ${q.categoria}</span>
          <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white"><i data-lucide="coins" class="h-3 w-3"></i> ${q.puntos} pts</span>
        </div>
      </div>
    </div>
    <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
      <button data-action="toggle-expand" data-qid="${q.id}" class="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition">${expanded ? "Ocultar" : "Responder / Ayudar"}</button>
    </div>
  </div>`;
}

function renderFeed() {
  const filtered = getFilteredQuestions();
  const countEl = document.getElementById("feed-count");
  if (countEl) countEl.textContent = `${filtered.length} dudas encontradas`;

  const list = document.getElementById("feed-list");
  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p class="font-bold text-slate-700">Sin dudas registradas en tus filtros o base de datos</p>
      </div>`;
  } else {
    list.innerHTML = filtered.map(renderQuestionCard).join("");
  }
  refreshIcons();
}

function renderRightSidebar() {
  const ranking = Object.values(fallbackUsers).sort((a, b) => b.puntos - a.puntos).slice(0, 5);
  const html = ranking.map((u, i) => `
    <div class="flex items-center gap-2.5">
      <span class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold bg-slate-100">${i + 1}</span>
      <img src="${u.avatar}" class="h-8 w-8 rounded-full object-cover" />
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-slate-800">${u.nombre}</p></div>
      <span class="text-xs font-bold text-indigo-600">${u.puntos} pts</span>
    </div>`).join("");
    
  const rankList = document.getElementById("ranking-list");
  if (rankList) rankList.innerHTML = html;
  refreshIcons();
}

function render() {
  renderUserBar();
  renderLeftSidebar();
  renderFeed();
  renderRightSidebar();
}

/* ------------------------------------------------------------------ */
/* MODAL & GUARDADO EN SUPABASE                                       */
/* ------------------------------------------------------------------ */
function populateCategorySelect() {
  const select = document.getElementById("form-categoria");
  if (select) select.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function updateFormHint() {
  const puntosEl = document.getElementById("form-puntos");
  const hintEl = document.getElementById("form-hint");
  if (!puntosEl || !hintEl) return;
  hintEl.innerHTML = `Al publicar se descontarán <b>${puntosEl.value} pts</b> de tu saldo temporal en la nube.`;
}

function openModal() {
  populateCategorySelect();
  updateFormHint();
  const overlay = document.getElementById("modal-overlay");
  if (overlay) { overlay.classList.remove("hidden"); overlay.classList.add("flex"); }
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay) { overlay.classList.add("hidden"); overlay.classList.remove("flex"); }
}

async function submitPublish() {
  const titulo = document.getElementById("form-titulo").value.trim();
  const descripcion = document.getElementById("form-descripcion").value.trim();
  const categoria = document.getElementById("form-categoria").value;
  const puntos = Number(document.getElementById("form-puntos").value);
  const errorEl = document.getElementById("form-error");

  if (!titulo || !descripcion) {
    if (errorEl) { errorEl.textContent = "Completa todos los campos obligatorios."; errorEl.classList.remove("hidden"); }
    return;
  }

  try {
    const { error } = await supabase
      .from('questions')
      .insert([{
        usuarioId: CURRENT_USER_ID,
        usuarioid: CURRENT_USER_ID,
        titulo, descripcion, categoria, puntos,
        fecha: new Date().toISOString().slice(0, 10),
        estado: "Abierta", destacada: false
      }]);

    if (error) throw error;
    closeModal();
    await loadDataFromSupabase();
    bumpBalance();
    pushToast("Publicado con éxito en Supabase");
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove("hidden"); }
  }
}

function toggleExpand(qId) {
  state.expandedId = state.expandedId === qId ? null : qId;
  renderFeed();
}

/* ------------------------------------------------------------------ */
/* EVENT LISTENERS                                                    */
/* ------------------------------------------------------------------ */
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-modal") openModal();
  if (action === "close-modal") closeModal();
  if (action === "submit-publish") submitPublish();
  if (action === "toggle-expand") toggleExpand(target.dataset.qid);
  if (action === "filter-category") { state.filters.category = target.dataset.category; renderLeftSidebar(); renderFeed(); }
  if (action === "filter-status") { state.filters.status = target.dataset.status; renderLeftSidebar(); renderFeed(); }
});

const searchInp = document.getElementById("search-input");
if (searchInp) {
  searchInp.addEventListener("input", (e) => { state.filters.search = e.target.value; renderFeed(); });
}

document.addEventListener("input", (e) => {
  if (e.target.id === "form-puntos") updateFormHint();
});

function init() {
  loadDataFromSupabase();
}
document.addEventListener("DOMContentLoaded", init);
