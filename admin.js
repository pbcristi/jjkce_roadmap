(() => {
  "use strict";

  const config = window.JJKCECommunityConfig || {};
  const apiBase = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const loginPanel = document.getElementById("login-panel");
  const loginForm = document.getElementById("admin-login-form");
  const tokenInput = document.getElementById("admin-token");
  const loginStatus = document.getElementById("admin-login-status");
  const board = document.getElementById("admin-board");
  const boardStatus = document.getElementById("admin-board-status");
  const list = document.getElementById("admin-list");
  const refresh = document.getElementById("admin-refresh");
  const lock = document.getElementById("admin-lock");

  const statuses = [
    ["submitted", "Submitted"],
    ["under_review", "Under Review"],
    ["approved", "Approved"],
    ["planned", "Planned / Added to Roadmap"],
    ["already_planned", "Already Planned"],
    ["rejected", "Rejected"],
    ["duplicate", "Duplicate"],
    ["implemented", "Implemented / Completed"]
  ];

  function getToken() { return sessionStorage.getItem("jjkce-community-admin-token") || ""; }
  function setStatus(root, message, kind = "") { root.textContent = message; root.dataset.kind = kind; }

  async function api(path, options = {}) {
    const token = getToken();
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
    return payload;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function makeEntry(item) {
    const article = document.createElement("article");
    article.className = "entry";

    const meta = document.createElement("div");
    meta.className = "meta";
    const id = document.createElement("span");
    id.textContent = `ID: ${item.id}`;
    const date = document.createElement("span");
    date.textContent = formatDate(item.created_at);
    meta.append(id, date);

    const suggestion = document.createElement("p");
    suggestion.className = "suggestion";
    suggestion.textContent = item.suggestion;

    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Moderation status";
    const select = document.createElement("select");
    for (const [value, label] of statuses) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = item.status === value;
      select.append(option);
    }

    const responseLabel = document.createElement("label");
    responseLabel.textContent = "Official developer response";
    const response = document.createElement("textarea");
    response.maxLength = 2000;
    response.value = item.developer_response || "";

    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.marginTop = "10px";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Delete permanently";
    const message = document.createElement("span");
    message.className = "status";
    actions.append(save, remove, message);

    save.addEventListener("click", async () => {
      save.disabled = true;
      setStatus(message, "Saving…");
      try {
        await api(`/admin/suggestions/${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: select.value, developerResponse: response.value.trim() })
        });
        setStatus(message, "Saved.", "success");
      } catch (error) {
        setStatus(message, error.message, "error");
      } finally { save.disabled = false; }
    });

    remove.addEventListener("click", async () => {
      if (!confirm("Permanently delete this suggestion? This cannot be undone.")) return;
      remove.disabled = true;
      try {
        await api(`/admin/suggestions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        article.remove();
      } catch (error) {
        setStatus(message, error.message, "error");
        remove.disabled = false;
      }
    });

    article.append(meta, suggestion, statusLabel, select, responseLabel, response, actions);
    return article;
  }

  async function loadBoard() {
    if (!apiBase.startsWith("https://")) {
      setStatus(boardStatus, "The API endpoint is not configured in community-config.js.", "error");
      return false;
    }
    setStatus(boardStatus, "Loading…");
    try {
      const data = await api("/admin/suggestions", { method: "GET" });
      list.replaceChildren();
      for (const item of data.suggestions || []) list.append(makeEntry(item));
      if (!data.suggestions?.length) {
        const empty = document.createElement("p");
        empty.textContent = "No suggestions yet.";
        list.append(empty);
      }
      setStatus(boardStatus, `${data.suggestions?.length || 0} suggestion(s) loaded.`, "success");
      return true;
    } catch (error) {
      setStatus(boardStatus, error.message, "error");
      return false;
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = tokenInput.value.trim();
    if (token.length < 24) {
      setStatus(loginStatus, "Invalid admin token.", "error");
      return;
    }
    sessionStorage.setItem("jjkce-community-admin-token", token);
    tokenInput.value = "";
    const ok = await loadBoard();
    if (ok) {
      loginPanel.hidden = true;
      board.hidden = false;
      setStatus(loginStatus, "");
    } else {
      sessionStorage.removeItem("jjkce-community-admin-token");
      setStatus(loginStatus, "Authentication failed.", "error");
    }
  });

  refresh.addEventListener("click", loadBoard);
  lock.addEventListener("click", () => {
    sessionStorage.removeItem("jjkce-community-admin-token");
    board.hidden = true;
    loginPanel.hidden = false;
  });

  if (getToken()) {
    loadBoard().then((ok) => {
      if (ok) { loginPanel.hidden = true; board.hidden = false; }
      else sessionStorage.removeItem("jjkce-community-admin-token");
    });
  }
})();
