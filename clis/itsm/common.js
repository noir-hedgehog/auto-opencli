import { ArgumentError, AuthRequiredError, CommandExecutionError, ConfigError, EmptyResultError } from '@jackwener/opencli/errors';

export const ITSM_HOST = 'itsm.segway-ninebot.com';
export const ITSM_BASE = `https://${ITSM_HOST}`;
export const ITSM_API = 'https://api-itsm.segway-ninebot.com';

export const WORKBENCH_LIST_ID = String(process.env.ITSM_WORKBENCH_LIST_ID || '').trim();
export const WORKSPACE_VIEW_ID = String(process.env.ITSM_WORKSPACE_VIEW_ID || '').trim();
export const WORKSPACE_QUERY_ID = String(process.env.ITSM_WORKSPACE_QUERY_ID || '').trim();

export const VIEW_ALIASES = {
    all: '全部',
    pending: '待处理',
    processing: '处理中',
    done: '已完成',
};

function workspaceParamsFromEnv() {
    const raw = String(process.env.ITSM_WORKSPACE_URL || '').trim();
    if (!raw) return {};
    try {
        const url = new URL(raw);
        return Object.fromEntries(url.searchParams.entries());
    } catch {
        return {};
    }
}

function requiredConfig(name, value) {
    const text = String(value || '').trim();
    if (!text) {
        throw new ConfigError(`Missing ${name}`, `Set ${name} before running ITSM commands.`);
    }
    return text;
}

function detailViewBySourceTable() {
    const raw = String(process.env.ITSM_DETAIL_VIEW_BY_SOURCE_TABLE || '').trim();
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        throw new ConfigError('Invalid ITSM_DETAIL_VIEW_BY_SOURCE_TABLE', 'Use JSON such as {"T_REQUIREMENT":"<detail-view-id>"}.');
    }
}

export function tenantIdFromArgs(args) {
    const value = String(args.tenantId || process.env.ITSM_TENANT_ID || workspaceParamsFromEnv().tenantId || '').trim();
    if (!value) {
        throw new ConfigError('Missing ITSM tenant id', 'Set ITSM_TENANT_ID or ITSM_WORKSPACE_URL before running ITSM commands.');
    }
    return value;
}

export function solutionIdFromArgs(args) {
    const value = String(args.solutionId || process.env.ITSM_SOLUTION_ID || workspaceParamsFromEnv().solutionId || '').trim();
    if (!value) {
        throw new ConfigError('Missing ITSM solution id', 'Set ITSM_SOLUTION_ID or ITSM_WORKSPACE_URL before running ITSM commands.');
    }
    return value;
}

export function workspaceUrl({ tenantId, solutionId, fid = '' } = {}) {
    const params = new URLSearchParams();
    params.set('solutionId', solutionId);
    params.set('tenantId', tenantId);
    if (fid) params.set('fid', fid);
    return `${ITSM_BASE}/#/itsm/workspace?${params.toString()}`;
}

export async function ensureItsmPage(page, args = {}) {
    const tenantId = tenantIdFromArgs(args);
    const solutionId = solutionIdFromArgs(args);
    const url = String(process.env.ITSM_WORKSPACE_URL || workspaceUrl({ tenantId, solutionId }));
    await page.goto(url, { waitUntil: 'load' });
    await page.wait(2);
}

export function parseLimit(raw, fallback = 20, max = 100) {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > max) {
        throw new ArgumentError(`--limit must be an integer between 1 and ${max}, got ${JSON.stringify(raw)}`);
    }
    return value;
}

export function parsePage(raw) {
    if (raw === undefined || raw === null || raw === '') return 1;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
        throw new ArgumentError(`--page must be a positive integer, got ${JSON.stringify(raw)}`);
    }
    return value;
}

function apiUrl(tenantId, path, params = {}) {
    const cleanPath = path.replace(/^\/+/, '');
    const url = new URL(`${ITSM_API}/${cleanPath}`);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && String(value) !== '') {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString().replace('__TENANT__', tenantId);
}

export async function itsmFetchJson(page, url, { method = 'GET', body, label = 'ITSM API' } = {}) {
    const req = {
        url,
        method,
        hasBody: body !== undefined,
        body,
        accessTokenCookie: String(process.env.ITSM_ACCESS_TOKEN_COOKIE || '').trim(),
        tenantCookie: String(process.env.ITSM_TENANT_COOKIE || '').trim(),
    };
    const result = await page.evaluate(`
      (async (req) => {
        try {
          const init = {
            method: req.method,
            credentials: 'include',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'x-language': 'zh_CN',
            },
          };
          const cookiePairs = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((part) => {
            const index = part.indexOf('=');
            return index >= 0 ? [part.slice(0, index), part.slice(index + 1)] : [part, ''];
          }));
          const accessToken = req.accessTokenCookie ? cookiePairs[req.accessTokenCookie] : '';
          const tenantId = (req.url.match(/\\/v1\\/(\\d+)\\//) || req.url.match(/\\/engine\\/(\\d+)\\//) || [])[1] || (req.tenantCookie ? cookiePairs[req.tenantCookie] : '');
          if (accessToken) init.headers.Authorization = 'bearer ' + accessToken;
          if (tenantId) init.headers['x-tenant-id'] = tenantId;
          if (req.hasBody) init.body = JSON.stringify(req.body);
          const resp = await fetch(req.url, init);
          const text = await resp.text();
          let parsed = null;
          let parseError = null;
          try { parsed = text ? JSON.parse(text) : null; } catch (e) { parseError = String((e && e.message) || e); }
          return {
            ok: resp.ok,
            status: resp.status,
            statusText: resp.statusText || '',
            url: resp.url,
            contentType: resp.headers.get('content-type') || '',
            textPreview: text.slice(0, 500),
            parsed,
            parseError,
          };
        } catch (e) {
          return { ok: false, status: 0, statusText: '', url: req.url, error: String((e && e.message) || e) };
        }
      })(${JSON.stringify(req)})
    `);
    if (result?.status === 401 || result?.status === 403) {
        throw new AuthRequiredError(ITSM_HOST, `${label} requires an authenticated Segway-Ninebot ITSM browser session (HTTP ${result.status})`);
    }
    if (result?.error) {
        throw new CommandExecutionError(`${label} failed: ${result.error}`);
    }
    if (!result?.ok) {
        const detail = result?.status ? `HTTP ${result.status}${result.statusText ? ` ${result.statusText}` : ''}` : 'no response';
        throw new CommandExecutionError(`${label} failed: ${detail}`, result?.textPreview || undefined);
    }
    if (result.parseError) {
        throw new CommandExecutionError(`${label} returned non-JSON: ${result.parseError}`, result.textPreview || undefined);
    }
    return result.parsed;
}

export async function fetchViews(page, args = {}) {
    const tenantId = tenantIdFromArgs(args);
    const workspaceViewId = requiredConfig('ITSM_WORKSPACE_VIEW_ID', WORKSPACE_VIEW_ID);
    const workbenchListId = requiredConfig('ITSM_WORKBENCH_LIST_ID', WORKBENCH_LIST_ID);
    const url = apiUrl(tenantId, `/lc/v1/__TENANT__/formFilters/queryBySelf/${workspaceViewId}`, {
        page: 0,
        size: 999,
        workbenchListId,
    });
    const rows = await itsmFetchJson(page, url, { label: 'ITSM workbench views' });
    if (!Array.isArray(rows)) {
        throw new CommandExecutionError('ITSM workbench views returned an unexpected payload');
    }
    return rows;
}

export function normalizeViewName(raw = 'processing') {
    const value = String(raw || 'processing').trim();
    return VIEW_ALIASES[value] || value;
}

export async function resolveView(page, args = {}, rawView = 'processing') {
    const viewName = normalizeViewName(rawView);
    const views = await fetchViews(page, args);
    const found = views.find((view) => String(view?.name || '') === viewName || String(view?.id || '') === String(rawView));
    if (!found) {
        throw new ArgumentError(`Unknown ITSM view "${rawView}"`, `Known views: ${views.map((view) => view.name).filter(Boolean).join(', ')}`);
    }
    return found;
}

export async function fetchTicketRows(page, args = {}, { view = 'processing', pageNumber = 1, limit = 20 } = {}) {
    const tenantId = tenantIdFromArgs(args);
    const workspaceViewId = requiredConfig('ITSM_WORKSPACE_VIEW_ID', WORKSPACE_VIEW_ID);
    const workspaceQueryId = requiredConfig('ITSM_WORKSPACE_QUERY_ID', WORKSPACE_QUERY_ID);
    const resolvedView = await resolveView(page, args, view);
    const url = apiUrl(tenantId, `/lc/v1/engine/__TENANT__/dataset/${workspaceViewId}/${workspaceQueryId}/query`, {
        filter_id: resolvedView.id,
        viewType: 'TABLE',
        page: pageNumber - 1,
        size: limit,
    });
    const payload = await itsmFetchJson(page, url, {
        method: 'POST',
        body: {},
        label: `ITSM ${resolvedView.name} ticket list`,
    });
    const content = Array.isArray(payload?.content) ? payload.content : [];
    return { view: resolvedView, payload, content };
}

export function mapTicketRow(item, index, pageNumber = 1, limit = 20) {
    return {
        rank: (pageNumber - 1) * limit + index + 1,
        number: stringOrNull(item?.number),
        title: stringOrNull(item?.short_description),
        status: stringOrNull(item?.['state_id:name']),
        priority: stringOrNull(item?.['priority_id:name']),
        serviceItem: stringOrNull(item?.['service_item_id:name']),
        system: stringOrNull(item?.['t_system:t_name']),
        requester: stringOrNull(item?.['submitted_by:real_name']),
        assignee: stringOrNull(item?.['assignee_person_id:real_name']),
        createTime: stringOrNull(item?.creation_date),
        updateTime: stringOrNull(item?.last_update_date),
        sourceTable: stringOrNull(item?.source_table),
        id: stringOrNull(item?.id),
    };
}

export function mapViewRow(view, index) {
    return {
        rank: index + 1,
        key: aliasForViewName(view?.name) || stringOrNull(view?.name),
        name: stringOrNull(view?.name),
        id: stringOrNull(view?.id),
        default: Boolean(view?.defaultFlag),
        preset: Boolean(view?.presetFlag),
        rankNum: numberOrNull(view?.rankNum),
    };
}

export function aliasForViewName(name) {
    const text = String(name || '');
    for (const [alias, label] of Object.entries(VIEW_ALIASES)) {
        if (label === text) return alias;
    }
    return null;
}

export async function findTicket(page, args = {}, ticket) {
    const needle = String(ticket || '').trim();
    if (!needle) throw new ArgumentError('ticket number or id is required');
    const limit = parseLimit(args.lookupLimit, 100, 500);
    const { content, view } = await fetchTicketRows(page, args, { view: 'all', pageNumber: 1, limit });
    const found = content.find((item) => {
        const values = [item?.number, item?.id, item?.source_id].map((value) => String(value || ''));
        return values.includes(needle);
    });
    if (!found) {
        throw new EmptyResultError('itsm ticket lookup', `Could not find "${needle}" in the first ${limit} tickets from the 全部 view. Try a larger --lookup-limit or pass --id/--source-table when this command grows write support.`);
    }
    return { ...found, __filter_id: view.id };
}

export async function fetchTicketDetail(page, args = {}, ticketRow, explicitViewId) {
    const tenantId = tenantIdFromArgs(args);
    const sourceTable = String(ticketRow?.source_table || args.sourceTable || '').trim();
    const viewId = String(explicitViewId || detailViewBySourceTable()[sourceTable] || '').trim();
    if (!viewId) {
        throw new ArgumentError(
            `No detail viewId mapping for source table "${sourceTable || 'unknown'}"`,
            'Pass --view-id after opening the ticket once in the browser, or set ITSM_DETAIL_VIEW_BY_SOURCE_TABLE.',
        );
    }
    const ticketId = String(ticketRow?.source_id || ticketRow?.id || args.id || '').trim();
    if (!ticketId) throw new ArgumentError('ticket id is required for detail lookup');
    const businessObjectCode = sourceTable || 'T_REQUIREMENT';
    const detailUrl = workspaceUrl({
        tenantId,
        solutionId: solutionIdFromArgs(args),
        fid: String(args.fid || ticketRow?.__filter_id || ''),
    }) + `&ticketId=${encodeURIComponent(ticketId)}&viewId=${encodeURIComponent(viewId)}&extraInstanceId=${encodeURIComponent(ticketId)}`;

    await page.goto(detailUrl, { waitUntil: 'load' });
    await page.wait(2);

    const headerUrl = apiUrl(tenantId, `/itsm/v1/__TENANT__/task/ticketHeaderInfo/${ticketId}`, {
        businessObjectCode,
        viewId,
    });
    const header = await itsmFetchJson(page, headerUrl, {
        method: 'POST',
        body: {},
        label: `ITSM ticket ${ticketId} header`,
    });

    const dataUrl = apiUrl(tenantId, `/lc/v1/engine/__TENANT__/dataset/${viewId}/${viewId}/query`, {
        viewType: 'UPDATE',
    });
    const detailPayload = await itsmFetchJson(page, dataUrl, {
        method: 'POST',
        body: {},
        label: `ITSM ticket ${ticketId} detail`,
    });
    const detail = Array.isArray(detailPayload?.content) ? detailPayload.content[0] : null;
    return { ticketId, viewId, sourceTable: businessObjectCode, header, detail };
}

export function mapTicketDetailRow(data) {
    const header = data.header || {};
    const rawDetail = data.detail || {};
    const detailMatchesHeader = rawDetail &&
        (String(rawDetail.id || '') === String(data.ticketId || '') ||
            (rawDetail.number && header.number && String(rawDetail.number) === String(header.number)));
    const detail = detailMatchesHeader ? rawDetail : {};
    return {
        number: stringOrNull(header.number || detail.number),
        title: stringOrNull(header.short_description || detail.short_description),
        status: stringOrNull(header['state_id:name'] || detail['state_id:name']),
        priority: stringOrNull(header['priority_id:name'] || detail['priority_id:name']),
        requester: stringOrNull(header['submitted_by:real_name'] || detail['submitted_by:real_name'] || detail['t_caller_id:real_name']),
        assignee: stringOrNull(header['assignee_person_id:real_name'] || detail['assignee_person_id:real_name']),
        serviceItem: stringOrNull(detail['service_item_id:name'] || header['service_item_id:name']),
        system: stringOrNull(detail['t_system:t_name'] || header['t_system:t_name']),
        submittedTime: stringOrNull(detail.submitted_at || header.submitted_at || header.creation_date),
        updateTime: stringOrNull(header.last_update_date || detail.last_update_date),
        description: stringOrNull(detail.t_description || detail.description || detail.short_description),
        sourceTable: stringOrNull(data.sourceTable),
        ticketId: stringOrNull(data.ticketId),
        viewId: stringOrNull(data.viewId),
    };
}

function stringOrNull(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
