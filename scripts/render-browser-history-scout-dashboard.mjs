#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'docs/developer/browser-history-scout-data.json');
const outPath = path.join(root, 'docs/developer/browser-history-scout.md');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function raw(value) {
  return { raw: value };
}

function fmt(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'raw')) {
    return value.raw;
  }
  return value === null || value === undefined || value === '' ? '-' : esc(value);
}

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(fmt).join(' | ')} |`).join('\n');
  return [head, sep, body].filter(Boolean).join('\n');
}

function statusClass(status) {
  const raw = String(status || '').toLowerCase();
  if (raw.includes('created') || raw.includes('covered')) return 'ok';
  if (raw.includes('candidate') || raw.includes('planned')) return 'todo';
  if (raw.includes('blocked') || raw.includes('deferred')) return 'blocked';
  return 'neutral';
}

function commandRows() {
  return (data.commandCandidates || []).map((item) => [
    item.hostname,
    raw(`<code>${esc(item.command)}</code>`),
    raw(`<span class="status ${statusClass(item.status)}">${esc(item.status)}</span>`),
    item.access,
    item.reason,
  ]);
}

function domainRows() {
  return (data.domains || []).map((item) => [
    item.hostname,
    item.registrableDomain,
    item.subdomainRole,
    item.visitCount,
    item.uniquePathCount,
    item.lastSeen,
    raw(`<span class="status ${statusClass(item.coverage)}">${esc(item.coverage)}</span>`),
    item.adapter || '-',
    item.notes,
  ]);
}

function createdRows() {
  return (data.createdCli || []).map((item) => [
    item.adapter,
    raw((item.commands || []).map((name) => `<code>${esc(name)}</code>`).join(', ')),
    raw((item.files || []).map((file) => `<code>${esc(file)}</code>`).join('<br>')),
    raw((item.verified || []).map((cmd) => `<code>${esc(cmd)}</code>`).join('<br>')),
    item.notes,
  ]);
}

function runRows() {
  return (data.runs || []).map((run) => [run.date, run.kind, run.notes]);
}

const summary = data.summary || {};
const output = `# Browser History Scout

This dashboard tracks the daily automation that scans aggregated Chrome browsing history, keeps subdomains separate, identifies high-frequency surfaces without OpenCLI coverage, and turns safe read-only surfaces into CLI adapters.

<div class="scout-grid">
  <div class="scout-card"><span>Domains collected</span><strong>${fmt(summary.domainsCollected)}</strong></div>
  <div class="scout-card"><span>Candidate commands</span><strong>${fmt(summary.candidateCommands)}</strong></div>
  <div class="scout-card"><span>Created commands</span><strong>${fmt(summary.createdCommands)}</strong></div>
  <div class="scout-card"><span>Deferred or blocked</span><strong>${fmt(summary.blockedOrDeferred)}</strong></div>
</div>

::: tip Privacy boundary
Profile: ${fmt(data.profile)}. The scout stores aggregated domain-level counts and decisions only. It should not write raw browsing URLs, cookies, tokens, or page contents into this repo.
:::

Generated from \`docs/developer/browser-history-scout-data.json\` at \`${fmt(data.generatedAt)}\`.

## Collected Domains

${table(['Hostname', 'Registrable domain', 'Subdomain role', 'Visits', 'Unique paths', 'Last seen', 'Coverage', 'Adapter', 'Notes'], domainRows())}

## CLI Candidates

${table(['Hostname', 'Command', 'Status', 'Access', 'Why'], commandRows())}

## Created CLI

${table(['Adapter', 'Commands', 'Files', 'Verified with', 'Notes'], createdRows())}

## Run Log

${table(['Date', 'Kind', 'Notes'], runRows())}

## Update Contract

Daily automation should:

1. Read Chrome history locally and aggregate by full hostname.
2. Preserve subdomain boundaries, especially app vs API vs auth hosts.
3. Compare high-frequency hosts with \`clis/\`, \`cli-manifest.json\`, and adapter docs.
4. Add only safe read-only commands by default.
5. Update \`browser-history-scout-data.json\`, run \`node scripts/render-browser-history-scout-dashboard.mjs\`, rebuild the manifest if commands changed, and run focused validation.

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
`;

fs.writeFileSync(outPath, output, 'utf8');
console.log(`Rendered ${path.relative(root, outPath)}`);
