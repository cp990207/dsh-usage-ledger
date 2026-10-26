# Usage Ledger（用量账本）

A local-first usage ledger for DeepSeek Harness: mines the session logs on this
machine and reports per-day / per-model / per-workspace token consumption,
cache hit rate, tool-vs-chat split, and an estimated cost.

本地用量账本插件：从本机会话日志统计每日 / 每模型 / 每工作区的 token 消耗、缓存命中率、工具请求占比，并按配置单价估算开销。

## Install

Install it as a DeepSeek Harness plugin from this repository — in the desktop
app open the plugin market (插件市场) install field and paste:

```
github:cp990207/dsh-usage-ledger
```

Or from a local clone, point the same field at the absolute path of the
checkout. The bundle patch registers the `usage-ledger` entry with the ledger
dashboard in the header; no extra configuration is needed.

## Features

- Daily token & cost overview with today / 7d / 30d / all-time range filters
- Per-model table: requests, uncached input, cache read/write, output, hit rate, cost
- Share pies (tokens & cost), daily cost bar chart
- Workspace breakdown (sessions merged by cwd) and tool-call ranking
- **Price configuration**: a ⚙ Prices button in the header opens a per-model
  price editor (input / output / cache read / cache write, per 1M tokens)

## How pricing works

1. **Built-in catalog** — the plugin ships with USD list prices for the models
   it knows (Kimi, GLM, MiniMax, DeepSeek coding-plan models, verified against
   official pricing pages). Catalog prices follow plugin updates.
2. **Observed models** — model names come from your own session logs, so the
   editor always lists exactly the models you actually used.
3. **Custom overrides** — any row edited in the ⚙ dialog is persisted into your
   user profile patch (via the host's config editor) and takes precedence over
   the built-in catalog. Untouched rows keep following the catalog.
4. **Fallback** — models without any price are estimated at the `*` fallback
   row (default $0.50 in / $2.00 out per 1M tokens) and flagged in the UI.

Saving recomputes every stored cost (the ledger folds events at read time), so
historical days are restated under the new prices immediately.

## Configuration

The plugin's config is `{ currency: string, prices: Record<string, {input,
output, cacheRead, cacheWrite}> }`. Prefer the ⚙ dialog; hand-editing the
`usage-ledger` row of your profile's `cordis.patch.yml` works too:

```yaml
- insert:
    - id: usage-ledger
      name: 'dsh-usage-ledger'
      config:
        currency: CNY            # display currency label (USD default)
        prices:
          glm-5.3-flash: { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 }
```

If the host environment has no config editor, the ⚙ button is hidden and the
dashboard explains how to edit the patch instead.

## Privacy

All data is computed locally from session logs. The HTTP endpoint listens on
the loopback interface only and rejects cross-site requests.

## Host requirements

The ⚙ Prices editor needs a host that mounts the `configEditor` service
(DeepSeek Harness desktop and web both do). On hosts without it the plugin
still folds the session log and serves the dashboard — read-only, priced from
the built-in catalog.

## Changelog

- **1.1.1** — Resolve the host config editor through `ctx.fiber.entry` and
  `ctx.get('configEditor')` instead of injected service access, so the price
  editor is offered wherever the host provides one (and never crashes the save
  route when it does not). The config schema returns the user's own rows only,
  so resolved config no longer folds the built-in catalog into the profile
  patch. Entry lookup accepts any package name ending in `usage-ledger`.

## License

[MIT](./LICENSE) © 2026 白白酱 (cp990207)

