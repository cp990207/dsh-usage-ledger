/**
 * Host half of the usage-ledger bundle.
 *
 * Folds every session log into a per-session usage ledger (tokens by day and
 * by model, tool vs conversation request split, tool-call counts) and serves
 * the rollup as JSON on the /usage-ledger-api web route.
 *
 * The session log is the only source of truth: this module keeps no durable
 * store. On activation it refolds every known session from sessionQuery and
 * then applies new events incrementally from the global 'session/event'
 * stream. A backfill in flight for one session parks that session's live
 * events and replays them after the refold, so no event is counted twice or
 * lost.
 *
 * Prices: cost is estimated from a per-model price table (currency units per
 * 1M tokens). Resolution order for a model is
 *   config.prices override > built-in catalog entry > config.prices['*'].
 * The dashboard's price editor POSTs the user's override set to
 * /usage-ledger-api/config; the plugin applies it through configEditor.edit,
 * the host reloads this plugin with the new config, and the pure fold
 * recomputes every historical cost from the session log. The user's profile
 * patch row is the single durable home for overrides, so they survive
 * plugin upgrades.
 */

const FALLBACK_PRICE_KEY = '*'
const PRICE_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite']
const ROUTE_PREFIX = '/usage-ledger-api'

/**
 * Built-in price catalog, currency units per 1M tokens, keyed by the model id
 * as it appears in session logs (provider model ids) plus known raw API ids
 * as aliases. Order in each entry: input / output / cacheRead / cacheWrite.
 * List prices checked 2026-10-23:
 * - Kimi (platform.kimi.ai/docs/pricing/chat): kimi-k3 $3 in / $15 out /
 *   $0.30 cache hit / $3 cache write (5min TTL). K2.7-code $0.95 in (cache
 *   miss) / $4 out / $0.19 cache hit, no cache-write billing; highspeed 2x.
 *   kimi-for-coding / -highspeed are the coding-plan ids for those models.
 *   k3-256k is kimi-k3 served at 262k context (the CN platform lists it at
 *   half price; the international page has no separate row).
 * - GLM (docs.z.ai/guides/overview/pricing): GLM-5.3 $1.4 / $4.4 / $0.26
 *   cached, cache storage free; GLM-5.3-Flash $0.15 / $0.50 / $0.03;
 *   GLM-5.3-FlashX $0.37 / $1.25 / $0.075; GLM-4.6V $0.3 / $0.9 / $0.05.
 *   glm-5.3-highspeed has no published list price — estimated 2x GLM-5.3,
 *   following the Kimi/MiniMax highspeed ratio; override it if you know the
 *   actual rate.
 * - MiniMax (platform.minimax.io/docs/guides/pricing-paygo): M2.7 $0.3 in /
 *   $1.2 out / $0.06 cache read / $0.375 cache write; highspeed 2x in/out.
 *   M3 standard tier (<=512k input) $0.3 / $1.2 / $0.06, >512k is 2x;
 *   M3.1-Flash $0.15 / $0.6 / $0.015, no cache-write billing.
 * - DeepSeek (api-docs.deepseek.com/quick_start/pricing): deepseek-chat
 *   $0.27 in / $1.10 out / $0.07 cache hit; deepseek-reasoner $0.55 / $2.19 /
 *   $0.14. DeepSeek bills no cache writes; the cacheWrite numbers mirror the
 *   input price as a conservative placeholder. deepseek-flash is the
 *   off-peak V4.1-Flash list ($0.15 / $0.60 / $0.003; peak is 2x).
 */
const DEFAULT_PRICES = {
  [FALLBACK_PRICE_KEY]: { input: 0.5, output: 2, cacheRead: 0.1, cacheWrite: 0.5 },
  'k3': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3 },
  'k3-256k': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3 },
  'kimi-k3': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3 },
  'kimi-for-coding': { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 },
  'kimi-for-coding-highspeed': { input: 1.9, output: 8, cacheRead: 0.38, cacheWrite: 0 },
  'kimi-k2.7-code': { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 },
  'kimi-k2.7-code-highspeed': { input: 1.9, output: 8, cacheRead: 0.38, cacheWrite: 0 },
  'kimi-k2.6': { input: 0.95, output: 4, cacheRead: 0.16, cacheWrite: 0 },
  'glm-5.3': { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
  'glm-5.3-flash': { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 },
  'glm-5.3-flashx': { input: 0.37, output: 1.25, cacheRead: 0.075, cacheWrite: 0 },
  'glm-5.3-highspeed': { input: 2.8, output: 8.8, cacheRead: 0.52, cacheWrite: 0 },
  'glm-4.6v': { input: 0.3, output: 0.9, cacheRead: 0.05, cacheWrite: 0 },
  'MiniMax-M2.7': { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
  'MiniMax-M2.7-highspeed': { input: 0.6, output: 2.4, cacheRead: 0.06, cacheWrite: 0.375 },
  'MiniMax-M3': { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
  'MiniMax-M3.1-Flash': { input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0 },
  'deepseek-chat': { input: 0.27, output: 1.1, cacheRead: 0.07, cacheWrite: 0.27 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
  'deepseek-flash': { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 },
}

/** One validated price row with all four fields present as finite numbers. */
function readPriceEntry(model, price) {
  if (typeof price !== 'object' || price === null || Array.isArray(price)) {
    throw new TypeError(`[usage-ledger] prices.${model} must be an object`)
  }
  const entry = {}
  for (const field of PRICE_FIELDS) {
    const value = price[field]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new TypeError(`[usage-ledger] prices.${model}.${field} must be a non-negative finite number`)
    }
    entry[field] = value ?? 0
  }
  return entry
}

/** Validates the user's override rows without merging the built-in catalog. */
function readOverrides(raw) {
  const source = raw && typeof raw === 'object' ? raw.prices : undefined
  if (source === undefined) return {}
  if (typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('[usage-ledger] config.prices must be an object keyed by model id')
  }
  const overrides = {}
  for (const [model, price] of Object.entries(source)) {
    overrides[model] = readPriceEntry(model, price)
  }
  return overrides
}

function mergePrices(overrides) {
  const table = structuredClone(DEFAULT_PRICES)
  for (const [model, entry] of Object.entries(overrides)) {
    // Fold an override that case-insensitively matches a cataloged model into
    // the canonical key, so priceFor's exact hit and priceSource's override
    // detection always agree on the same row.
    const canonical = findKey(table, model) ?? model
    table[canonical] = entry
  }
  return table
}

/** Validates the patch row's config; misconfiguration throws at activation. */
function readConfig(raw) {
  const currency = raw && typeof raw.currency === 'string' && raw.currency.length > 0 ? raw.currency : 'USD'
  const overrides = readOverrides(raw)
  return { currency, prices: mergePrices(overrides), overrides }
}

/**
 * Standard Schema interface for the plugin config, so the host's
 * resolveConfig can validate the row on activation and on every
 * configEditor edit. Hand-rolled because plugins cannot import schemastery.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'usage-ledger',
    validate(value) {
      try {
        // Return the user's own rows only. The host feeds the resolved config
        // back to `apply` on every reload, so expanding the built-in catalog
        // here would migrate that catalog into the user's patch row and grow
        // it on each configEditor edit. `apply` merges at runtime instead.
        const currency = value && typeof value.currency === 'string' && value.currency.length > 0
          ? value.currency
          : 'USD'
        return { value: { currency, prices: readOverrides(value) } }
      } catch (error) {
        return { issues: [{ message: String((error && error.message) || error) }] }
      }
    },
  },
}

/** Case-insensitive exact-key lookup; returns the matching table key. */
function findKey(table, model) {
  if (typeof model !== 'string' || !table) return undefined
  if (Object.hasOwn(table, model)) return model
  const lower = model.toLowerCase()
  for (const key of Object.keys(table)) {
    if (key !== FALLBACK_PRICE_KEY && key.toLowerCase() === lower) return key
  }
  return undefined
}

function priceFor(table, model) {
  const key = findKey(table, model)
  if (key !== undefined) return table[key]
  return table[FALLBACK_PRICE_KEY]
}

/** Where a model's effective price comes from: override, builtin, or fallback. */
function priceSource(config, model) {
  if (findKey(config.overrides, model) !== undefined) return 'override'
  if (findKey(DEFAULT_PRICES, model) !== undefined) return 'builtin'
  return 'fallback'
}

/** Effective price + source for every cataloged model (fallback row excluded). */
function priceCatalog(config) {
  const priceTable = {}
  const sources = {}
  const models = new Set([...Object.keys(config.overrides), ...Object.keys(DEFAULT_PRICES)])
  for (const model of models) {
    if (model === FALLBACK_PRICE_KEY) continue
    priceTable[model] = priceFor(config.prices, model)
    sources[model] = priceSource(config, model)
  }
  return { priceTable, priceSource: sources }
}

function emptyStat() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    requests: 0,
    toolRequests: 0,
    chatRequests: 0,
    toolCalls: 0,
    cost: 0,
  }
}

function addStat(target, source) {
  target.input += source.input
  target.output += source.output
  target.cacheRead += source.cacheRead
  target.cacheWrite += source.cacheWrite
  target.reasoning += source.reasoning
  target.requests += source.requests
  target.toolRequests += source.toolRequests
  target.chatRequests += source.chatRequests
  target.toolCalls += source.toolCalls
  target.cost += source.cost
}

function localDay(time) {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function usageCost(usage, price) {
  const input = usage.inputTokens ?? 0
  const output = usage.outputTokens ?? 0
  const cacheRead = usage.cacheReadTokens ?? 0
  const cacheWrite = usage.cacheWriteTokens ?? 0
  return (input * price.input + output * price.output + cacheRead * price.cacheRead + cacheWrite * price.cacheWrite) / 1e6
}

function newSessionState(meta) {
  return {
    watermark: -1,
    model: null,
    firstPrompt: null,
    toolNames: new Map(),
    days: new Map(),
    meta,
  }
}

/** First human-typed text of a user message (plugin-injected contexts carry no text or another source kind). */
function userPromptText(data) {
  if (data?.source?.kind !== 'user') return undefined
  const block = Array.isArray(data.content) ? data.content.find(item => item?.type === 'text') : undefined
  const text = typeof block?.text === 'string' ? block.text.trim() : ''
  return text.length > 0 ? text.slice(0, 200) : undefined
}

/**
 * A usage-bearing assistant message whose content emits tool-call blocks is
 * the request that drives tool execution; anything else is direct
 * conversation. Content-based because the message event precedes its own
 * tool/call events, so turn/step membership cannot classify it.
 */
function drivesTools(message) {
  return Array.isArray(message?.content) && message.content.some(block => block?.type === 'tool-call')
}

/**
 * Applies one log event to the session state. Pure over the event stream:
 * replaying a log from zero reproduces the same state, so a backfill refold
 * can replace an incrementally folded state at any time.
 */
function foldEvent(state, event, config) {
  if (event.seq <= state.watermark) return
  state.watermark = event.seq
  const data = event.data
  if (event.type === 'request/context') {
    if (data && typeof data.model === 'string') state.model = data.model
    return
  }
  if (event.type === 'tool/call') {
    if (typeof data?.name === 'string') {
      state.toolNames.set(data.name, (state.toolNames.get(data.name) ?? 0) + 1)
    }
    return
  }
  if (event.type === 'user/message') {
    if (state.firstPrompt === null) state.firstPrompt = userPromptText(data) ?? null
    return
  }
  if (event.type !== 'assistant/message') return
  const usage = data?.usage
  if (!usage || typeof usage !== 'object') return
  const isToolRound = drivesTools(data.message)
  const model = typeof data.message?.model === 'string' ? data.message.model : state.model ?? 'unknown'
  const day = localDay(event.time)
  const price = priceFor(config.prices, model)
  let byDay = state.days.get(day)
  if (!byDay) {
    byDay = { byModel: new Map() }
    state.days.set(day, byDay)
  }
  let stat = byDay.byModel.get(model)
  if (!stat) {
    stat = emptyStat()
    byDay.byModel.set(model, stat)
  }
  stat.input += usage.inputTokens ?? 0
  stat.output += usage.outputTokens ?? 0
  stat.cacheRead += usage.cacheReadTokens ?? 0
  stat.cacheWrite += usage.cacheWriteTokens ?? 0
  stat.reasoning += usage.reasoningTokens ?? 0
  stat.requests += 1
  if (isToolRound) stat.toolRequests += 1
  else stat.chatRequests += 1
  stat.cost += usageCost(usage, price)
}

/** Sum of a session's per-model day entries for one day (or all days when omitted). */
function sessionDayStat(state, day) {
  const sum = emptyStat()
  for (const [key, byDay] of state.days) {
    if (day !== undefined && key !== day) continue
    for (const stat of byDay.byModel.values()) addStat(sum, stat)
  }
  for (const count of state.toolNames.values()) sum.toolCalls += count
  return sum
}

function roundCost(value) {
  return Math.round(value * 1e6) / 1e6
}

function finalizeStat(stat) {
  return { ...stat, cost: roundCost(stat.cost) }
}

function rollup(state) {
  const byDay = {}
  const byDayModel = {}
  const byModel = {}
  for (const [day, entry] of state.days) {
    const daySum = emptyStat()
    byDayModel[day] = {}
    for (const [model, stat] of entry.byModel) {
      byModel[model] ??= emptyStat()
      addStat(byModel[model], stat)
      addStat(daySum, stat)
      byDayModel[day][model] = finalizeStat({ ...stat })
    }
    byDay[day] = finalizeStat(daySum)
  }
  const toolNames = Object.fromEntries([...state.toolNames].sort((a, b) => b[1] - a[1]))
  return { grand: finalizeStat(sessionDayStat(state)), byDay, byDayModel, byModel, toolNames }
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '::1' || hostname?.startsWith('127.')
}

function rejectRequest(req, res, reason, status) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(reason)
}

function respondJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

/**
 * Same-origin fence mirroring the /api gateway's trust rules for local
 * requests: loopback Host, no cross-site fetch, Origin must match Host.
 */
function fence(req, res) {
  const hostHeader = req.headers.host
  if (typeof hostHeader !== 'string' || hostHeader.length === 0) {
    rejectRequest(req, res, 'missing Host', 400)
    return false
  }
  let hostname
  try {
    hostname = new URL(`http://${hostHeader}`).hostname
  } catch {
    rejectRequest(req, res, 'invalid Host', 400)
    return false
  }
  if (!isLoopbackHost(hostname)) {
    rejectRequest(req, res, 'forbidden host', 403)
    return false
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    rejectRequest(req, res, 'cross-site requests are not allowed', 403)
    return false
  }
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      if (new URL(origin).host !== hostHeader) {
        rejectRequest(req, res, 'origin mismatch', 403)
        return false
      }
    } catch {
      rejectRequest(req, res, 'invalid Origin', 403)
      return false
    }
  }
  return true
}

/** Route key for a request path, tolerating both full and relative forms. */
function routeOf(req) {
  const raw = typeof req.url === 'string' && req.url.length > 0 ? req.url : '/'
  const pathname = raw.split('?')[0].split('#')[0]
  return pathname.startsWith(ROUTE_PREFIX) ? pathname.slice(ROUTE_PREFIX.length) || '/' : pathname
}

function readJsonBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.length === 0) {
        reject(new Error('empty body'))
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error('body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** Validates a submitted {currency, prices} payload into normalized rows. */
function normalizeSubmitted(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('body must be a JSON object')
  }
  const currency = typeof body.currency === 'string' && body.currency.trim().length > 0
    ? body.currency.trim().slice(0, 16)
    : undefined
  const source = body.prices
  if (source !== undefined && (typeof source !== 'object' || Array.isArray(source))) {
    throw new TypeError('prices must be an object keyed by model id')
  }
  const prices = {}
  for (const [rawModel, rawPrice] of Object.entries(source ?? {})) {
    const model = typeof rawModel === 'string' ? rawModel.trim().slice(0, 200) : ''
    if (model.length === 0) continue
    prices[model] = readPriceEntry(model, rawPrice ?? {})
  }
  return { currency, prices }
}

/** Recursive equality for plain config objects (numbers/strings/arrays/objects). */
function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key) || !deepEqual(a[key], b[key])) return false
  }
  return true
}

/**
 * configEditor change callback: layer the submitted values over the bundle's
 * inherited config so the user patch row stays a minimal diff. When the
 * result would equal the inherited config anyway, return the inherited
 * config so the editor drops the patch row and the plugin keeps following
 * the bundle.
 */
function nextConfigChange(submitted) {
  return (current, inherited) => {
    const base = inherited && typeof inherited === 'object' ? inherited
      : current && typeof current === 'object' ? current : {}
    const next = { ...base }
    if (submitted.currency) next.currency = submitted.currency
    if (Object.keys(submitted.prices).length > 0) next.prices = submitted.prices
    else delete next.prices
    if (deepEqual(next, base)) return base
    return next
  }
}

/**
 * Locates this plugin's loader entry so configEditor.edit can target it:
 * identity by the exported apply function, with the package name as a
 * fallback for loader builds that wrap module namespaces.
 */
function findOwnEntry(ctx) {
  // `fiber.entry` is the loader entry this plugin runs under; the loader
  // assigns it to every entry-scoped fiber, so it needs no service access.
  try {
    if (ctx.fiber?.entry) return ctx.fiber.entry
  } catch {
    // Fall through to the loader scan below.
  }
  try {
    const loader = typeof ctx.get === 'function' ? ctx.get('loader') : undefined
    const entries = loader?.entries?.()
    if (!entries) return null
    for (const entry of entries) {
      if (entry?.fiber?.runtime?.callback?.apply === apply) return entry
      // Fallback for loader builds that wrap module namespaces: match any
      // package name that ends in "usage-ledger" (e.g. @local/usage-ledger,
      // usage-ledger, dsh-usage-ledger), so a published rename still works.
      if (typeof entry?.options?.name === 'string' && entry.options.name.endsWith('usage-ledger')) return entry
    }
  } catch (error) {
    console.error('[usage-ledger] loader entry lookup failed:', error)
  }
  return null
}

/**
 * Resolves the host's config editor, when the host mounts one.
 *
 * This is an optional lookup rather than a service injection on purpose:
 * `inject` is all-or-nothing, so a host without a config editor (headless
 * runs, minimal web hosts) would park the whole ledger and serve no route.
 * Plain property access on an un-injected service also throws in Cordis, so
 * `ctx.get` — the same optional accessor the built-in agent-default-model
 * plugin uses for this service — is the only way to probe it safely.
 */
function configEditorOf(ctx) {
  try {
    if (typeof ctx.get === 'function') return ctx.get('configEditor')
    return ctx.configEditor
  } catch {
    return undefined
  }
}

function canConfigure(ctx) {
  try {
    return Boolean(typeof configEditorOf(ctx)?.edit === 'function' && findOwnEntry(ctx))
  } catch {
    return false
  }
}

/** Exports apply; injects the services the ledger reads and serves through. */
export const inject = ['sessionQuery', 'webServer']

export function apply(ctx, rawConfig) {
  const config = readConfig(rawConfig)
  /** @type {Map<string, ReturnType<typeof newSessionState>>} */
  const sessions = new Map()
  const backfilling = new Set()
  const parked = new Map()

  const fold = (session, event) => {
    const id = session.id
    let state = sessions.get(id)
    if (backfilling.has(id)) {
      const queue = parked.get(id) ?? []
      queue.push(event)
      parked.set(id, queue)
      return
    }
    if (!state) {
      state = newSessionState({ createdAt: session.header?.createdAt, cwd: session.header?.cwd })
      sessions.set(id, state)
    }
    foldEvent(state, event, config)
  }

  async function backfill() {
    try {
      const records = await ctx.sessionQuery.listSessions()
      for (const record of records) {
        const id = record.header.id
        backfilling.add(id)
        try {
          const snapshot = await ctx.sessionQuery.readSession(id)
          const state = newSessionState({ createdAt: record.header.createdAt, cwd: record.header.cwd })
          for (const event of snapshot.events) foldEvent(state, event, config)
          sessions.set(id, state)
        } finally {
          backfilling.delete(id)
          const queue = parked.get(id)
          parked.delete(id)
          if (queue) {
            const state = sessions.get(id)
            if (state) for (const event of queue) foldEvent(state, event, config)
          }
        }
      }
    } catch (error) {
      console.error('[usage-ledger] session backfill failed:', error)
    }
  }

  ctx.effect(() => ctx.on('session/event', fold), 'usage-ledger: fold session events')
  ctx.effect(() => void backfill(), 'usage-ledger: backfill existing sessions')

  async function serve(_req, res) {
    const payload = {
      generatedAt: new Date().toISOString(),
      currency: config.currency,
      grand: emptyStat(),
      byDay: {},
      byDayModel: {},
      byModel: {},
      toolNames: {},
      sessions: [],
      ...priceCatalog(config),
      builtinPrices: DEFAULT_PRICES,
      overrides: config.overrides,
      canConfigure: canConfigure(ctx),
    }
    const ids = []
    for (const [id, state] of sessions) {
      const rolled = rollup(state)
      ids.push(id)
      payload.sessions.push({
        id,
        cwd: state.meta.cwd,
        createdAt: state.meta.createdAt,
        firstPrompt: state.firstPrompt ?? undefined,
        ...rolled,
      })
      addStat(payload.grand, rolled.grand)
      for (const [day, stat] of Object.entries(rolled.byDay)) {
        payload.byDay[day] ??= emptyStat()
        addStat(payload.byDay[day], stat)
      }
      for (const [model, stat] of Object.entries(rolled.byModel)) {
        payload.byModel[model] ??= emptyStat()
        addStat(payload.byModel[model], stat)
      }
      // Observed models outside the catalog have no configured price row;
      // extend the source map so clients can flag them as fallback-priced.
      for (const model of Object.keys(rolled.byModel)) {
        payload.priceSource[model] ??= priceSource(config, model)
      }
      for (const [day, models] of Object.entries(rolled.byDayModel)) {
        payload.byDayModel[day] ??= {}
        for (const [model, stat] of Object.entries(models)) {
          payload.byDayModel[day][model] ??= emptyStat()
          addStat(payload.byDayModel[day][model], stat)
        }
      }
      for (const [name, count] of Object.entries(rolled.toolNames)) {
        payload.toolNames[name] = (payload.toolNames[name] ?? 0) + count
      }
    }
    payload.byDay = Object.fromEntries(Object.entries(payload.byDay).sort(([a], [b]) => (a < b ? -1 : 1)))
    payload.grand = finalizeStat(payload.grand)
    for (const stat of Object.values(payload.byDay)) stat.cost = roundCost(stat.cost)
    for (const stat of Object.values(payload.byModel)) stat.cost = roundCost(stat.cost)
    for (const models of Object.values(payload.byDayModel)) {
      for (const stat of Object.values(models)) stat.cost = roundCost(stat.cost)
    }
    payload.sessions.sort((a, b) => b.grand.cost - a.grand.cost)
    try {
      const titles = await ctx.sessionQuery.readTitleSnapshots(ids)
      for (const session of payload.sessions) session.title = readTitle(titles, session.id)
    } catch (error) {
      console.error('[usage-ledger] title lookup failed:', error)
    }
    respondJson(res, 200, payload)
  }

  /**
   * Persists a submitted price table through the host's config editor. The
   * editor validates the next config, rewrites the user's profile patch
   * atomically, and reloads this plugin; the reload refolds every session
   * with the new prices before the dashboard's next GET observes them.
   */
  async function saveConfig(req, res) {
    const editor = configEditorOf(ctx)
    const entry = findOwnEntry(ctx)
    if (!editor || typeof editor.edit !== 'function' || !entry) {
      rejectRequest(req, res, 'config editor is not available', 409)
      return
    }
    let submitted
    try {
      submitted = normalizeSubmitted(await readJsonBody(req))
    } catch (error) {
      rejectRequest(req, res, `invalid config payload: ${error?.message ?? error}`, 400)
      return
    }
    try {
      await editor.edit(entry, nextConfigChange(submitted))
    } catch (error) {
      console.error('[usage-ledger] config save failed:', error)
      rejectRequest(req, res, `save failed: ${error?.message ?? error}`, 500)
      return
    }
    respondJson(res, 200, { ok: true, reloading: true })
  }

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: (req, res) => {
        if (!fence(req, res)) return
        const route = routeOf(req)
        if (req.method === 'GET' && (route === '/' || route === '')) {
          void serve(req, res).catch((error) => {
            console.error('[usage-ledger] serve failed:', error)
            if (!res.headersSent) {
              res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
              res.end('usage-ledger failure')
            } else {
              res.end()
            }
          })
          return
        }
        if (req.method === 'POST' && route === '/config') {
          void saveConfig(req, res).catch((error) => {
            console.error('[usage-ledger] config route failed:', error)
            if (!res.headersSent) {
              res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
              res.end('usage-ledger failure')
            } else {
              res.end()
            }
          })
          return
        }
        rejectRequest(req, res, 'not found', 404)
      },
    }),
    'usage-ledger: /usage-ledger-api route',
  )
}

/** Exports apply; test hook exposing the pure helpers for smoke checks. */
export const _internal = {
  DEFAULT_PRICES,
  FALLBACK_PRICE_KEY,
  PRICE_FIELDS,
  readConfig,
  readOverrides,
  normalizeSubmitted,
  nextConfigChange,
  deepEqual,
  priceFor,
  priceSource,
  priceCatalog,
  foldEvent,
  newSessionState,
  rollup,
  emptyStat,
  canConfigure,
  findOwnEntry,
  configEditorOf,
}

/** Extracts one session's title from a readTitleSnapshots all-settled result
 * array. Each fulfilled entry carries {session, title?}; title is either the
 * display string or the title snapshot ({title, ...}) depending on whether
 * the service found a snapshot.
 */
function readTitle(titleSnapshots, id) {
  if (!Array.isArray(titleSnapshots)) return undefined
  for (const settled of titleSnapshots) {
    if (!settled || settled.status !== 'fulfilled') continue
    const value = settled.value
    if (value?.session?.id !== id) continue
    if (typeof value.title === 'string') return value.title
    if (typeof value.title?.title === 'string') return value.title.title
    return undefined
  }
  return undefined
}
