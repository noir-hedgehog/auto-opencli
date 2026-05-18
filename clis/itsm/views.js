import { cli, Strategy } from '@jackwener/opencli/registry';
import { ensureItsmPage, fetchViews, mapViewRow } from './common.js';

cli({
    site: 'itsm',
    name: 'views',
    access: 'read',
    description: 'Segway-Ninebot ITSM 工作台视图列表',
    domain: 'itsm.segway-ninebot.com',
    strategy: Strategy.COOKIE,
    browser: true,
    navigateBefore: false,
    siteSession: 'persistent',
    args: [
        { name: 'tenantId', type: 'str', required: false, help: 'ITSM tenant id; defaults to ITSM_TENANT_ID or ITSM_WORKSPACE_URL' },
        { name: 'solutionId', type: 'str', required: false, help: 'ITSM solution id; defaults to ITSM_SOLUTION_ID or ITSM_WORKSPACE_URL' },
    ],
    columns: ['rank', 'key', 'name', 'id', 'default', 'preset', 'rankNum'],
    func: async (page, args) => {
        await ensureItsmPage(page, args);
        const views = await fetchViews(page, args);
        return views.map((view, index) => mapViewRow(view, index));
    },
});
