(() => {
  "use strict";

  const config = window.JJKCECommunityConfig || {};
  const apiBase = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const siteKey = String(config.turnstileSiteKey || "");
  const configured = apiBase.startsWith("https://") && siteKey.length > 10;

  const form = document.getElementById("community-suggestion-form");
  const textarea = document.getElementById("community-suggestion-text");
  const counter = document.getElementById("community-suggestion-count");
  const submit = document.getElementById("community-suggestion-submit");
  const status = document.getElementById("community-suggestion-status");
  const activeList = document.getElementById("community-active-list");
  const completedList = document.getElementById("community-completed-list");
  const backendNotice = document.getElementById("community-backend-notice");
  const turnstileHost = document.getElementById("community-turnstile");

  if (!form || !textarea || !submit || !status || !activeList || !completedList) return;

  let turnstileToken = "";
  let turnstileWidgetId = null;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function getClientId() {
    const key = "jjkce-community-client-id";
    try {
      let value = localStorage.getItem(key);
      if (!value) {
        value = crypto.randomUUID();
        localStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return crypto.randomUUID();
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  const statusLabels = {
    submitted: "Submitted",
    under_review: "Under Review",
    approved: "Approved",
    planned: "Planned / Added to Roadmap",
    already_planned: "Already Planned",
    rejected: "Rejected",
    duplicate: "Duplicate",
    implemented: "Implemented / Completed"
  };

  function suggestionCard(item) {
    const article = document.createElement("article");
    article.className = "community-entry";

    const meta = document.createElement("div");
    meta.className = "community-entry-meta";

    const badge = document.createElement("span");
    badge.className = `community-status community-status-${item.status || "submitted"}`;
    badge.textContent = statusLabels[item.status] || item.status || "Submitted";

    const date = document.createElement("span");
    date.textContent = formatDate(item.created_at);

    meta.append(badge, date);

    const text = document.createElement("p");
    text.className = "community-entry-text";
    text.textContent = item.suggestion || "";

    article.append(meta, text);

    if (item.developer_response) {
      const response = document.createElement("div");
      response.className = "community-developer-response";
      const title = document.createElement("strong");
      title.textContent = "Developer response";
      const body = document.createElement("p");
      body.textContent = item.developer_response;
      response.append(title, body);
      article.append(response);
    }

    return article;
  }

  function renderList(root, items, emptyMessage) {
    root.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "community-empty";
      empty.textContent = emptyMessage;
      root.append(empty);
      return;
    }
    for (const item of items) root.append(suggestionCard(item));
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }

    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function loadSuggestions() {
    if (!configured) {
      renderList(activeList, [], "Live community submissions are being prepared.");
      renderList(completedList, [], "No completed community submissions are available yet.");
      return;
    }

    try {
      const data = await api("/suggestions", { method: "GET", headers: {} });
      renderList(activeList, data.active, "No player submissions yet. Be the first to share an idea.");
      renderList(completedList, data.completed, "No community suggestions have reached the completed archive yet.");
    } catch (error) {
      renderList(activeList, [], "The community board is temporarily unavailable.");
      renderList(completedList, [], "The completed archive is temporarily unavailable.");
    }
  }

  function loadTurnstile() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) return resolve();
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function initializeTurnstile() {
    if (!configured || !turnstileHost) return;
    try {
      await loadTurnstile();
      turnstileWidgetId = window.turnstile.render(turnstileHost, {
        sitekey: siteKey,
        theme: "dark",
        action: "community_suggestion",
        callback(token) {
          turnstileToken = token;
          submit.disabled = false;
        },
        "expired-callback"() {
          turnstileToken = "";
          submit.disabled = true;
        },
        "error-callback"() {
          turnstileToken = "";
          submit.disabled = true;
          setStatus("Bot verification could not load. Please retry in a moment.", "error");
        }
      });
    } catch (_) {
      setStatus("Bot verification could not load. Please retry later.", "error");
    }
  }

  textarea.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length}/1000`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configured) return;

    const suggestion = textarea.value.trim();
    if (suggestion.length < 20 || suggestion.length > 1000) {
      setStatus("Suggestions must be between 20 and 1000 characters.", "error");
      return;
    }
    if (!turnstileToken) {
      setStatus("Complete the bot check before submitting.", "error");
      return;
    }

    submit.disabled = true;
    setStatus("Submitting…");

    try {
      await api("/suggestions", {
        method: "POST",
        body: JSON.stringify({
          suggestion,
          turnstileToken,
          clientId: getClientId(),
          website: form.elements.website?.value || ""
        })
      });
      textarea.value = "";
      counter.textContent = "0/1000";
      setStatus("Suggestion submitted. It is now visible on the public board.", "success");
      await loadSuggestions();
    } catch (error) {
      if (error.status === 409) setStatus("That suggestion appears to have already been submitted.", "error");
      else if (error.status === 429) setStatus("Too many submissions in a short period. Please try again later.", "error");
      else setStatus(error.message || "Submission failed. Please try again.", "error");
    } finally {
      turnstileToken = "";
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
      submit.disabled = true;
    }
  });

  if (!configured) {
    form.hidden = true;
    if (backendNotice) backendNotice.hidden = false;
  } else {
    form.hidden = false;
    if (backendNotice) backendNotice.hidden = true;
    submit.disabled = true;
    initializeTurnstile();
  }

  loadSuggestions();
})();
