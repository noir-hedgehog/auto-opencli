import { cli, Strategy } from '@jackwener/opencli/registry';
import { ensureItsmPage, fetchTicketRows, mapTicketRow, parseLimit } from './common.js';

function summarizeRows(rows) {
    const byStatus = new Map();
    const byAssignee = new Map();
    let missingStatusRows = 0;
    let missingAssigneeRows = 0;
    for (const row of rows) {
        if (row.status === null) missingStatusRows++;
        else byStatus.set(row.status, (byStatus.get(row.status) || 0) + 1);
        if (row.assignee === null) missingAssigneeRows++;
        else byAssignee.set(row.assignee, (byAssignee.get(row.assignee) || 0) + 1);
    }
    return {
        statusBreakdown: topEntries(byStatus),
        assigneeBreakdown: topEntries(byAssignee),
        missingStatusRows,
        missingAssigneeRows,
    };
}

function topEntries(map, limit = 5) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh-CN'))
        .slice(0, limit)
        .map(([name, count]) => `${name}:${count}`)
        .join(', ');
}

cli({
    site: 'itsm',
    name: 'summary',
    access: 'read',
    description: 'Segway-Ninebot ITSM 工作台单据概览',
    domain: 'itsm.segway-ninebot.com',
    strategy: Strategy.COOKIE,
    browser: true,
    navigateBefore: false,
    siteSession: 'persistent',
    args: [
        { name: 'limit', type: 'int', default: 100, help: 'Rows to inspect from each main view (1-100)' },
        { name: 'tenantId', type: 'str', required: false, help: 'ITSM tenant id; defaults to ITSM_TENANT_ID or ITSM_WORKSPACE_URL' },
        { name: 'solutionId', type: 'str', required: false, help: 'ITSM solution id; defaults to ITSM_SOLUTION_ID or ITSM_WORKSPACE_URL' },
    ],
    columns: ['view', 'total', 'visibleRows', 'statusBreakdown', 'assigneeBreakdown', 'missingStatusRows', 'missingAssigneeRows', 'latestUpdateTime'],
    func: async (page, args) => {
        const limit = parseLimit(args.limit, 100, 100);
        await ensureItsmPage(page, args);
        const views = ['pending', 'processing', 'done'];
        const rows = [];
        for (const view of views) {
            const { payload, content, view: resolvedView } = await fetchTicketRows(page, args, { view, pageNumber: 1, limit });
            const mapped = content.map((item, index) => mapTicketRow(item, index, 1, limit));
            const grouped = summarizeRows(mapped);
            const latestUpdateTime = mapped
                .map((row) => row.updateTime)
                .filter(Boolean)
                .sort()
                .at(-1) || null;
            rows.push({
                view: resolvedView.name,
                total: Number(payload?.totalElements || mapped.length || 0),
                visibleRows: mapped.length,
                statusBreakdown: grouped.statusBreakdown,
                assigneeBreakdown: grouped.assigneeBreakdown,
                missingStatusRows: grouped.missingStatusRows,
                missingAssigneeRows: grouped.missingAssigneeRows,
                latestUpdateTime,
            });
        }
        return rows;
    },
});
