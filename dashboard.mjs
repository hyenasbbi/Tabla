import { getStore } from "@netlify/blobs";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const STORE_NAME = "hyenas-dashboard";
const STATE_KEY = "shared-state";
const ARCHIVE_PREFIX = "archive-";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires";
const DATA_VERSION = 3;

const DEFAULT_TEAM = [
  {
    id: "kesi",
    fullName: "Tomas Agustín Quesada",
    shortName: "Kesi",
    aliases: ["tomas agustin quesada", "tomas quesada", "agustin quesada", "kesi"],
    sales: 0,
    target: 3500,
    strikes: 0,
    rank: 1,
    previousRank: 1,
    ticket2k: false,
  },
  {
    id: "angi",
    fullName: "Angi Acosta",
    shortName: "Angi",
    aliases: ["angi acosta", "angie acosta", "angi", "angie"],
    sales: 0,
    target: 6000,
    strikes: 0,
    rank: 2,
    previousRank: 2,
    ticket2k: false,
  },
  {
    id: "esteban",
    fullName: "Esteban Basaure",
    shortName: "Esteban",
    aliases: ["esteban basaure", "esteban"],
    sales: 0,
    target: 3000,
    strikes: 0,
    rank: 3,
    previousRank: 3,
    ticket2k: false,
  },
  {
    id: "skill",
    fullName: "Carlos Da Silva",
    shortName: "Skill",
    aliases: ["carlos da silva", "carlos dasilva", "carlos silva", "skill"],
    sales: 0,
    target: 3000,
    strikes: 0,
    rank: 4,
    previousRank: 4,
    ticket2k: false,
  },
  {
    id: "santi",
    fullName: "Santiago Oronao",
    shortName: "Santi",
    aliases: ["santiago oronao", "santiago orona", "santi oronao", "santi"],
    sales: 0,
    target: 3000,
    strikes: 0,
    rank: 5,
    previousRank: 5,
    ticket2k: false,
  },
  {
    id: "tom",
    fullName: "Tomas Aebi",
    shortName: "Tom",
    aliases: ["tomas aebi", "tomas aeby", "tom aebi", "tom"],
    sales: 0,
    target: 5000,
    strikes: 1,
    rank: 6,
    previousRank: 6,
    ticket2k: false,
  },
  {
    id: "joa",
    fullName: "Joaquin Vitale",
    shortName: "Joa",
    aliases: ["joaquin vitale", "joaquin vital", "joa vitale", "joa"],
    sales: 0,
    target: 3500,
    strikes: 0,
    rank: 7,
    previousRank: 7,
    ticket2k: false,
  },
  {
    id: "kevin",
    fullName: "Kevin Diaz",
    shortName: "Kevin",
    aliases: ["kevin diaz", "kevin días", "kevin"],
    sales: 0,
    target: 1000,
    strikes: 0,
    rank: 8,
    previousRank: 8,
    ticket2k: false,
  },
];

const RESPONSE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest();
}

function safeEqual(left, right) {
  const leftHash = hash(left);
  const rightHash = hash(right);
  return timingSafeEqual(leftHash, rightHash);
}

function getSecret() {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "";
}

function getCurrentPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const rawLabel = new Intl.DateTimeFormat("es-AR", {
    timeZone: BUSINESS_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(date);

  return {
    key: `${year}-${month}`,
    label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
  };
}

function inferStatePeriod(input) {
  if (input?.periodKey) {
    const key = cleanText(input.periodKey, 7);
    const label = input.periodLabel
      ? cleanText(input.periodLabel, 40)
      : key;
    return { key, label };
  }

  if (input?.lastUpdated) {
    const parsed = new Date(input.lastUpdated);
    if (!Number.isNaN(parsed.getTime())) {
      return getCurrentPeriod(parsed);
    }
  }

  return getCurrentPeriod();
}

function createToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + TOKEN_TTL_MS,
      nonce: randomUUID(),
    }),
  ).toString("base64url");

  const signature = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !getSecret()) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expected = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");

  if (!safeEqual(signature, expected)) {
    return false;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    return Number(decoded.exp) > Date.now();
  } catch {
    return false;
  }
}

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function cleanText(value, maxLength = 100) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanNumber(value, maximum = 100_000_000) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(Math.max(number, 0), maximum)
    : 0;
}

function sanitizeState(input) {
  if (!input || !Array.isArray(input.team)) {
    throw new Error("Estado inválido: falta el equipo.");
  }

  const inferredPeriod = inferStatePeriod(input);
  const seenIds = new Set();
  const team = input.team.slice(0, 100).map((seller, index) => {
    let id = cleanText(seller.id || `seller-${index + 1}`, 80)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    while (seenIds.has(id)) {
      id = `${id}-${index + 1}`;
    }

    seenIds.add(id);

    return {
      id,
      fullName: cleanText(seller.fullName || seller.shortName, 120),
      shortName: cleanText(seller.shortName || seller.fullName, 50),
      aliases: Array.isArray(seller.aliases)
        ? seller.aliases.slice(0, 20).map(alias => cleanText(alias, 120))
        : [],
      sales: cleanNumber(seller.sales),
      target: cleanNumber(seller.target),
      strikes: Math.floor(cleanNumber(seller.strikes, 20)),
      rank: Math.max(1, Math.floor(cleanNumber(seller.rank, 100) || index + 1)),
      previousRank: Math.max(
        1,
        Math.floor(cleanNumber(seller.previousRank, 100) || index + 1),
      ),
      ticket2k: Boolean(seller.ticket2k),
    };
  });

  if (team.length === 0) {
    throw new Error("El equipo no puede quedar vacío.");
  }

  team.sort((a, b) => a.rank - b.rank);
  team.forEach((seller, index) => {
    seller.rank = index + 1;
  });

  return {
    version: DATA_VERSION,
    periodKey: inferredPeriod.key,
    periodLabel: input.periodLabel
      ? cleanText(input.periodLabel, 40)
      : inferredPeriod.label,
    team,
    winner3k: input.winner3k ? cleanText(input.winner3k, 50) : null,
    lastUpdated: input.lastUpdated || new Date().toISOString(),
  };
}

function makeInitialState(period = getCurrentPeriod()) {
  return {
    version: DATA_VERSION,
    periodKey: period.key,
    periodLabel: period.label,
    team: clone(DEFAULT_TEAM),
    winner3k: null,
    lastUpdated: new Date().toISOString(),
  };
}

function makeMonthlyResetState(previousState, period = getCurrentPeriod()) {
  const priorTeam = Array.isArray(previousState?.team)
    ? previousState.team
    : clone(DEFAULT_TEAM);

  const orderedTeam = [...priorTeam].sort((a, b) => {
    const rankDifference = (Number(a.rank) || 999) - (Number(b.rank) || 999);
    if (rankDifference !== 0) return rankDifference;
    return String(a.shortName || "").localeCompare(String(b.shortName || ""), "es");
  });

  const team = orderedTeam.map((seller, index) => ({
    ...seller,
    sales: 0,
    strikes: 0,
    rank: index + 1,
    previousRank: index + 1,
    ticket2k: false,
  }));

  return sanitizeState({
    version: DATA_VERSION,
    periodKey: period.key,
    periodLabel: period.label,
    team,
    winner3k: null,
    lastUpdated: new Date().toISOString(),
  });
}

async function ensureCurrentPeriod(store, state) {
  const currentPeriod = getCurrentPeriod();
  const sanitized = sanitizeState(state);

  if (sanitized.periodKey === currentPeriod.key) {
    if (sanitized.periodLabel !== currentPeriod.label) {
      sanitized.periodLabel = currentPeriod.label;
      await store.setJSON(STATE_KEY, sanitized);
    }
    return sanitized;
  }

  /*
   * Primer acceso del nuevo mes:
   * 1) archiva el mes anterior;
   * 2) conserva vendedores, metas y orden final;
   * 3) pone ventas, strikes y bonos en cero;
   * 4) inicia las flechas sin movimientos falsos.
   */
  if (sanitized.periodKey) {
    await store.setJSON(`${ARCHIVE_PREFIX}${sanitized.periodKey}`, sanitized);
  }

  const resetState = makeMonthlyResetState(sanitized, currentPeriod);
  await store.setJSON(STATE_KEY, resetState);
  return resetState;
}

async function readState() {
  const store = getStore(STORE_NAME);
  const stored = await store.get(STATE_KEY, {
    type: "json",
    consistency: "strong",
  });

  if (!stored) {
    const initial = makeInitialState();
    await store.setJSON(STATE_KEY, initial);
    return initial;
  }

  return ensureCurrentPeriod(store, stored);
}

async function writeState(input) {
  const currentPeriod = getCurrentPeriod();
  const store = getStore(STORE_NAME);
  const existing = await readState();
  const incoming = sanitizeState(input);

  if (incoming.periodKey !== currentPeriod.key) {
    const error = new Error(
      `El período ${incoming.periodKey || "anterior"} ya cerró. Recargá la página para trabajar en ${currentPeriod.label}.`,
    );
    error.status = 409;
    throw error;
  }

  /* Evita que una pestaña vieja reescriba el mes anterior tras el rollover. */
  if (existing.periodKey !== currentPeriod.key) {
    const error = new Error(
      `El mes cambió a ${currentPeriod.label}. Recargá la página antes de guardar.`,
    );
    error.status = 409;
    throw error;
  }

  incoming.periodKey = currentPeriod.key;
  incoming.periodLabel = currentPeriod.label;
  incoming.lastUpdated = new Date().toISOString();

  await store.setJSON(STATE_KEY, incoming);
  return incoming;
}

export default async function handler(request) {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET") {
      const state = await readState();
      return json({ ok: true, state });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));

      if (body.action !== "login") {
        return json({ error: "Acción no permitida." }, 400);
      }

      const configuredPassword = process.env.ADMIN_PASSWORD;

      if (!configuredPassword) {
        return json(
          {
            error:
              "Falta configurar ADMIN_PASSWORD en las variables de entorno de Netlify.",
          },
          500,
        );
      }

      if (!safeEqual(body.password || "", configuredPassword)) {
        return json({ error: "Contraseña incorrecta." }, 401);
      }

      /* El login también fuerza la revisión del mes vigente. */
      await readState();
      return json({ ok: true, token: createToken() });
    }

    if (request.method === "PUT") {
      if (!verifyToken(bearerToken(request))) {
        return json({ error: "Sesión no autorizada o vencida." }, 401);
      }

      const body = await request.json().catch(() => ({}));
      const state = await writeState(body.state);
      return json({ ok: true, state });
    }

    return json({ error: "Método no permitido." }, 405);
  } catch (error) {
    console.error("dashboard function error", error);
    const status = Number(error?.status) || 500;
    return json(
      { error: error instanceof Error ? error.message : "Error interno." },
      status,
    );
  }
}
