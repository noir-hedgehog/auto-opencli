# Browser History Scout

This dashboard tracks the daily automation that scans aggregated Chrome browsing history, keeps subdomains separate, identifies high-frequency surfaces without OpenCLI coverage, and turns safe read-only surfaces into CLI adapters.

<div class="scout-grid">
  <div class="scout-card"><span>Domains collected</span><strong>0</strong></div>
  <div class="scout-card"><span>Candidate commands</span><strong>0</strong></div>
  <div class="scout-card"><span>Created commands</span><strong>0</strong></div>
  <div class="scout-card"><span>Deferred or blocked</span><strong>0</strong></div>
</div>

::: tip Privacy boundary
Profile: configured Chrome profile. The scout stores aggregated domain-level counts and decisions only. It should not write raw browsing URLs, cookies, tokens, or page contents into this repo.
:::

Generated from `docs/developer/browser-history-scout-data.json` at `2026-05-18T21:58:00+08:00`.

## Collected Domains

| Hostname | Registrable domain | Subdomain role | Visits | Unique paths | Last seen | Coverage | Adapter | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## CLI Candidates

| Hostname | Command | Status | Access | Why |
| --- | --- | --- | --- | --- |

## Created CLI

| Adapter | Commands | Files | Verified with | Notes |
| --- | --- | --- | --- | --- |

## Run Log

| Date | Kind | Notes |
| --- | --- | --- |
| 2026-05-18 | manual-seed | Initial dashboard scaffold. Daily automation should fill this file with aggregated hostname counts and CLI decisions. |

## Update Contract

Daily automation should:

1. Read Chrome history locally and aggregate by full hostname.
2. Preserve subdomain boundaries, especially app vs API vs auth hosts.
3. Compare high-frequency hosts with `clis/`, `cli-manifest.json`, and adapter docs.
4. Add only safe read-only commands by default.
5. Update `browser-history-scout-data.json`, run `node scripts/render-browser-history-scout-dashboard.mjs`, rebuild the manifest if commands changed, and run focused validation.

<style>
.scout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.scout-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 14px;
  background: var(--vp-c-bg-soft);
}
.scout-card span {
  display: block;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.scout-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  line-height: 1;
}
.status {
  display: inline-block;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--vp-c-divider);
}
.status.ok {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.08);
}
.status.todo {
  color: #8a5a00;
  background: rgba(180, 117, 0, 0.10);
}
.status.blocked {
  color: #b42318;
  background: rgba(180, 35, 24, 0.10);
}
</style>
