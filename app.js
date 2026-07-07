/* ====================================================================
   SKILLSWAP — MVP de Trueque de Conocimientos (VERSIÓN FINAL PRODUCCIÓN)
   Vanilla JavaScript · Conectado de forma real a las tablas de Supabase
   ==================================================================== */

(function() {
  const SUPABASE_URL = "https://radvowugwrkdddmbpapz.supabase.co"; 
  const SUPABASE_KEY = "sb_publishable_A8eDSgG2V1LwNVpQbprsHQ_0OettsMo"; 

  if (!window.supabaseClientInstance) {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      window.supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
      console.error("Error: La librería CDN de Supabase no se detecta en el index.html");
      return;
    }
  }
  
  const db = window.supabaseClientInstance;
  const CURRENT_USER_ID = "u1";

  // Mapeo de categorías adaptado a tu aplicación
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

  const state = {
    users: {},
    questions: [],
    filters: { category: "Todas", status: "Todas", search: "" },
    expandedId: null
  };

  const fallbackUsers = {
    u1: { id: "u1", nombre: "Tú", avatar: avatar(12), expertise: ["Programación", "Diseño"], puntos: 100 },
    u2: { id: "u2", nombre: "Marina Vidal", avatar: avatar(47), expertise: ["Matemáticas"], puntos: 260 },
    u3: { id: "u3", nombre: "Kenji Sato", avatar: avatar(15), expertise: ["Programación"], puntos: 340 },
    u4: { id: "u4", nombre: "Lucía Fernández", avatar: avatar(32), expertise: ["Idiomas"], puntos: 190 },
  };

  // Función de lectura desde la tabla base para evitar problemas de vistas de solo lectura
  async function loadDataFromSupabase() {
    try {
      let { data: publicaciones, error } = await db
        .from('publicaciones')
        .select('*, respuestas(*)');

      if (error) {
        console.error("Error de lectura en Supabase:", error.message);
        return;
      }

      state.questions = (publicaciones || []).map(p => ({
        id: p.id,
        usuarioId: p.usuario_id || "u2", 
        titulo: p.titulo || "Sin título",
        descripcion: p.descripcion || "",
        categoria: p.categoria || "Programación", // Ajustado a 'categoria' en singular según tu BD
        puntos: Number(p.puntos_ofrecidos) || 0, 
        fecha: p.fecha_creacion ? p.fecha_creacion.slice(0, 10) : new Date().toISOString().slice(0, 10), 
        estado: p.estado || "Abierta",
        destacada: p.destacada === true || Number(p.puntos_ofrecidos) >= 50,
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
      console.error("Error crítico en la sincronización del Feed:", err);
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

  function pushToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast-card shadow-md border border-slate-100 p-3 bg-white rounded-xl mb-2 flex items-center animate-in fade-in slide-in-from-bottom-2";
    el.innerHTML = `<div><p class="text-sm font-semibold text-slate-900">${escapeHtml(message)}</p></div>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /* RENDERIZADO COMPLETO */
  function renderUserBar() {
    const u = currentUser();
    const avatarEl = document.getElementById("current-user-avatar");
    const nameEl = document.getElementById("current-user-name");
    const valEl = document.getElementById("balance-value");
    if (avatarEl) { avatarEl.src = u.avatar; }
    if (nameEl) nameEl.textContent = u.nombre;
    if (valEl) valEl.textContent = u.puntos;
  }

  function renderLeftSidebar() {
    const statuses = [{ key: "Todas", label: "Todas" }, { key: "Abierta", label: "Abiertas" }, { key: "Destacada", label: "Destacadas" }, { key: "Resuelta", label: "Resueltas" }];
    const statusHtml = statuses.map((s) => {
      const active = state.filters.status === s.key;
      return `<button data-action="filter-status" data-status="${s.key}" class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}">${s.label}</button>`;
    }).join("");
    
    const statusContainer = document.getElementById("status-filters");
    if (statusContainer) statusContainer.innerHTML = statusHtml;

    let catHtml = `<button data-action="filter-category" data-category="Todas" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${state.filters.category === "Todas" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}">Todas</button>`;
    catHtml += CATEGORIES.map((cat) => {
      const meta = CATEGORY_META[cat];
      return `<button data-action="filter-category" data-category="${cat}" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${state.filters.category === cat ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}"><i data-lucide="${meta.icon}" class="h-4 w-4" style="color:${meta.color}"></i> ${cat}</button>`;
    }).join("");
    
    const catContainer = document.getElementById("category-filters");
    if (catContainer) catContainer.innerHTML = catHtml;
    refreshIcons();
  }

  function renderQuestionCard(q) {
    const author = state.users[q.usuarioId] || fallbackUsers.u2;
    const meta = CATEGORY_META[q.categoria] || { icon: "help-circle", color: "#64748B" };
    const expanded = state.expandedId === q.id;
    const isAuthor = q.usuarioId === CURRENT_USER_ID;
    const isResolved = q.estado === "Resuelta";

    const answersHtml = q.respuestas.map((r) => {
      const responder = state.users[r.usuarioId] || fallbackUsers.u3;
      return `
      <div class="rounded-xl border p-3 mt-2 ${r.esAceptada ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-slate-50/50"}">
        <div class="flex items-start gap-2">
          <img src="${responder.avatar}" class="h-6 w-6 rounded-full object-cover" />
          <div class="flex-1 min-w-0">
            <span class="text-xs font-semibold text-slate-700">${responder.nombre}</span>
            <p class="text-sm text-slate-600 mt-0.5">${escapeHtml(r.contenido)}</p>
          </div>
          ${isAuthor && !isResolved && !r.esAceptada ? 
            `<button data-action="accept-answer" data-qid="${q.id}" data-aid="${r.id}" class="text-xs bg-emerald-600 text-white font-bold px-2 py-1 rounded hover:bg-emerald-700 transition">Marcar útil</button>` : ''
          }
        </div>
      </div>`;
    }).join("");

    return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-4">
      <div class="flex items-start gap-3">
        <img src="${author.avatar}" class="h-[42px] w-[42px] rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-slate-800">${author.nombre}</span> <span class="text-xs text-slate-400">· ${q.fecha}</span>
          <button data-action="toggle-expand" data-qid="${q.id}" class="mt-1 block text-left w-full">
            <h3 class="font-display text-[17px] font-bold text-slate-900 hover:text-indigo-700">${escapeHtml(q.titulo)}</h3>
          </button>
          <p class="mt-1.5 text-sm text-slate-600 ${expanded ? "" : "line-clamp-2"}">${escapeHtml(q.descripcion)}</p>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style="background-color:${meta.color}14; color:${meta.color}">${q.categoria}</span>
            <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">${q.puntos} pts</span>
          </div>
          ${expanded ? `<div class="mt-4 pt-4 border-t border-slate-100">${answersHtml}</div>` : ""}
        </div>
      </div>
      <div class="mt-3 pt-2 border-t border-slate-50 flex justify-end">
         <button data-action="toggle-expand" data-qid="${q.id}" class="text-xs text-indigo-600 font-bold hover:underline">${expanded ? "Ocultar respuestas" : "Ver / Responder duda"}</button>
      </div>
    </div>`;
  }

  function renderFeed() {
    const filtered = getFilteredQuestions();
    const countEl = document.getElementById("feed-count");
    if (countEl) countEl.textContent = `${filtered.length} dudas encontradas`;
    const list = document.getElementById("feed-list");
    if (list) list.innerHTML = filtered.length === 0 ? '<div class="p-5 text-center bg-white border rounded-xl text-slate-500">Sin dudas cargadas.</div>' : filtered.map(renderQuestionCard).join("");
    refreshIcons();
  }

  function renderRightSidebar() {
    const rankingList = document.getElementById("ranking-list");
    if (!rankingList) return;
    const ranking = Object.values(fallbackUsers).slice(0, 5);
    rankingList.innerHTML = ranking.map((u) => `
      <div class="flex items-center gap-2.5">
        <img src="${u.avatar}" class="h-8 w-8 rounded-full object-cover" />
        <span class="text-sm font-semibold text-slate-800 flex-1">${u.nombre}</span>
        <span class="text-xs font-bold text-indigo-600">${u.puntos} pts</span>
      </div>`).join("");
  }

  function populateCategoriesSelect() {
    const select = document.getElementById("form-categoria");
    if (select) {
      select.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    }
  }

  function render() { renderUserBar(); renderLeftSidebar(); renderFeed(); renderRightSidebar(); }

  /* LOGICA DEL MODAL */
  function openModal() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
    }
  }

  function closeModal() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.classList.remove("flex");
      overlay.classList.add("hidden");
    }
    ['form-titulo', 'form-descripcion'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const err = document.getElementById("form-error");
    if (err) err.classList.add("hidden");
  }

  /* ENVÍO DE DATOS OPTIMIZADO PARA LA TABLA REAL Y COLUMNAS EXACTAS */
  async function handlePublish() {
    const titulo = document.getElementById("form-titulo").value.trim();
    const descripcion = document.getElementById("form-descripcion").value.trim();
    const categoria = document.getElementById("form-categoria").value;
    const puntos = parseInt(document.getElementById("form-puntos").value) || 20;
    const errorEl = document.getElementById("form-error");

    if (!titulo || !descripcion) {
      if (errorEl) {
        errorEl.textContent = "Por favor, completa el título y la descripción.";
        errorEl.classList.remove("hidden");
      }
      return;
    }

    try {
      // AJUSTADO: Se envía como 'categoria' en singular para que coincida con la columna real de la tabla 'publicaciones'
      const { error } = await db.from('publicaciones').insert([
        {
          titulo: titulo,
          descripcion: descripcion,
          categoria: categoria, // Cambiado de nuevo a 'categoria' en singular
          puntos_ofrecidos: puntos, 
          estado: "Abierta",
          usuario_id: CURRENT_USER_ID,
          fecha_creacion: new Date().toISOString() 
        }
      ]);

      if (error) throw error;

      closeModal();
      pushToast("¡Duda publicada con éxito!");
      await loadDataFromSupabase(); 
    } catch (err) {
      console.error("Error detectado en inserción:", err);
      if (errorEl) {
        errorEl.textContent = `Error: ${err.message || 'No se pudo guardar la duda. Revisa las políticas RLS.'}`;
        errorEl.classList.remove("hidden");
      }
    }
  }

  /* ESCUCHA DE EVENTOS GLOBALES */
  function init() {
    populateCategoriesSelect();

    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      if (action === "open-modal") { e.preventDefault(); openModal(); }
      if (action === "close-modal") { e.preventDefault(); closeModal(); }
      if (action === "submit-publish") { e.preventDefault(); handlePublish(); }
      if (action === "toggle-expand") { state.expandedId = state.expandedId === target.dataset.qid ? null : target.dataset.qid; renderFeed(); }
      if (action === "filter-category") { state.filters.category = target.dataset.category; renderLeftSidebar(); renderFeed(); }
      if (action === "filter-status") { state.filters.status = target.dataset.status; renderLeftSidebar(); renderFeed(); }
    });

    const searchInp = document.getElementById("search-input");
    if (searchInp) searchInp.addEventListener("input", (e) => { state.filters.search = e.target.value; renderFeed(); });

    loadDataFromSupabase();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
