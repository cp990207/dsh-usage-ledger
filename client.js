/**
 * Client half of the usage-ledger bundle.
 *
 * Registers a rail icon in sidebar.panellist (id 'usage-ledger') and the
 * dashboard page as the 'usage-ledger' row of the keyed main slot; the shell
 * dispatches between them by that entry id. The dashboard reads the Host
 * ledger from /usage-ledger-api and renders range-filtered cards, a daily
 * cost chart, a per-model table, the tool-call ranking, and a per-workspace
 * table that merges the sessions sharing one workspace. A ⚙ Prices button
 * opens a per-model price editor that POSTs to /usage-ledger-api/config;
 * the host persists it into the profile patch and recomputes all costs.
 * Styling uses only --dsw-alias-* theme tokens.
 */

window.__ModuleLoader__.load({
  id: 'dsh-usage-ledger',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const DICTS = {
      zh: {
        'panel.label': '用量账本',
        'page.title': '模型用量账本',
        'page.subtitle': '数据来自本机会话日志；成本为按配置单价的本地估算',
        'range.today': '今日',
        'range.7d': '近 7 天',
        'range.30d': '近 30 天',
        'range.all': '全部',
        'action.refresh': '刷新',
        'action.retry': '重试',
        'card.totalTokens': '总 Token 消耗',
        'hint.totalSum': '输入 + 缓存 + 输出',
        'card.composition': '输入 + 缓存 + 输出',
        'card.cost': '开销',
        'card.requests': '请求次数',
        'card.input': '输入（未缓存）',
        'card.output': '输出',
        'card.cacheHit': '缓存命中率',
        'card.toolShare': '工具请求占比',
        'hint.cacheRW': '读 {read} / 写 {write}',
        'hint.toolChat': '工具 {tool} / 对话 {chat}',
        'hint.allTime': '全部时间累计',
        'section.share': '模型占比',
        'pie.tokens': 'Token 占比',
        'pie.cost': '金额占比',
        'section.daily': '每日开销',
        'section.models': '按模型',
        'section.tools': '工具调用排行（全部时间）',
        'section.sessions': '工作区明细',
        'col.model': '模型',
        'col.requests': '请求',
        'col.input': '输入（未缓存）',
        'col.cacheRW': '缓存（读/写）',
        'col.output': '输出',
        'col.hit': '命中率',
        'col.cost': '开销',
        'col.session': '工作区',
        'col.active': '最近活跃',
        'col.toolShare': '工具占比',
        'col.tokens': 'tokens',
        'col.calls': '次数',
        'state.loading': '加载中…',
        'state.error': '加载失败',
        'state.empty': '所选时间段内没有用量记录',
        'state.moreSessions': '其余 {count} 个工作区未列出',
        'hint.workspaceTip': '{path} · {count} 个会话',
        'note.generated': '生成于 {time}',
        'note.priceFallback': '部分模型未配置单价，按兜底单价估算',
        'note.patchOnly': '当前环境不支持在线修改单价；可在插件配置（cordis.patch.yml 的 usage-ledger 行）中直接填写 currency / prices。',
        'action.prices': '单价设置',
        'price.title': '模型单价配置',
        'price.hint': '单价均为 USD / 1M tokens；模型名取自会话日志与内置目录，未列出的模型按兜底（*）单价估算；保存后自动重算全部开销。',
        'price.currency': '币种标签',
        'price.col.model': '模型',
        'price.col.input': '输入',
        'price.col.output': '输出',
        'price.col.cacheRead': '缓存读',
        'price.col.cacheWrite': '缓存写',
        'price.legend.override': '自定义价',
        'price.legend.builtin': '内置价',
        'price.legend.fallback': '兜底价',
        'price.add': '添加',
        'price.addPlaceholder': '新模型名',
        'price.reset': '还原为基线价（自定义模型则移除该行）',
        'price.save': '保存',
        'price.cancel': '取消',
        'price.saving': '保存中…',
        'price.invalidNumber': '「{model}」的「{field}」不是有效数字',
        'price.invalidModel': '模型名不能为空，且不能与现有行重复',
        'price.saveFailed': '保存失败：{error}',
      },
      en: {
        'panel.label': 'Usage Ledger',
        'page.title': 'Model Usage Ledger',
        'page.subtitle': 'Derived from local session logs; cost is a local estimate from configured prices',
        'range.today': 'Today',
        'range.7d': '7 days',
        'range.30d': '30 days',
        'range.all': 'All',
        'action.refresh': 'Refresh',
        'action.retry': 'Retry',
        'card.totalTokens': 'Total tokens',
        'hint.totalSum': 'input + cache + output',
        'card.composition': 'Input + cache + output',
        'card.cost': 'Cost',
        'card.requests': 'Requests',
        'card.input': 'Input (uncached)',
        'card.output': 'Output',
        'card.cacheHit': 'Cache hit rate',
        'card.toolShare': 'Tool request share',
        'hint.cacheRW': 'read {read} / write {write}',
        'hint.toolChat': 'tool {tool} / chat {chat}',
        'hint.allTime': 'all-time totals',
        'section.share': 'Model share',
        'pie.tokens': 'Token share',
        'pie.cost': 'Cost share',
        'section.daily': 'Daily cost',
        'section.models': 'By model',
        'section.tools': 'Tool calls (all time)',
        'section.sessions': 'Workspace breakdown',
        'col.model': 'Model',
        'col.requests': 'Requests',
        'col.input': 'Input (uncached)',
        'col.cacheRW': 'Cache (read/write)',
        'col.output': 'Output',
        'col.hit': 'Hit rate',
        'col.cost': 'Cost',
        'col.session': 'Workspace',
        'col.active': 'Last active',
        'col.toolShare': 'Tool share',
        'col.tokens': 'tokens',
        'col.calls': 'Calls',
        'state.loading': 'Loading…',
        'state.error': 'Load failed',
        'state.empty': 'No usage recorded in this range',
        'state.moreSessions': '{count} more workspaces not listed',
        'hint.workspaceTip': '{count} sessions · {path}',
        'note.generated': 'Generated at {time}',
        'note.priceFallback': 'Some models have no configured price; the fallback price was applied',
        'note.patchOnly': 'Price editing is unavailable in this environment; set currency / prices directly in the plugin config (the usage-ledger row of cordis.patch.yml).',
        'action.prices': 'Prices',
        'price.title': 'Model Price Configuration',
        'price.hint': 'Prices are USD per 1M tokens; model names come from the session logs and the built-in catalog, models without a row are estimated at the (*) fallback price; saving recomputes all costs.',
        'price.currency': 'Currency label',
        'price.col.model': 'Model',
        'price.col.input': 'Input',
        'price.col.output': 'Output',
        'price.col.cacheRead': 'Cache read',
        'price.col.cacheWrite': 'Cache write',
        'price.legend.override': 'Custom',
        'price.legend.builtin': 'Built-in',
        'price.legend.fallback': 'Fallback',
        'price.add': 'Add',
        'price.addPlaceholder': 'New model name',
        'price.reset': 'Reset to baseline (custom rows are removed)',
        'price.save': 'Save',
        'price.cancel': 'Cancel',
        'price.saving': 'Saving…',
        'price.invalidNumber': '"{model}" field "{field}" is not a valid number',
        'price.invalidModel': 'Model name must be non-empty and unique',
        'price.saveFailed': 'Save failed: {error}',
      },
    }

    const STYLE = `
.ul-page { height: 100%; overflow-y: auto; box-sizing: border-box; padding: 24px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 13px; }
.ul-page *, .ul-page *::before, .ul-page *::after { box-sizing: border-box; }
.ul-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.ul-title { font-size: 18px; font-weight: 600; margin: 0; }
.ul-subtitle { color: var(--dsw-alias-label-secondary); font-size: 12px; margin: 0; }
.ul-spacer { flex: 1; }
.ul-seg { display: inline-flex; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
.ul-seg button { border: 0; background: transparent; color: var(--dsw-alias-label-secondary);
  padding: 5px 12px; font-size: 12px; cursor: pointer; }
.ul-seg button + button { border-left: 1px solid var(--dsw-alias-border-l1); }
.ul-seg button[data-active='true'] { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.ul-btn { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.ul-btn:hover, .ul-seg button:hover { filter: brightness(1.08); }
.ul-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.ul-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 12px; }
.ul-card-label { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 6px; }
.ul-card-value { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ul-card-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 4px; }
.ul-card-hero .ul-card-value { font-size: 26px; color: var(--dsw-alias-brand-primary); }
.ul-comp { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ul-cols { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; }
/* First row: the share pies need more room than the daily bars, so widen the right column. */
.ul-cols-right-wide { grid-template-columns: 2fr 3fr; }
.ul-panel { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 14px; margin-bottom: 16px; min-width: 0; }
.ul-cols .ul-panel { margin-bottom: 0; }
.ul-panel-title { font-size: 13px; font-weight: 600; margin: 0 0 10px; }
.ul-pies { display: flex; gap: 16px; flex-wrap: wrap; }
.ul-pie { flex: 1; min-width: 170px; }
.ul-pie-title { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 8px; }
.ul-pie-body { display: flex; align-items: center; gap: 14px; }
.ul-pie-legend { display: flex; flex-direction: column; gap: 4px; font-size: 11px; min-width: 0; }
.ul-legend-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.ul-legend-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
.ul-dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 5px; vertical-align: middle; flex: none; }
.ul-chart { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
.ul-bar { flex: 1; background: var(--dsw-alias-brand-primary); border-radius: 2px 2px 0 0; opacity: 0.85; }
.ul-bar:hover { opacity: 1; }
.ul-chart-axes { display: flex; gap: 3px; margin-top: 4px; }
.ul-chart-axis { flex: 1; font-size: 10px; color: var(--dsw-alias-label-secondary); text-align: center; overflow: hidden; }
.ul-table-wrap { overflow-x: auto; max-width: 100%; }
.ul-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ul-table th { text-align: left; color: var(--dsw-alias-label-secondary); font-weight: 500;
  padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); white-space: nowrap; }
.ul-table td { padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  white-space: nowrap; font-variant-numeric: tabular-nums; }
.ul-table tbody tr:hover td { background: var(--dsw-alias-bg-layer-2); }
/* .ul-table th would out-specific a bare .ul-num; re-anchor under .ul-table so numeric th/td both center. */
.ul-table .ul-num { text-align: center; }
.ul-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ul-chip { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; padding: 3px 10px; font-size: 11px; }
.ul-chip b { font-weight: 600; }
.ul-muted { color: var(--dsw-alias-label-secondary); }
.ul-ellipsis { display: block; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ul-state { padding: 48px 0; text-align: center; color: var(--dsw-alias-label-secondary); }
.ul-state button { margin-left: 8px; }
.ul-error-text { color: var(--dsw-alias-state-error-primary); }
.ul-note { margin-top: 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ul-rail { display: inline-flex; align-items: center; justify-content: center; }
/* Price config modal: scrim + scrollable per-model price rows. */
.ul-price-btn { font-weight: 600; }
.ul-scrim { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(2px); }
.ul-modal { width: min(720px, calc(100vw - 48px)); max-height: min(78vh, 640px); display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35); padding: 16px; }
.ul-modal-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.ul-modal-title { font-size: 15px; font-weight: 600; margin: 0; flex: 1; }
.ul-modal-currency { display: inline-flex; align-items: center; gap: 6px; font-size: 11px;
  color: var(--dsw-alias-label-secondary); }
.ul-modal-currency input { width: 56px; }
.ul-modal input[type='text'], .ul-modal input[type='number'] { background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  padding: 4px 8px; font-size: 12px; min-width: 0; width: 100%; }
.ul-modal input[type='text']:focus, .ul-modal input[type='number']:focus { outline: 1px solid var(--dsw-alias-brand-primary); }
.ul-modal input[type='number'] { text-align: right; font-variant-numeric: tabular-nums; }
.ul-modal input[type='number']::-webkit-outer-spin-button,
.ul-modal input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ul-modal input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
.ul-modal-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 10px; line-height: 1.5; }
.ul-price-head, .ul-price-row { display: grid; grid-template-columns: minmax(0, 1.7fr) repeat(4, minmax(70px, 1fr)) 26px;
  gap: 6px; align-items: center; }
.ul-price-head { font-size: 11px; color: var(--dsw-alias-label-secondary); padding: 0 2px 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ul-price-head .ul-num, .ul-price-row .ul-num { text-align: right; }
.ul-modal-list { overflow-y: auto; min-height: 0; padding: 8px 2px; display: flex; flex-direction: column; gap: 6px; }
.ul-model-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ul-model-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ul-row-btn { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
  font-size: 13px; width: 22px; height: 22px; border-radius: 6px; line-height: 1; flex: none; padding: 0; }
.ul-row-btn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.ul-row-btn:disabled { opacity: 0.5; cursor: default; }
.ul-add-row { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--dsw-alias-border-l1); }
.ul-modal-foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.ul-legend { display: flex; gap: 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); flex: 1;
  flex-wrap: wrap; min-width: 0; }
.ul-btn-primary { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); border-color: transparent; }
@media (max-width: 900px) { .ul-cols { grid-template-columns: 1fr; } }
`

    function fmtInt(value) {
      return Math.round(value).toLocaleString()
    }

    function fmtTokens(value) {
      if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'
      if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M'
      if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K'
      return String(Math.round(value))
    }

    function currencySymbol(currency) {
      return currency === 'USD' ? '$' : currency === 'CNY' ? '¥' : currency === 'EUR' ? '€' : currency + ' '
    }

    function fmtCost(value, symbol) {
      const amount = value >= 100 ? value.toFixed(1) : value >= 1 ? value.toFixed(2) : value.toFixed(4)
      return symbol + amount
    }

    function fmtPct(ratio) {
      return (ratio * 100).toFixed(1) + '%'
    }

    function dayString(date) {
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${date.getFullYear()}-${month}-${day}`
    }

    function shiftDay(day, delta) {
      const [y, m, d] = day.split('-').map(Number)
      return dayString(new Date(y, m - 1, d + delta))
    }

    function cutoffFor(range, today) {
      if (range === 'today') return today
      if (range === '7d') return shiftDay(today, -6)
      if (range === '30d') return shiftDay(today, -29)
      return '0000-00'
    }

    function addInto(target, source) {
      target.input += source.input
      target.output += source.output
      target.cacheRead += source.cacheRead
      target.cacheWrite += source.cacheWrite
      target.reasoning += source.reasoning
      target.requests += source.requests
      target.toolRequests += source.toolRequests
      target.chatRequests += source.chatRequests
      target.cost += source.cost
    }

    function emptySum() {
      return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, requests: 0, toolRequests: 0, chatRequests: 0, cost: 0 }
    }

    function PanelIcon() {
      return h('span', { className: 'ul-rail', 'aria-hidden': true },
        h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' },
          h('path', { d: 'M5 20h14' }),
          h('path', { d: 'M7 20v-5' }),
          h('path', { d: 'M12 20v-9' }),
          h('path', { d: 'M17 20V6' }),
        ),
      )
    }

    function Card({ label, value, hint, hero }) {
      return h('div', { className: hero ? 'ul-card ul-card-hero' : 'ul-card' },
        h('div', { className: 'ul-card-label' }, label),
        h('div', { className: 'ul-card-value' }, value),
        hint ? h('div', { className: 'ul-card-hint' }, hint) : null,
      )
    }

    /**
     * Categorical color for share index i: the brand token stepped down in
     * opacity — the theme only ships semantic tokens, so series are shades
     * of one accent (same approach as the daily bar chart).
     */
    function shareColor(index) {
      return { color: 'var(--dsw-alias-brand-primary)', opacity: Math.max(0.25, 1 - index * 0.22) }
    }

    /** Entries of one share series (model → value), largest first. */
    function shareEntries(modelRows, valueOf) {
      const entries = modelRows
        .map(([model, stat]) => ({ model, value: valueOf(stat) }))
        .filter((entry) => entry.value > 0)
      entries.sort((a, b) => b.value - a.value)
      const total = entries.reduce((acc, entry) => acc + entry.value, 0)
      return { entries, total }
    }

    /**
     * Donut rendered as SVG circle dash segments, starting at 12 o'clock.
     * Segments smaller than the stroke still get a visible sliver.
     */
    function Donut({ entries, total, format }) {
      const size = 96
      const radius = 38
      const stroke = 13
      const circumference = 2 * Math.PI * radius
      let drawn = 0
      return h('svg', {
        width: size, height: size, viewBox: `0 0 ${size} ${size}`,
        style: { transform: 'rotate(-90deg)', flex: 'none' }, 'aria-hidden': true,
      },
        h('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'none', stroke: 'var(--dsw-alias-bg-layer-2)', strokeWidth: stroke }),
        entries.map((entry, index) => {
          const fraction = entry.value / total
          const segment = h('circle', {
            key: entry.model, cx: size / 2, cy: size / 2, r: radius,
            fill: 'none', stroke: shareColor(index).color, strokeOpacity: shareColor(index).opacity,
            strokeWidth: stroke, strokeDasharray: `${Math.max(0.01, fraction) * circumference} ${circumference}`,
            strokeDashoffset: -drawn * circumference,
          }, h('title', null, `${entry.model} · ${format(entry.value)} · ${fmtPct(fraction)}`))
          drawn += fraction
          return segment
        }),
      )
    }

    /** One donut + legend pair under a small caption. */
    function SharePie({ title, series, format }) {
      if (series.total <= 0) return null
      return h('div', { className: 'ul-pie' },
        h('div', { className: 'ul-pie-title' }, title),
        h('div', { className: 'ul-pie-body' },
          h(Donut, { entries: series.entries, total: series.total, format }),
          h('div', { className: 'ul-pie-legend' },
            series.entries.map((entry, index) => h('div', { key: entry.model, className: 'ul-legend-row', title: `${entry.model} · ${format(entry.value)}` },
              h('span', { className: 'ul-dot', style: { background: shareColor(index).color, opacity: shareColor(index).opacity } }),
              h('span', { className: 'ul-legend-name' }, entry.model),
              h('span', { className: 'ul-muted' }, fmtPct(entry.value / series.total)),
            )),
          ),
        ),
      )
    }

    const PRICE_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite']
    const PRICE_FALLBACK_KEY = '*'

    /** Case-insensitive key lookup that never matches the fallback key. */
    function findKeyCi(table, model) {
      if (!table || typeof model !== 'string') return undefined
      if (model !== PRICE_FALLBACK_KEY && Object.hasOwn(table, model)) return model
      const lower = model.toLowerCase()
      for (const key of Object.keys(table)) {
        if (key !== PRICE_FALLBACK_KEY && key.toLowerCase() === lower) return key
      }
      return undefined
    }

    function fmtPriceInput(value) {
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0'
    }

    /** Empty → 0 (the host fills missing fields the same way); invalid → null. */
    function parsePriceInput(text) {
      const trimmed = String(text ?? '').trim()
      if (trimmed === '') return 0
      const value = Number(trimmed)
      return Number.isFinite(value) && value >= 0 ? value : null
    }

    function legendDot(label, color, opacity) {
      return h('span', { key: label, className: 'ul-legend-row' },
        h('span', { className: 'ul-dot', style: { background: color, opacity } }), label)
    }

    /* Status dots prefer the theme's semantic tokens; the hex fallback keeps
     * them readable if a token is unavailable in some shell version. */
    const DOT_OK = 'var(--dsw-alias-state-success-primary, #22a06b)'
    const DOT_WARN = 'var(--dsw-alias-state-warning-primary, #f59e0b)'

    /**
     * Per-model price editor. Every row is pre-filled with its effective
     * price (override > built-in > fallback), so what the user sees is what
     * gets saved, and a row is persisted only when its values differ from
     * the baseline — untouched built-in rows keep following the catalog the
     * plugin ships with.
     */
    function PriceModal({ t, payload, onClose, onSaved }) {
      const [currency, setCurrency] = React.useState(payload.currency || 'USD')
      const [phase, setPhase] = React.useState('edit') // edit | saving | reload
      const [error, setError] = React.useState(null)
      const [rows, setRows] = React.useState(() => {
        const rows = []
        const seen = new Set()
        const fallback = payload.builtinPrices?.[PRICE_FALLBACK_KEY] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        const pushRow = (rawModel) => {
          const model = findKeyCi(payload.priceTable, rawModel) ?? rawModel
          if (seen.has(model.toLowerCase())) return
          seen.add(model.toLowerCase())
          const price = payload.priceTable[model] ?? fallback
          const baseKey = findKeyCi(payload.builtinPrices ?? {}, model)
          const baseline = baseKey !== undefined ? payload.builtinPrices[baseKey] : fallback
          rows.push({
            model,
            observed: Object.keys(payload.byModel ?? {}).some((name) => name.toLowerCase() === model.toLowerCase()),
            builtin: baseKey !== undefined,
            baseline,
            values: {
              input: fmtPriceInput(price.input),
              output: fmtPriceInput(price.output),
              cacheRead: fmtPriceInput(price.cacheRead),
              cacheWrite: fmtPriceInput(price.cacheWrite),
            },
          })
        }
        for (const [model, stat] of Object.entries(payload.byModel ?? {}).sort((a, b) => b[1].cost - a[1].cost)) pushRow(model)
        for (const model of Object.keys(payload.builtinPrices ?? {}).filter((key) => key !== PRICE_FALLBACK_KEY).sort()) pushRow(model)
        for (const model of Object.keys(payload.overrides ?? {}).sort()) pushRow(model)
        return rows
      })
      const [newModel, setNewModel] = React.useState('')
      const saving = phase !== 'edit'

      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose, saving])

      const setRowValue = (index, field, value) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, values: { ...row.values, [field]: value } } : row)))
      }

      /** Restore baseline values; a custom, never-observed row is dropped. */
      const resetRow = (index) => {
        setRows((prev) => prev
          .map((row, i) => (i === index
            ? {
              ...row,
              values: {
                input: fmtPriceInput(row.baseline.input),
                output: fmtPriceInput(row.baseline.output),
                cacheRead: fmtPriceInput(row.baseline.cacheRead),
                cacheWrite: fmtPriceInput(row.baseline.cacheWrite),
              },
            }
            : row))
          .filter((row, i) => i !== index || row.builtin || row.observed))
      }

      const addRow = () => {
        const model = newModel.trim()
        if (!model || model === PRICE_FALLBACK_KEY) { setError(t('price.invalidModel')); return }
        const key = findKeyCi(payload.priceTable, model) ?? model
        if (rows.some((row) => row.model.toLowerCase() === key.toLowerCase())) { setError(t('price.invalidModel')); return }
        setRows((prev) => [...prev, {
          model: key, observed: false, builtin: false, baseline: fallback,
          values: {
            input: fmtPriceInput(fallback.input),
            output: fmtPriceInput(fallback.output),
            cacheRead: fmtPriceInput(fallback.cacheRead),
            cacheWrite: fmtPriceInput(fallback.cacheWrite),
          },
        }])
        setNewModel('')
        setError(null)
      }

      const rowSource = (row) => {
        const differs = PRICE_FIELDS.some((field) => parsePriceInput(row.values[field]) !== row.baseline[field])
        if (differs || !row.builtin) return 'override'
        return row.observed ? 'fallback' : 'builtin'
      }

      const save = async () => {
        const prices = {}
        for (const row of rows) {
          const values = {}
          for (const field of PRICE_FIELDS) {
            const value = parsePriceInput(row.values[field])
            if (value === null) {
              setError(t('price.invalidNumber').replace('{model}', row.model).replace('{field}', field))
              return
            }
            values[field] = value
          }
          if (PRICE_FIELDS.some((field) => values[field] !== row.baseline[field])) prices[row.model] = values
        }
        setPhase('saving')
        setError(null)
        try {
          const res = await fetch('/usage-ledger-api/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ currency: currency.trim() || payload.currency || 'USD', prices }),
          })
          if (!res.ok) {
            const detail = await res.text().catch(() => '')
            throw new Error('HTTP ' + res.status + (detail ? ' ' + detail : ''))
          }
        } catch (err) {
          setError(t('price.saveFailed').replace('{error}', String((err && err.message) || err)))
          setPhase('edit')
          return
        }
        setPhase('reload')
        // The host reloads this plugin after the config edit (the ledger
        // route briefly disappears); poll until it answers again, then
        // refresh the dashboard with recomputed costs.
        for (let i = 0; i < 40; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          try {
            const res = await fetch('/usage-ledger-api', { headers: { accept: 'application/json' } })
            if (res.ok) break
          } catch {}
        }
        onSaved()
      }

      return h('div', {
        className: 'ul-scrim',
        onMouseDown: (event) => { if (event.target === event.currentTarget && !saving) onClose() },
      },
        h('div', { className: 'ul-modal', role: 'dialog', 'aria-modal': true, 'aria-label': t('price.title') },
          h('div', { className: 'ul-modal-head' },
            h('h3', { className: 'ul-modal-title' }, t('price.title')),
            h('label', { className: 'ul-modal-currency' }, t('price.currency'),
              h('input', { type: 'text', value: currency, maxLength: 16, disabled: saving,
                onChange: (event) => setCurrency(event.target.value) })),
          ),
          h('div', { className: 'ul-modal-hint' }, t('price.hint')),
          h('div', { className: 'ul-price-head' },
            h('span', null, t('price.col.model')),
            h('span', { className: 'ul-num' }, t('price.col.input')),
            h('span', { className: 'ul-num' }, t('price.col.output')),
            h('span', { className: 'ul-num' }, t('price.col.cacheRead')),
            h('span', { className: 'ul-num' }, t('price.col.cacheWrite')),
            h('span'),
          ),
          h('div', { className: 'ul-modal-list' },
            rows.map((row, index) => {
              const source = rowSource(row)
              const removable = row.builtin ? source === 'override' : true
              const dot = source === 'fallback' ? DOT_WARN : DOT_OK
              const dotOpacity = source === 'builtin' ? 0.35 : 1
              return h('div', { className: 'ul-price-row', key: row.model },
                h('span', { className: 'ul-model-name', title: row.model },
                  h('span', { className: 'ul-dot', style: { background: dot, opacity: dotOpacity } }),
                  h('span', { className: 'ul-model-text' }, row.model)),
                PRICE_FIELDS.map((field) => h('input', {
                  key: field, type: 'number', step: 'any', min: 0, disabled: saving,
                  value: row.values[field],
                  onChange: (event) => setRowValue(index, field, event.target.value),
                })),
                removable
                  ? h('button', { className: 'ul-row-btn', title: t('price.reset'), disabled: saving, onClick: () => resetRow(index) }, '✕')
                  : h('span'),
              )
            }),
            h('div', { className: 'ul-price-row ul-add-row', key: '__add' },
              h('input', { type: 'text', placeholder: t('price.addPlaceholder'), value: newModel, disabled: saving,
                onChange: (event) => setNewModel(event.target.value),
                onKeyDown: (event) => { if (event.key === 'Enter') addRow() } }),
              h('button', { className: 'ul-btn', style: { gridColumn: '2 / span 5', justifySelf: 'start' },
                disabled: saving, onClick: addRow }, t('price.add')),
            ),
          ),
          error ? h('div', { className: 'ul-error-text', style: { marginTop: 8, fontSize: 12 } }, error) : null,
          h('div', { className: 'ul-modal-foot' },
            h('div', { className: 'ul-legend' },
              legendDot(t('price.legend.override'), DOT_OK, 1),
              legendDot(t('price.legend.builtin'), DOT_OK, 0.35),
              legendDot(t('price.legend.fallback'), DOT_WARN, 1),
            ),
            h('button', { className: 'ul-btn', disabled: saving, onClick: onClose }, t('price.cancel')),
            h('button', { className: 'ul-btn ul-btn-primary', disabled: saving, onClick: () => { void save() } },
              phase === 'edit' ? t('price.save') : t('price.saving')),
          ),
        ),
      )
    }

    function Dashboard({ t, ...rest }) {
      const [state, setState] = React.useState({ status: 'loading' })
      const [range, setRange] = React.useState('30d')
      const [priceOpen, setPriceOpen] = React.useState(false)
      const symbol = currencySymbol((state.data && state.data.currency) || 'USD')

      const load = React.useCallback(async () => {
        setState((prev) => ({ status: 'loading', data: prev.data }))
        try {
          const res = await fetch('/usage-ledger-api', { headers: { accept: 'application/json' } })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const data = await res.json()
          setState({ status: 'ready', data })
        } catch (error) {
          setState({ status: 'error', error: String((error && error.message) || error) })
        }
      }, [])

      React.useEffect(() => {
        void load()
      }, [load])

      const view = React.useMemo(() => {
        if (state.status !== 'ready') return null
        const data = state.data
        const today = dayString(new Date(data.generatedAt))
        const cutoff = cutoffFor(range, today)
        const dayKeys = Object.keys(data.byDay ?? {}).filter((day) => day >= cutoff).sort()
        const grand = emptySum()
        for (const day of dayKeys) addInto(grand, data.byDay[day])
        const byModel = new Map()
        for (const day of dayKeys) {
          for (const [model, stat] of Object.entries(data.byDayModel?.[day] ?? {})) {
            if (!byModel.has(model)) byModel.set(model, emptySum())
            addInto(byModel.get(model), stat)
          }
        }
        const workspaces = []
        const byCwd = new Map()
        for (const session of data.sessions ?? []) {
          const sum = emptySum()
          let lastDay = null
          for (const day of dayKeys) {
            const stat = session.byDay?.[day]
            if (!stat) continue
            addInto(sum, stat)
            lastDay = day
          }
          if (sum.requests === 0 && sum.cost === 0) continue
          const cwd = typeof session.cwd === 'string' && session.cwd.length > 0 ? session.cwd : null
          const key = cwd ?? `#${session.id}`
          let row = byCwd.get(key)
          if (!row) {
            row = { cwd, name: cwd ? cwd.split(/[\\/]/).pop() : session.id.slice(0, 8), sum: emptySum(), lastDay: null, count: 0 }
            byCwd.set(key, row)
            workspaces.push(row)
          }
          addInto(row.sum, sum)
          row.count += 1
          if (lastDay !== null && (row.lastDay === null || lastDay > row.lastDay)) row.lastDay = lastDay
        }
        workspaces.sort((a, b) => b.sum.cost - a.sum.cost)
        const maxDayCost = Math.max(1e-9, ...dayKeys.map((day) => data.byDay[day].cost))
        return {
          today, dayKeys, grand, byModel, workspaces, maxDayCost,
          toolShare: grand.requests > 0 ? grand.toolRequests / grand.requests : 0,
          cacheHit: grand.input + grand.cacheRead + grand.cacheWrite > 0
            ? grand.cacheRead / (grand.input + grand.cacheRead + grand.cacheWrite) : 0,
        }
      }, [state, range])

      const ranges = [['today', t('range.today')], ['7d', t('range.7d')], ['30d', t('range.30d')], ['all', t('range.all')]]

      let body = null
      if (state.status === 'loading' && !state.data) {
        body = h('div', { className: 'ul-state' }, t('state.loading'))
      } else if (state.status === 'error') {
        body = h('div', { className: 'ul-state' },
          h('span', { className: 'ul-error-text' }, t('state.error') + ' — ' + state.error),
          h('button', { className: 'ul-btn', onClick: () => { void load() } }, t('action.retry')),
        )
      } else if (view) {
        const { grand } = view
        if (grand.requests === 0) {
          body = h('div', { className: 'ul-state' }, t('state.empty'))
        } else {
          const modelRows = [...view.byModel].sort((a, b) => b[1].cost - a[1].cost)
          const toolRows = Object.entries(state.data.toolNames ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
          const workspaceRows = view.workspaces.slice(0, 30)
          const tokenShares = shareEntries(modelRows, (stat) => stat.input + stat.output + stat.cacheRead + stat.cacheWrite)
          const costShares = shareEntries(modelRows, (stat) => stat.cost)
          body = [
            h('div', { className: 'ul-cards', key: 'cards' },
              h(Card, {
                label: t('card.totalTokens'), hero: true,
                value: fmtTokens(grand.input + grand.cacheRead + grand.cacheWrite + grand.output),
                hint: t('hint.totalSum'),
              }),
              h(Card, {
                label: t('card.composition'),
                value: h('span', { className: 'ul-comp' },
                  fmtTokens(grand.input), ' + ',
                  fmtTokens(grand.cacheRead + grand.cacheWrite), ' + ',
                  fmtTokens(grand.output)),
              }),
              h(Card, { label: t('card.cost'), value: fmtCost(grand.cost, symbol) }),
              h(Card, { label: t('card.requests'), value: fmtInt(grand.requests) }),
              h(Card, { label: t('card.input'), value: fmtTokens(grand.input), hint: `+ ${fmtTokens(grand.cacheRead + grand.cacheWrite)} cache` }),
              h(Card, { label: t('card.output'), value: fmtTokens(grand.output) }),
              h(Card, {
                label: t('card.cacheHit'), value: fmtPct(view.cacheHit),
                hint: t('hint.cacheRW').replace('{read}', fmtTokens(grand.cacheRead)).replace('{write}', fmtTokens(grand.cacheWrite)),
              }),
              h(Card, {
                label: t('card.toolShare'), value: fmtPct(view.toolShare),
                hint: t('hint.toolChat').replace('{tool}', fmtInt(grand.toolRequests)).replace('{chat}', fmtInt(grand.chatRequests)),
              }),
            ),
            h('div', { className: 'ul-cols ul-cols-right-wide', key: 'cols' },
              h('div', { className: 'ul-panel' },
                h('div', { className: 'ul-panel-title' }, t('section.daily')),
                h('div', { className: 'ul-chart' },
                  view.dayKeys.map((day) => h('div', {
                    key: day, className: 'ul-bar',
                    style: { height: Math.max(2, (state.data.byDay[day].cost / view.maxDayCost) * 100) + '%' },
                    title: `${day} · ${fmtCost(state.data.byDay[day].cost, symbol)} · ${fmtTokens(state.data.byDay[day].input + state.data.byDay[day].cacheRead + state.data.byDay[day].cacheWrite + state.data.byDay[day].output)} ${t('col.tokens')}`,
                  })),
                ),
                h('div', { className: 'ul-chart-axes' },
                  view.dayKeys.map((day, index) => (index === 0 || index === view.dayKeys.length - 1
                    ? h('div', { key: day, className: 'ul-chart-axis' }, day.slice(5))
                    : h('div', { key: day }))),
                ),
              ),
              h('div', { className: 'ul-panel' },
                h('div', { className: 'ul-panel-title' }, t('section.share')),
                h('div', { className: 'ul-pies' },
                  h(SharePie, { title: t('pie.tokens'), series: tokenShares, format: fmtTokens }),
                  h(SharePie, { title: t('pie.cost'), series: costShares, format: (value) => fmtCost(value, symbol) }),
                ),
              ),
            ),
            h('div', { className: 'ul-panel', key: 'models', style: { marginTop: 16 } },
              h('div', { className: 'ul-panel-title' }, t('section.models')),
              h('div', { className: 'ul-table-wrap' },
                h('table', { className: 'ul-table' },
                  h('thead', null, h('tr', null,
                    h('th', null, t('col.model')),
                    h('th', { className: 'ul-num' }, t('col.requests')),
                    h('th', { className: 'ul-num' }, t('col.input')),
                    h('th', { className: 'ul-num' }, t('col.cacheRW')),
                    h('th', { className: 'ul-num' }, t('col.output')),
                    h('th', { className: 'ul-num' }, t('col.hit')),
                    h('th', { className: 'ul-num' }, t('col.cost')),
                  )),
                  h('tbody', null, modelRows.map(([model, stat]) => h('tr', { key: model },
                    h('td', null, model),
                    h('td', { className: 'ul-num' }, fmtInt(stat.requests)),
                    h('td', { className: 'ul-num' }, fmtTokens(stat.input)),
                    h('td', { className: 'ul-num' }, `${fmtTokens(stat.cacheRead)} / ${fmtTokens(stat.cacheWrite)}`),
                    h('td', { className: 'ul-num' }, fmtTokens(stat.output)),
                    h('td', { className: 'ul-num' }, fmtPct(stat.input + stat.cacheRead + stat.cacheWrite > 0
                      ? stat.cacheRead / (stat.input + stat.cacheRead + stat.cacheWrite) : 0)),
                    h('td', { className: 'ul-num' }, fmtCost(stat.cost, symbol)),
                  ))),
                ),
              ),
            ),
            h('div', { className: 'ul-cols', key: 'tools-sessions', style: { marginTop: 16 } },
              h('div', { className: 'ul-panel' },
                h('div', { className: 'ul-panel-title' }, t('section.sessions')),
                h('div', { className: 'ul-table-wrap' },
                  h('table', { className: 'ul-table' },
                    h('thead', null, h('tr', null,
                      h('th', null, t('col.session')),
                      h('th', null, t('col.active')),
                      h('th', { className: 'ul-num' }, t('col.requests')),
                      h('th', { className: 'ul-num' }, t('col.toolShare')),
                      h('th', { className: 'ul-num' }, t('col.tokens')),
                      h('th', { className: 'ul-num' }, t('col.cost')),
                    )),
                    h('tbody', null, workspaceRows.map(({ cwd, name, sum, lastDay, count }) => {
                      const tip = t('hint.workspaceTip').replace('{path}', cwd ?? name).replace('{count}', String(count))
                      return h('tr', { key: cwd ?? name, title: tip },
                        h('td', null,
                          h('span', { className: 'ul-ellipsis' }, name,
                            count > 1 ? h('span', { className: 'ul-muted' }, ` · ${count}`) : null)),
                        h('td', { className: 'ul-muted' }, lastDay ?? '—'),
                        h('td', { className: 'ul-num' }, fmtInt(sum.requests)),
                        h('td', { className: 'ul-num' }, fmtPct(sum.requests > 0 ? sum.toolRequests / sum.requests : 0)),
                        h('td', { className: 'ul-num' }, fmtTokens(sum.input + sum.cacheRead + sum.cacheWrite + sum.output)),
                        h('td', { className: 'ul-num' }, fmtCost(sum.cost, symbol)),
                      )
                    })),
                  ),
                ),
                view.workspaces.length > workspaceRows.length
                  ? h('div', { className: 'ul-note' }, t('state.moreSessions').replace('{count}', String(view.workspaces.length - workspaceRows.length)))
                  : null,
              ),
              h('div', { className: 'ul-panel' },
                h('div', { className: 'ul-panel-title' }, t('section.tools')),
                toolRows.length === 0
                  ? h('div', { className: 'ul-muted' }, t('state.empty'))
                  : h('div', { className: 'ul-chips' }, toolRows.map(([name, count]) =>
                    h('span', { key: name, className: 'ul-chip' }, name, ' ', h('b', null, fmtInt(count))))),
                h('div', { className: 'ul-note' }, t('hint.allTime')),
              ),
            ),
          ]
        }
      }

      return h('div', { className: 'ul-page' },
        h('style', null, STYLE),
        h('div', { className: 'ul-header' },
          h('h2', { className: 'ul-title' }, t('page.title')),
          h('span', { className: 'ul-subtitle' }, t('page.subtitle')),
          h('div', { className: 'ul-spacer' }),
          h('div', { className: 'ul-seg' }, ranges.map(([id, label]) =>
            h('button', { key: id, 'data-active': range === id, onClick: () => setRange(id) }, label))),
          state.status === 'ready' && state.data && state.data.canConfigure
            ? h('button', { className: 'ul-btn ul-price-btn', title: t('price.title'), onClick: () => setPriceOpen(true) },
              '⚙ ', t('action.prices'))
            : null,
          h('button', { className: 'ul-btn', onClick: () => { void load() } }, t('action.refresh')),
        ),
        body,
        state.status === 'ready' && state.data && view
          && [...view.byModel.keys()].some((model) => (state.data.priceSource ?? {})[model] === 'fallback')
          ? h('div', { className: 'ul-note' }, t('note.priceFallback'))
          : null,
        state.status === 'ready' && state.data && !state.data.canConfigure
          ? h('div', { className: 'ul-note' }, t('note.patchOnly'))
          : null,
        state.status === 'ready' && state.data
          ? h('div', { className: 'ul-note' }, t('note.generated').replace('{time}', new Date(state.data.generatedAt).toLocaleString()))
          : null,
        priceOpen && state.status === 'ready' && state.data
          ? h(PriceModal, {
            t, payload: state.data,
            onClose: () => setPriceOpen(false),
            onSaved: () => { setPriceOpen(false); void load() },
          })
          : null,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [locale, dict] of Object.entries(DICTS)) {
          ctx.effect(() => ctx.locale.register('usageLedger', locale, dict), `usage-ledger: ${locale} dictionary`)
        }
        const t = ctx.locale.bind('usageLedger')

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'usage-ledger',
          order: 90,
          label: () => t('panel.label'),
        }, PanelIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'usage-ledger',
        }, (props) => h(Dashboard, { t, ...props })))
      },
    }
  },
})
