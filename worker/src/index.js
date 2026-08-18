const STATUS_VALUES = new Set([
  "submitted",
  "under_review",
  "approved",
  "planned",
  "already_planned",
  "rejected",
  "duplicate",
  "implemented"
]);

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cors
    }
  });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "https://pbcristi.github.io")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  const chosen = origin && allowed.includes(origin) ? origin : allowed[0] || "https://pbcristi.github.io";
  return {
    "Access-Control-Allow-Origin": chosen,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins(env).includes(origin);
}

function normalizeSuggestion(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ""));
  const right = new TextEncoder().encode(String(b || ""));
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) mismatch |= (left[i] || 0) ^ (right[i] || 0);
  return mismatch === 0;
}

function validClientId(value) {
  return typeof value === "string" && value.length >= 20 && value.length <= 100 && /^[A-Za-z0-9_-]+$/.test(value);
}

function validSuggestion(text) {
  if (text.length < 20 || text.length > 1000) return "Suggestions must be between 20 and 1000 characters.";
  const urls = text.match(/https?:\/\//gi) || [];
  if (urls.length > 2) return "Please limit links to two per suggestion.";
  if (/(.)\1{14,}/i.test(text)) return "Suggestion appears to contain excessive repeated characters.";
  return null;
}

async function verifyTurnstile(token, env) {
  if (!token || typeof token !== "string" || token.length > 2048) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  if (!response.ok) return false;
  const result = await response.json();
  if (!result.success) return false;
  if (result.action && result.action !== "community_suggestion") return false;
  if (env.TURNSTILE_EXPECTED_HOSTNAME && result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) return false;
  return true;
}

async function checkRateLimit(clientId, env) {
  const clientHash = await sha256(`${env.RATE_LIMIT_SALT}:${clientId}`);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const row = await env.DB.prepare(
    "SELECT client_hash, window_start, submit_count FROM community_rate_limits WHERE client_hash = ?"
  ).bind(clientHash).first();

  if (!row || now - Number(row.window_start) >= windowMs) {
    await env.DB.prepare(
      "INSERT INTO community_rate_limits (client_hash, window_start, submit_count) VALUES (?, ?, 1) " +
      "ON CONFLICT(client_hash) DO UPDATE SET window_start = excluded.window_start, submit_count = 1"
    ).bind(clientHash, now).run();
    return true;
  }

  if (Number(row.submit_count) >= 3) return false;
  await env.DB.prepare(
    "UPDATE community_rate_limits SET submit_count = submit_count + 1 WHERE client_hash = ?"
  ).bind(clientHash).run();
  return true;
}

async function cleanupRateLimits(env) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  await env.DB.prepare("DELETE FROM community_rate_limits WHERE window_start < ?").bind(cutoff).run();
}

function requireAdmin(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length >= 24 && constantTimeEqual(token, env.ADMIN_TOKEN);
}

async function listPublic(env) {
  const result = await env.DB.prepare(
    "SELECT id, created_at, suggestion, status, developer_response, completed_at " +
    "FROM community_suggestions ORDER BY created_at DESC LIMIT 300"
  ).all();
  const rows = result.results || [];
  return {
    active: rows.filter((row) => row.status !== "implemented"),
    completed: rows.filter((row) => row.status === "implemented")
  };
}

async function listAdmin(env) {
  const result = await env.DB.prepare(
    "SELECT id, created_at, updated_at, suggestion, status, developer_response, completed_at " +
    "FROM community_suggestions ORDER BY created_at DESC LIMIT 500"
  ).all();
  return { suggestions: result.results || [] };
}

async function submitSuggestion(request, env, cors) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid request body." }, 400, cors); }

  if (String(body.website || "").trim()) return json({ error: "Submission rejected." }, 400, cors);

  const suggestion = normalizeSuggestion(body.suggestion);
  const validationError = validSuggestion(suggestion);
  if (validationError) return json({ error: validationError }, 400, cors);
  if (!validClientId(body.clientId)) return json({ error: "Invalid anonymous client identifier." }, 400, cors);

  const turnstileOk = await verifyTurnstile(body.turnstileToken, env);
  if (!turnstileOk) return json({ error: "Bot verification failed. Please retry." }, 400, cors);

  const rateOk = await checkRateLimit(body.clientId, env);
  if (!rateOk) return json({ error: "Too many submissions in a short period." }, 429, cors);

  const normalizedHash = await sha256(suggestion.toLocaleLowerCase());
  const duplicate = await env.DB.prepare(
    "SELECT id FROM community_suggestions WHERE normalized_hash = ? LIMIT 1"
  ).bind(normalizedHash).first();
  if (duplicate) return json({ error: "This suggestion appears to have already been submitted." }, 409, cors);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO community_suggestions " +
      "(id, created_at, updated_at, suggestion, normalized_hash, status, developer_response, completed_at) " +
      "VALUES (?, ?, ?, ?, ?, 'submitted', NULL, NULL)"
    ).bind(id, now, now, suggestion, normalizedHash).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return json({ error: "This suggestion appears to have already been submitted." }, 409, cors);
    }
    throw error;
  }

  cleanupRateLimits(env).catch(() => {});
  return json({ id, created_at: now, suggestion, status: "submitted", developer_response: null }, 201, cors);
}

async function updateSuggestion(request, id, env, cors) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid request body." }, 400, cors); }
  const status = String(body.status || "");
  const response = String(body.developerResponse || "").trim();
  if (!STATUS_VALUES.has(status)) return json({ error: "Invalid moderation status." }, 400, cors);
  if (response.length > 2000) return json({ error: "Developer response is too long." }, 400, cors);

  const now = new Date().toISOString();
  const completedAt = status === "implemented" ? now : null;
  const result = await env.DB.prepare(
    "UPDATE community_suggestions SET status = ?, developer_response = ?, completed_at = ?, updated_at = ? WHERE id = ?"
  ).bind(status, response || null, completedAt, now, id).run();

  if (!result.meta?.changes) return json({ error: "Suggestion not found." }, 404, cors);
  return json({ ok: true }, 200, cors);
}

async function deleteSuggestion(id, env, cors) {
  const result = await env.DB.prepare("DELETE FROM community_suggestions WHERE id = ?").bind(id).run();
  if (!result.meta?.changes) return json({ error: "Suggestion not found." }, 404, cors);
  return json({ ok: true }, 200, cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!originAllowed(request, env)) return json({ error: "Origin not allowed." }, 403, cors);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET" && path === "/health") return json({ ok: true }, 200, cors);
      if (request.method === "GET" && path === "/suggestions") return json(await listPublic(env), 200, cors);
      if (request.method === "POST" && path === "/suggestions") return await submitSuggestion(request, env, cors);

      if (path === "/admin/suggestions" || path.startsWith("/admin/suggestions/")) {
        if (!requireAdmin(request, env)) return json({ error: "Unauthorized." }, 401, cors);
        if (request.method === "GET" && path === "/admin/suggestions") return json(await listAdmin(env), 200, cors);
        const id = decodeURIComponent(path.slice("/admin/suggestions/".length));
        if (!id) return json({ error: "Suggestion ID required." }, 400, cors);
        if (request.method === "PATCH") return await updateSuggestion(request, id, env, cors);
        if (request.method === "DELETE") return await deleteSuggestion(id, env, cors);
      }

      return json({ error: "Not found." }, 404, cors);
    } catch (error) {
      console.error("JJKCE community API error", error);
      return json({ error: "Internal server error." }, 500, cors);
    }
  }
};
