/* ====================================================================
   SKILLSWAP — MVP de Trueque de Conocimientos (Conectado a Esquema Relacional)
   ==================================================================== */

// IMPORTANTE: Pon aquí los datos reales de tu proyecto de Supabase
const SUPABASE_URL = "https://TU_PROYECTO_ID.supabase.co";
const SUPABASE_KEY = "TU_ANON_PUBLIC_KEY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CURRENT_USER_ID = "u1";

/* ------------------------------------------------------------------ */
/* ESTADO GLOBAL EN LA UI                                             */
/* ------------------------------------------------------------------ */
const state = {
  currentUser: null,
  categories: [],   // Cargado dinámicamente desde el catálogo de la BD
  ranking: [],      // Mapeado directo de vista_ranking_expertos
  questions: [],    // Mapeado directo de vista_feed con sub-respuestas unidas
  filters: { category: "Todas", status: "Todas", search: "" },
  expandedId: null,
  drafts: {},
};

/* ------------------------------------------------------------------ */
/* RECOPILACIÓN DE DATOS DESDE LAS VISTAS Y TABLAS DE POSTGRES       */
/* ------------------------------------------------------------------ */
async function fetchGlobalData() {
  try {
    // 1. Catálogo fijo de categorías
    const { data: cats } = await supabase.from("categorias").select("*");
    state.categories = cats || [];

    // 2. Información del usuario actual
    const { data: current } = await supabase.from("usuarios").select("*").eq("id", CURRENT_USER_ID).single();
    if (current) state.currentUser = current;

    // 3. Obtener el ranking de expertos desde la vista de Postgres
    const { data: rank } = await supabase.from("vista_ranking_expertos").select("*").limit(5);
    state.ranking = rank || [];

    // 4. Obtener las publicaciones desde vista_feed integrando el arreglo nativo de respuestas asociadas
    const { data: feed, error: fError } = await supabase
      .from("vista_feed")
      .select(`
        *,
        respuestas (
          id,
          usuario_id,
          contenido,
          es_aceptada,
          fecha_creacion
        )
      `);
    
    if (fError) throw fError;
    state.questions = feed || [];

  } catch (err) {
    console.error("Error consultando la base de datos:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return "";
  return isoString.split("T")[0];
}

function getFilteredQuestions() {
  const { category, status, search } = state.filters;
  return state.questions
    .filter((q) => (category === "Todas" ? true : q.categoria_nombre === category))
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
/* NOTIFICACIONES TOASTS                                             */
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
    </div>
  `;
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
/* RENDERS CORE                                                       */
/* ------------------------------------------------------------------ */
function renderUserBar() {
  const u = state.currentUser;
  if (!u) return;
  document.getElementById("current-user-avatar").src = u.avatar_url || "https://i.pravatar.cc/150";
  document.getElementById("current-user-avatar").alt = u.nombre;
  document.getElementById("current-user-name").textContent = u.nombre;
  document.getElementById("balance-value").textContent = u.saldo_puntos;
}

function renderLeftSidebar() {
  const statuses = [
    { key: "Todas", label: "Todas" },
    { key: "Abierta", label: "Abiertas" },
    { key: "Destacada", label: "Destacadas" },
    { key: "Resuelta", label: "Resueltas" },
  ];

  document.getElementById("status-filters").innerHTML = statuses
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
    }).join("");

  const allActive = state.filters.category === "Todas";
  let catHtml = `
    <button data-action="filter-category" data-category="Todas"
      class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        allActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
      }">
      <i data-lucide="sparkles" class="h-[15px] w-[15px]"></i> Todas
    </button>`;

  catHtml += state.categories.map((cat) => {
    const active = state.filters.category === cat.nombre;
    return `
      <button data-action="filter-category" data-category="${cat.nombre}"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
        }">
        <i data-lucide="${cat.icono}" class="h-4 w-4" style="color:${cat.color}"></i> ${cat.nombre}
      </button>`;
  }).join("");
  document.getElementById("category-filters").innerHTML = catHtml;
  refreshIcons();
}

function renderQuestionCard(q) {
  const isAuthor = q.autor_id === CURRENT_USER_ID;
  const isResolved = q.estado === "Resuelta";
  const expanded = state.expandedId === q.id;

  const respuestasArray = q.respuestas || [];

  const answersHtml = respuestasArray
    .map((r) => {
      // Cruzar el autor de la respuesta con la lista global o un fallback rápido
      const internalUser = state.ranking.find(x => x.id === r.usuario_id) || {};
      const responderNombre = r.usuario_id === CURRENT_USER_ID ? "Tú" : (internalUser.nombre || "Colaborador");
      const responderAvatar = internalUser.avatar_url || "https://i.pravatar.cc/150?img=33";

      return `
      <div class="rounded-xl border p-3 ${r.es_aceptada ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/60"}">
        <div class="flex items-start gap-2.5">
          <img src="${responderAvatar}" alt="${responderNombre}" class="h-[30px] w-[30px] rounded-full object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-slate-800">${responderNombre}</span>
              <span class="text-xs text-slate-400">· ${formatDate(r.fecha_creacion)}</span>
              ${r.es_aceptada ? '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><i data-lucide="badge-check" class="h-[11px] w-[11px]"></i> Respuesta útil</span>' : ""}
            </div>
            <p class="mt-1 text-sm text-slate-600">${escapeHtml(r.contenido)}</p>
          </div>
          ${
            isAuthor && !isResolved && !r.es_aceptada
              ? `<button data-action="accept-answer" data-qid="${q.id}" data-aid="${r.id}"
                  class="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600">
                  <i data-lucide="check-circle-2" class="h-[13px] w-[13px]"></i> Marcar útil
                </button>`
              : ""
          }
        </div>
      </div>`;
    }).join("");

  const draftValue = state.drafts[q.id] || "";

  return `
  <div class="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-sm">
    <div class="flex items-start gap-3">
      <img src="${q.autor_avatar || 'https://i.pravatar.cc/150'}" alt="${q.autor_nombre}" class="h-[42px] w-[42px] rounded-full object-cover" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-slate-800">${q.autor_nombre}</span>
          <span class="text-xs text-slate-400">· ${formatDate(q.fecha_creacion)}</span>
          ${q.destacada ? '<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600"><i data-lucide="flame" class="h-[11px] w-[11px]"></i> Destacada</span>' : ""}
          ${isResolved ? '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600"><i data-lucide="check-circle-2" class="h-[11px] w-[11px]"></i> Resuelta</span>' : ""}
        </div>

        <button data-action="toggle-expand" data-qid="${q.id}" class="mt-1 block text-left">
          <h3 class="font-display text-[17px] font-bold leading-snug text-slate-900 hover:text-indigo-700">${escapeHtml(q.titulo)}</h3>
        </button>
        <p class="mt-1.5 text-sm text-slate-600 ${expanded ? "" : "line-clamp-2"}">${escapeHtml(q.descripcion)}</p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style="background-color:${q.categoria_color}14; color:${q.categoria_color}">
            <i data-lucide="${q.categoria_icono}" class="h-[13px] w-[13px]"></i> ${q.categoria_nombre}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
            <i data-lucide="message-circle" class="h-[13px] w-[13px]"></i> ${q.total_respuestas || 0} respuestas
          </span>
          <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
            <i data-lucide="coins" class="h-[13px] w-[13px]"></i> ${q.puntos_ofrecidos} pts
          </span>
        </div>
      </div>
    </div>

    <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
      <button data-action="toggle-expand" data-qid="${q.id}" class="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
        <i data-lucide="message-circle" class="h-[14px] w-[14px]"></i> ${expanded ? "Ocultar" : "Ayudar / Responder"}
      </button>
    </div>

    ${expanded ? `
    <div class="mt-4 space-y-3 border-t border-slate-100 pt-4">
      ${respuestasArray.length === 0 ? '<p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Nadie ha respondido aún. ¡Comparte tu conocimiento!</p>' : ""}
      ${answersHtml}
      ${!isResolved ? `
      <div class="flex items-start gap-2.5 pt-1">
        <img src="${state.currentUser.avatar_url || 'https://i.pravatar.cc/150'}" alt="${state.currentUser.nombre}" class="h-[30px] w-[30px] rounded-full object-cover" />
        <div class="flex-1">
          <textarea data-draft-for="${q.id}" rows="2"
            placeholder="${isAuthor ? "Añade una aclaración a tu duda…" : "Escribe tu respuesta constructiva…"}"
            class="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">${escapeHtml(draftValue)}</textarea>
          <div class="mt-1.5 flex justify-end">
            <button data-action="submit-answer" data-qid="${q.id}"
              class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700">
              <i data-lucide="send" class="h-[13px] w-[13px]"></i> Responder
            </button>
          </div>
        </div>
      </div>` : ""}
    </div>` : ""}
  </div>`;
}

function renderFeed() {
  const filtered = getFilteredQuestions();
  document.getElementById("feed-count").textContent = `${filtered.length} ${filtered.length === 1 ? "duda encontrada" : "dudas encontradas"}`;

  const list = document.getElementById("feed-list");
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p class="font-display text-base font-bold text-slate-700">Ninguna duda por aquí</p>
        <p class="mt-1 text-sm text-slate-500">Prueba cambiando los filtros o categorías.</p>
      </div>`;
  } else {
    list.innerHTML = filtered.map(renderQuestionCard).join("");
  }
  refreshIcons();
}

function renderRightSidebar() {
  document.getElementById("ranking-list").innerHTML = state.ranking
    .map((u, i) => `
    <div class="flex items-center gap-2.5">
      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
      }">${i + 1}</span>
      <img src="${u.avatar_url || 'https://i.pravatar.cc/150'}" alt="${u.nombre}" class="h-8 w-8 rounded-full object-cover" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-800">${u.nombre}</p>
        <p class="truncate text-[11px] text-slate-400">Miembro Activo</p>
      </div>
      <span class="flex items-center gap-1 text-xs font-bold text-indigo-600">
        <i data-lucide="coins" class="h-3 w-3"></i> ${u.saldo_puntos}
      </span>
    </div>`
    ).join("");
  refreshIcons();
}

function renderAll() {
  renderUserBar();
  renderLeftSidebar();
  renderFeed();
  renderRightSidebar();
}

/* ------------------------------------------------------------------ */
/* FORMULARIOS Y COMPORTAMIENTO DE MODALES                           */
/* ------------------------------------------------------------------ */
function populateCategorySelect() {
  const select = document.getElementById("form-categoria");
  select.innerHTML = state.categories.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");
}

function updateFormHint() {
  if (!state.currentUser) return;
  const puntos = Number(document.getElementById("form-puntos").value) || 0;
  document.getElementById("form-hint").innerHTML =
    `Esta acción comprometerá <b>${puntos} pts</b> de tu cuenta (Saldo: ${state.currentUser.saldo_puntos} pts).`;
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
  document.getElementById("modal-overlay").classList.add("hidden");
}

/* ------------------------------------------------------------------ */
/* MUTACIONES DIRECTAS (DELEGANDO LA TRANSACCIÓN AL MOTOR SQL)        */
/* ------------------------------------------------------------------ */
async function submitPublish() {
  const titulo = document.getElementById("form-titulo").value.trim();
  const descripcion = document.getElementById("form-descripcion").value.trim();
  const categoriaId = Number(document.getElementById("form-categoria").value);
  const puntosOfrecidos = Number(document.getElementById("form-puntos").value);
  const errorEl = document.getElementById("form-error");

  if (!titulo || !descripcion) {
    errorEl.textContent = "Por favor, rellena el título y la descripción.";
    errorEl.classList.remove("hidden");
    return;
  }

  // Nota: El trigger 'trg_publicacion_before_insert' validará en Postgres si el saldo_puntos es suficiente.
  const { data, error } = await supabase.from("publicaciones").insert([
    {
      usuario_id: CURRENT_USER_ID,
      titulo,
      descripcion,
      categoria_id: categoriaId,
      puntos_ofrecidos: puntosOfrecidos,
    },
  ]).select();

  if (error) {
    // Si el trigger arroja un RAISE EXCEPTION, se captura limpiamente aquí:
    errorEl.textContent = error.message;
    errorEl.classList.remove("hidden");
    return;
  }

  if (data && data.length > 0) state.expandedId = data[0].id;

  closeModal();
  await fetchGlobalData();
  renderAll();
  bumpBalance();
  pushToast(`Publicado con éxito`, `-${puntosOfrecidos} pts transferidos a custodia`);
}

async function submitAnswer(qId) {
  const contenido = (state.drafts[qId] || "").trim();
  if (!contenido) return;

  const { error } = await supabase.from("respuestas").insert([
    {
      publicacion_id: qId,
      usuario_id: CURRENT_USER_ID,
      contenido,
    },
  ]);

  if (!error) {
    state.drafts[qId] = "";
    await fetchGlobalData();
    renderFeed();
    pushToast("Respuesta guardada");
  }
}

async function acceptAnswer(qId, aId) {
  // El trigger 'trg_respuesta_after_update' se encargará automáticamente de:
  // 1. Modificar la publicación a 'Resuelta'
  // 2. Sumar los puntos_ofrecidos al autor de la respuesta
  // 3. Registrar el log de auditoría en transacciones_puntos
  const { error } = await supabase
    .from("respuestas")
    .update({ es_aceptada: true })
    .eq("id", aId);

  if (!error) {
    await fetchGlobalData();
    renderAll();
    bumpBalance();
    pushToast("Solución aceptada", "Los puntos fueron liberados al experto");
  }
}

/* ------------------------------------------------------------------ */
/* MANEJO DE EVENTOS                                                  */
/* ------------------------------------------------------------------ */
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-modal") openModal();
  if (action === "close-modal") closeModal();
  if (action === "submit-publish") await submitPublish();
  if (action === "submit-answer") await submitAnswer(target.dataset.qid);
  if (action === "accept-answer") await acceptAnswer(target.dataset.qid, target.dataset.aid);
  
  if (action === "filter-category") {
    state.filters.category = target.dataset.category;
    renderLeftSidebar(); renderFeed();
  }
  if (action === "filter-status") {
    state.filters.status = target.dataset.status;
    renderLeftSidebar(); renderFeed();
  }
  if (action === "toggle-expand") {
    state.expandedId = state.expandedId === target.dataset.qid ? null : target.dataset.qid;
    renderFeed();
  }
});

document.getElementById("search-input").addEventListener("input", (e) => {
  state.filters.search = e.target.value;
  renderFeed();
});

document.addEventListener("input", (e) => {
  if (e.target.matches("[data-draft-for]")) state.drafts[e.target.dataset.draftFor] = e.target.value;
  if (e.target.id === "form-puntos") updateFormHint();
});

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

// Inicializar cargando el catálogo relacional completo
document.addEventListener("DOMContentLoaded", async () => {
  await fetchGlobalData();
  renderAll();
});