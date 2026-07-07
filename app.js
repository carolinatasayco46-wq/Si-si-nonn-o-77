/* ====================================================================
   SKILLSWAP — MVP de Trueque de Conocimientos
   Vanilla JavaScript · sin frameworks · conectado a Supabase
   ==================================================================== */

/* ------------------------------------------------------------------ */
/* CONFIG / METADATA                                                  */
/* ------------------------------------------------------------------ */
// REEMPLAZA ESTAS DOS LÍNEAS CON TUS CREDENCIALES REALES DE SUPABASE:
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
const SUPABASE_KEY = "TU_API_KEY_ANON_PUBLIC";

// CORRECCIÓN AL SYNTAXERROR: Inicialización segura compartida globalmente
if (typeof window.supabaseInstance === 'undefined') {
  window.supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
// Usamos una variable global asignada directamente para que no tire error de "already been declared"
window.supabaseApp = window.supabaseInstance;

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

const avatar = (seed) => `https://i.pravatar.cc/150?img=${seed}`;

/* ------------------------------------------------------------------ */
/* ESTADO GLOBAL DE LA APLICACIÓN                                    */
/* ------------------------------------------------------------------ */
const state = {
  users: {},
  questions: [],
  filters: {
    category: "Todas",
    status: "Todas",
    search: ""
  },
  expandedId: null,
  drafts: {},
};

/* ------------------------------------------------------------------ */
/* CARGA DE DATOS DESDE SUPABASE                                     */
/* ------------------------------------------------------------------ */
async function loadData() {
  try {
    // Cargar Usuarios
    const { data: dbUsers, error: uError } = await window.supabaseApp
      .from('profiles')
      .select('*');
      
    if (!uError && dbUsers && dbUsers.length > 0) {
      state.users = {};
      dbUsers.forEach(u => {
        state.users[u.id] = u;
      });
    } else {
      // Fallback si no hay perfiles en la BD
      state.users = {
        u1: { id: "u1", nombre: "Tú", avatar: avatar(12), expertise: ["Programación", "Diseño"], puntos: 100 },
        u2: { id: "u2", nombre: "Marina Vidal", avatar: avatar(47), expertise: ["Matemáticas"], puntos: 260 },
        u3: { id: "u3", nombre: "Kenji Sato", avatar: avatar(15), expertise: ["Programación"], puntos: 340 },
        u4: { id: "u4", nombre: "Lucía Fernández", avatar: avatar(32), expertise: ["Idiomas"], puntos: 190 },
      };
    }

    // Cargar Preguntas con sus Respuestas
    const { data: dbQuestions, error: qError } = await window.supabaseApp
      .from('questions')
      .select('*, answers(*)');

    if (!qError && dbQuestions) {
      state.questions = dbQuestions.map(q => ({
        id: q.id,
        usuarioId: q.usuario_id || q.usuarioId || "u2",
        titulo: q.titulo,
        descripcion: q.descripcion,
        categoria: q.categoria,
        puntos: q.puntos,
        fecha: q.fecha || new Date().toISOString().split('T')[0],
        estado: q.estado || "Abierta",
        destacada: q.destacada || false,
        respuestas: (q.answers || []).map(a => ({
          id: a.id,
          usuarioId: a.usuario_id || a.usuarioId,
          texto: a.texto,
          fecha: a.fecha || new Date().toISOString().split('T')[0],
          util: a.util || false
        }))
      }));
    }
    
    render();
  } catch (err) {
    console.error("Error cargando datos de Supabase:", err);
  }
}

/* ------------------------------------------------------------------ */
/* HELPERS / UTILS                                                   */
/* ------------------------------------------------------------------ */
function currentUser() {
  return state.users[CURRENT_USER_ID];
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
      return q.titulo.toLowerCase().includes(s) || q.descripcion.toLowerCase().includes(s);
    });
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function pushToast(message, sub) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast-card";
  el.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="coins" class="h-4 w-4 text-emerald-500"></i>
    </div>
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
/* RENDERS                                                            */
/* ------------------------------------------------------------------ */
function renderUserBar() {
  const u = currentUser();
  if (!u) return;
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
      </button>
    `;
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
    </button>
  `;
  catHtml += CATEGORIES.map((cat) => {
    const meta = CATEGORY_META[cat];
    const active = state.filters.category === cat;
    return `
      <button data-action="filter-category" data-category="${cat}"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
        }">
        <i data-lucide="${meta.icon}" class="h-4 w-4" style="color: ${meta.color}"></i>
        ${cat}
      </button>
    `;
  }).join("");
  document.getElementById("category-filters").innerHTML = catHtml;

  refreshIcons();
}

function renderQuestionCard(q) {
  const author = state.users[q.usuarioId] || { nombre: "Usuario", avatar: avatar(9) };
  const meta = CATEGORY_META[q.categoria] || { icon: "help-circle", color: "#64748B" };
  const expanded = state.expandedId === q.id;

  let cardHtml = `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200">
      <div class="flex items-start gap-3">
        <img src="${author.avatar}" class="h-[42px] w-[42px] rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-semibold text-slate-800">${author.nombre}</span>
            <span class="text-xs text-slate-400">· ${q.fecha}</span>
            ${q.destacada ? '<span class="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">Destacada ★</span>' : ""}
          </div>
          <button data-action="toggle-expand" data-qid="${q.id}" class="mt-1 block text-left">
            <h3 class="font-display text-[17px] font-bold text-slate-900 hover:text-indigo-700">${escapeHtml(q.titulo)}</h3>
          </button>
          <p class="mt-1.5 text-sm text-slate-600 ${expanded ? "" : "line-clamp-2"}">${escapeHtml(q.descripcion)}</p>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              <i data-lucide="${meta.icon}" class="h-3 w-3"></i> ${q.categoria}
            </span>
            <span class="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
              ${q.estado}
            </span>
            <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-indigo-100">
              <i data-lucide="coins" class="h-3 w-3"></i> ${q.puntos} pts
            </span>
          </div>
        </div>
      </div>
  `;

  if (expanded) {
    cardHtml += `
      <div class="mt-5 space-y-4 border-t border-slate-100 pt-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">Respuestas (${q.respuestas.length})</h4>
        <div class="space-y-3">
    `;

    if (q.respuestas.length === 0) {
      cardHtml += `<p class="text-xs italic text-slate-400">Nadie ha respondido aún. ¡Sé el primero!</p>`;
    } else {
      q.respuestas.forEach((ans) => {
        const ansAuthor = state.users[ans.usuarioId] || { nombre: "Experto", avatar: avatar(5) };
        const isQuestionOwner = q.usuarioId === CURRENT_USER_ID;
        
        cardHtml += `
          <div class="rounded-xl border ${ans.util ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-slate-50/50"} p-3.5">
            <div class="flex items-center gap-2">
              <img src="${ansAuthor.avatar}" class="h-6 w-6 rounded-full object-cover" />
              <span class="text-xs font-semibold text-slate-700">${ansAuthor.nombre}</span>
              <span class="text-[11px] text-slate-400">${ans.fecha}</span>
              ${ans.util ? '<span class="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><i data-lucide="check-circle-2" class="h-3.5 w-3.5"></i> Solución útil</span>' : ""}
            </div>
            <p class="mt-2 text-sm text-slate-700">${escapeHtml(ans.texto)}</p>
            
            ${!ans.util && isQuestionOwner && q.estado === "Abierta" ? `
              <div class="mt-3 flex justify-end">
                <button data-action="accept-answer" data-qid="${q.id}" data-aid="${ans.id}"
                  class="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition">
                  <i data-lucide="check" class="h-3 w-3"></i> Marcar como útil (+${q.puntos} pts)
                </button>
              </div>
            ` : ""}
          </div>
        `;
      });
    }

    if (q.estado === "Abierta") {
      const currentDraft = state.drafts[q.id] || "";
      cardHtml += `
        </div>
        <div class="mt-4 pt-2">
          <label class="sr-only">Tu respuesta</label>
          <textarea data-draft-for="${q.id}" rows="3" placeholder="Escribe tu conocimiento aquí para ayudar..."
            class="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">${escapeHtml(currentDraft)}</textarea>
          <div class="mt-2 flex justify-end gap-2">
            <button data-action="simulate-answer" data-qid="${q.id}" class="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100">Simular IA</button>
            <button data-action="submit-answer" data-qid="${q.id}" class="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition">Enviar respuesta</button>
          </div>
        </div>
      `;
    } else {
      cardHtml += `</div></div>`;
    }
    cardHtml += `</div>`;
  } else {
    cardHtml += `
      <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
        <span class="flex items-center gap-1"><i data-lucide="message-square" class="h-3.5 w-3.5"></i> ${q.respuestas.length} respuestas</span>
        <button data-action="toggle-expand" data-qid="${q.id}" class="ml-auto rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
          ${q.usuarioId === CURRENT_USER_ID ? "Ver respuestas" : "Responder / Ayudar"}
        </button>
      </div>
    `;
  }

  cardHtml += `</div>`;
  return cardHtml;
}

function renderFeed() {
  const filtered = getFilteredQuestions();
  document.getElementById("feed-count").textContent = `${filtered.length} dudas encontradas`;

  const list = document.getElementById("feed-list");
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p class="font-bold text-slate-700">No se encontraron dudas</p>
        <p class="text-sm text-slate-400 mt-1">Prueba cambiando los filtros o publica una nueva.</p>
      </div>
    `;
  } else {
    list.innerHTML = filtered.map(renderQuestionCard).join("");
  }
  refreshIcons();
}

function renderRightSidebar() {
  const ranking = Object.values(state.users)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 5);

  const html = ranking
    .map((u, i) => `
    <div class="flex items-center gap-2.5">
      <span class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        i === 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
      }">${i + 1}</span>
      <img src="${u.avatar}" class="h-8 w-8 rounded-full object-cover" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-800">${u.nombre}</p>
      </div>
      <span class="text-xs font-bold text-indigo-600">${u.puntos} pts</span>
    </div>
  `)
    .join("");
  document.getElementById("ranking-list").innerHTML = html;
}

function render() {
  renderUserBar();
  renderLeftSidebar();
  renderFeed();
  renderRightSidebar();
}

/* ------------------------------------------------------------------ */
/* ACCIONES / LOGICA                                                 */
/* ------------------------------------------------------------------ */
function populateCategorySelect() {
  const select = document.getElementById("form-categoria");
  select.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function updateFormHint() {
  const puntos = document.getElementById("form-puntos").value;
  document.getElementById("form-hint").innerHTML = `Al publicar se resguardarán <b>${puntos} puntos</b> de tu cuenta hasta que valides una solución.`;
}

function openModal() {
  populateCategorySelect();
  updateFormHint();
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("modal-overlay").classList.add("flex");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.getElementById("modal-overlay").classList.remove("flex");
  document.getElementById("form-titulo").value = "";
  document.getElementById("form-descripcion").value = "";
  document.getElementById("form-error").classList.add("hidden");
}

async function submitPublish() {
  const t = document.getElementById("form-titulo").value.trim();
  const d = document.getElementById("form-descripcion").value.trim();
  const c = document.getElementById("form-categoria").value;
  const p = parseInt(document.getElementById("form-puntos").value, 10);

  if (!t || !d) {
    const err = document.getElementById("form-error");
    err.textContent = "Por favor completa el título y la descripción.";
    err.classList.remove("hidden");
    return;
  }

  const u = currentUser();
  if (u.puntos < p) {
    const err = document.getElementById("form-error");
    err.textContent = `No tienes suficientes puntos. Saldo actual: ${u.puntos} pts.`;
    err.classList.remove("hidden");
    return;
  }

  try {
    // Insertar en la BD de Supabase
    const { error } = await window.supabaseApp
      .from('questions')
      .insert([
        { 
          usuario_id: CURRENT_USER_ID, 
          titulo: t, 
          descripcion: d, 
          categoria: c, 
          puntos: p,
          estado: "Abierta",
          destacada: p >= 50
        }
      ]);

    if (error) throw error;

    // Actualizar perfil local del usuario restándole los puntos
    u.puntos -= p;
    await window.supabaseApp.from('profiles').update({ puntos: u.puntos }).eq('id', CURRENT_USER_ID);

    closeModal();
    pushToast("Duda publicada con éxito", `Se resguardaron ${p} pts.`);
    bumpBalance();
    loadData();
  } catch(err) {
    console.error(err);
  }
}

function toggleExpand(qId) {
  state.expandedId = state.expandedId === qId ? null : qId;
  renderFeed();
}

async function submitAnswer(qId) {
  const text = state.drafts[qId] || "";
  if (!text.trim()) return;

  try {
    const { error } = await window.supabaseApp
      .from('answers')
      .insert([
        { question_id: qId, usuario_id: CURRENT_USER_ID, texto: text.trim(), util: false }
      ]);

    if (error) throw error;

    delete state.drafts[qId];
    pushToast("Respuesta enviada", "¡Gracias por colaborar!");
    loadData();
  } catch(err) {
    console.error(err);
  }
}

function simulateAnswer(qId) {
  const respuestasSimuladas = [
    "Eso se puede solucionar utilizando flexbox con `justify-content: space-between` o aplicando CSS Grid dependendiendo de la estructura.",
    "Recomiendo añadir índices compuestos en la base de datos sobre las columnas de los JOIN, acelerará el rendimiento radicalmente.",
    "Prueba aislando el entorno de desarrollo y limpiando la caché del framework, a veces guarda referencias viejas.",
  ];
  const rand = respuestasSimuladas[Math.floor(Math.random() * respuestasSimuladas.length)];
  state.drafts[qId] = rand;
  renderFeed();
}

async function acceptAnswer(qId, aId) {
  const q = state.questions.find((x) => x.id == qId);
  if (!q) return;

  const ans = q.respuestas.find((x) => x.id == aId);
  if (!ans) return;

  try {
    // 1. Marcar la respuesta elegida como útil
    await window.supabaseApp.from('answers').update({ util: true }).eq('id', aId);
    
    // 2. Cerrar la pregunta original
    await window.supabaseApp.from('questions').update({ estado: "Resuelta" }).eq('id', qId);

    // 3. Recompensar al autor de la respuesta útil en los perfiles de la BD
    if (state.users[ans.usuarioId]) {
      state.users[ans.usuarioId].puntos += q.puntos;
      await window.supabaseApp.from('profiles').update({ puntos: state.users[ans.usuarioId].puntos }).eq('id', ans.usuarioId);
    }

    pushToast("¡Trueque cerrado con éxito!", `Puntos liberados para el experto.`);
    loadData();
  } catch (err) {
    console.error(err);
  }
}

/* ------------------------------------------------------------------ */
/* EVENT LISTENERS                                                    */
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
    case "simulate-answer":
      simulateAnswer(target.dataset.qid);
      break;
    case "accept-answer":
      acceptAnswer(target.dataset.qid, target.dataset.aid);
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
  loadData();
}

document.addEventListener("DOMContentLoaded", init);
