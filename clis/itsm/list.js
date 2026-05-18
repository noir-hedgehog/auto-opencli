import { EmptyResultError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ensureItsmPage, fetchTicketRows, mapTicketRow, parseLimit, parsePage, normalizeViewName } from './common.js';

cli({
    site: 'itsm',
    name: 'list',
    access: 'read',
    description: 'Segway-Ninebot ITSM 工作台单据列表，默认处理中',
    domain: 'itsm.segway-ninebot.com',
    strategy: Strategy.COOKIE,
    browser: true,
    navigateBefore: false,
    siteSession: 'persistent',
    args: [
        { name: 'view', type: 'str', default: 'processing', help: 'View key/name: all / pending / processing / done, or Chinese view name' },
        { name: 'query', type: 'str', required: false, help: 'Keyword filter applied locally to number/title/system/requester/assignee' },
        { name: 'page', type: 'int', default: 1, help: 'Page number, starting from 1' },
        { name: 'limit', type: 'int', default: 20, help: 'Rows per page (1-100)' },
        { name: 'tenantId', type: 'str', required: false, help: 'ITSM tenant id; defaults to ITSM_TENANT_ID or ITSM_WORKSPACE_URL' },
        { name: 'solutionId', type: 'str', required: false, help: 'ITSM solution id; defaults to ITSM_SOLUTION_ID or ITSM_WORKSPACE_URL' },
    ],
    columns: ['rank', 'number', 'title', 'status', 'priority', 'serviceItem', 'system', 'requester', 'assignee', 'createTime', 'updateTime', 'sourceTable', 'id'],
    func: async (page, args) => {
        const limit = parseLimit(args.limit, 20, 100);
        const pageNumber = parsePage(args.page);
        const view = normalizeViewName(args.view || 'processing');
        const query = String(args.query || '').trim().toLowerCase();
        await ensureItsmPage(page, args);
        const { content } = await fetchTicketRows(page, args, { view, pageNumber, limit });
        const rows = content.map((item, index) => mapTicketRow(item, index, pageNumber, limit));
        const filtered = query
            ? rows.filter((row) => [row.number, row.title, row.status, row.serviceItem, row.system, row.requester, row.assignee]
                .some((value) => String(value || '').toLowerCase().includes(query)))
            : rows;
        if (!filtered.length) {
            throw new EmptyResultError('itsm list', `No tickets matched view=${args.view || 'processing'}${query ? ` query="${args.query}"` : ''}.`);
        }
        return filtered;
    },
});
