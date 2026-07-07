// ====================================================================
// SKILLSWAP — MVP de Trueque de Conocimientos (PRODUCCIÓN VERCEL)
// ====================================================================

(function() {
  // Vercel inyecta las variables en process.env, si usas un empaquetador. 
  // Si usas JS Vanilla puro en HTML, Vercel requiere que las leamos del entorno o usar placeholders alternativos.
  // Para evitar que falle en el cliente, leemos de las variables del sistema o de la ventana:
  const SUPABASE_URL = window.ENV_SUPABASE_URL || "https://carolinatasayco46-wq.supabase.co"; 
  const SUPABASE_KEY = window.ENV_SUPABASE_KEY || "sb_publishable_A8eDSgG2V1LwNVpQbprsHQ_0ett..."; // Mantén tu fallback temporal seguro si no usas bundler

  // Inicialización ultra segura inyectando una propiedad única en window para no romper la línea 1
  if (!window.supabaseClientInstance) {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      window.supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
      console.error("La librería de Supabase no se ha cargado correctamente en el HTML.");
      return;
    }
  }
  
  // Usamos 'db' internamente. Adiós al error "Identifier 'supabase' has already been declared"
  const db = window.supabaseClientInstance;
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

  /* ESTADO GLOBAL DE LA APLICACIÓN */
  const state = {
    users: {},
    questions: [],
    filters: { category: "Todas", status: "Todas", search: "" },
    expandedId: null,
    drafts: {},
  };

  const fallbackUsers = {
    u1: { id: "u1", nombre: "Tú", avatar: avatar(12), expertise: ["Programación", "Diseño"], puntos: 100 },
    u2: { id: "u2", nombre: "Marina Vidal", avatar: avatar(47), expertise: ["Matemáticas"], puntos: 260 },
    u3: { id: "u3", nombre: "Kenji Sato", avatar: avatar(15), expertise: ["Programación"], puntos: 340 },
    u4: { id: "u4", nombre: "Lucía Fernández", avatar: avatar(32), expertise: ["Idiomas"], puntos: 190 },
  };

  /* CARGA DE DATOS REALES DESDE SUPABASE (TABLA PUBLICACIONES) */
  async function loadDataFromSupabase() {
    try {
      let { data: publicaciones, error } = await db
        .from('publicaciones')
        .select('*, respuestas(*)');

      if (error) {
        console.error("Error al consultar Supabase:", error.message);
        return;
      }

      state.questions = (publicaciones || []).map(p => ({
        id: p.id,
        usuarioId: p.usuario_id || "u2", 
        titulo: p.titulo || "Sin título",
        descripcion: p.descripcion || "",
        categoria: p.categoria || "Programación",
        puntos: Number(p.puntos) || 0,
        fecha: p.fecha || new Date().toISOString().slice(0, 10),
        estado: p.estado || "Abierta",
        destacada: p.destacada === true || p.puntos >= 50,
        respuestas: (p.respuestas || []).map(r => ({
          id: r.id,
          usuarioId: r.usuario_id || "u3",
          contenido: r.contenido || r.texto || "",
          fecha: r.fecha || new Date().toISOString().slice(0, 10),
          esAceptada: r.es_aceptada === true
        }))
      })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      state.users = fallbackUsers; 
      render();
    } catch (err) {
      console.error("Error crítico de sincronización:", err);
    }
  }

  function currentUser() { return state.users[CURRENT_USER_ID] || fallbackUsers[CURRENT_USER_ID]; }
  function escapeHtml(str) { if (!str) return ""; const div = document.createElement("div"); div.textContent = str; return div.innerHTML; }

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

  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

  /* RENDERS DE LA INTERFAZ */
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
    const statuses = [{ key: "Todas", label: "Todas" }, { key: "Abierta", label: "Abiertas" }, { key: "Destacada", label: "Destacadas" }, { key: "Resuelta", label: "Resueltas" }];
    const statusHtml = statuses.map((s) => {
      const active = state.filters.status === s.key;
      return `<button data-action="filter-status" data-status="${s.key}" class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}">${s.label}</button>`;
    }).join("");
    document.getElementById("status-filters").innerHTML = statusHtml;

    let catHtml = `<button data-action="filter-category" data-category="Todas" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${state.filters.category === "Todas" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}">Todas</button>`;
    catHtml += CATEGORIES.map((cat) => {
      const meta = CATEGORY_META[cat];
      return `<button data-action="filter-category" data-category="${cat}" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${state.filters.category === cat ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}"><i data-lucide="${meta.icon}" class="h-4 w-4" style="color:${meta.color}"></i> ${cat}</button>`;
    }).join("");
    document.getElementById("category-filters").innerHTML = catHtml;
    refreshIcons();
  }

  function renderQuestionCard(q) {
    const author = state.users[q.usuarioId] || fallbackUsers.u2;
    const meta = CATEGORY_META[q.categoria] || { icon: "help-circle", color: "#64748B" };
    const expanded = state.expandedId === q.id;

    return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-4">
      <div class="flex items-start gap-3">
        <img src="${author.avatar}" class="h-[42px] w-[42px] rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-slate-800">${author.nombre}</span> <span class="text-xs text-slate-400">· ${q.fecha}</span>
          <button data-action="toggle-expand" data-qid="${q.id}" class="mt-1 block text-left">
            <h3 class="font-display text-[17px] font-bold text-slate-900 hover:text-indigo-700">${escapeHtml(q.titulo)}</h3>
          </button>
          <p class="mt-1.5 text-sm text-slate-600">${escapeHtml(q.descripcion)}</p>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style="background-color:${meta.color}14; color:${meta.color}">${q.categoria}</span>
            <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">${q.puntos} pts</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderFeed() {
    const filtered = getFilteredQuestions();
    const countEl = document.getElementById("feed-count");
    if (countEl) countEl.textContent = `${filtered.length} dudas encontradas`;
    const list = document.getElementById("feed-list");
    if (list) list.innerHTML = filtered.length === 0 ? '<div class="p-5 text-center bg-white border rounded-xl">Sin resultados coincidentes</div>' : filtered.map(renderQuestionCard).join("");
    refreshIcons();
  }

  function renderRightSidebar() {
    const ranking = Object.values(state.users).slice(0, 5);
    document.getElementById("ranking-list").innerHTML = ranking.map((u) => `
      <div class="flex items-center gap-2.5">
        <img src="${u.avatar}" class="h-8 w-8 rounded-full object-cover" />
        <span class="text-sm font-semibold text-slate-800 flex-1">${u.nombre}</span>
        <span class="text-xs font-bold text-indigo-600">${u.puntos} pts</span>
      </div>`).join("");
  }

  function render() { renderUserBar(); renderLeftSidebar(); renderFeed(); renderRightSidebar(); }

  /* ESCUCHADORES DE EVENTOS */
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "toggle-expand") { state.expandedId = state.expandedId === target.dataset.qid ? null : target.dataset.qid; renderFeed(); }
    if (action === "filter-category") { state.filters.category = target.dataset.category; renderFeed(); }
    if (action === "filter-status") { state.filters.status = target.dataset.status; renderFeed(); }
  });

  const searchInp = document.getElementById("search-input");
  if (searchInp) searchInp.addEventListener("input", (e) => { state.filters.search = e.target.value; renderFeed(); });

  document.addEventListener("DOMContentLoaded", loadDataFromSupabase);
})();
