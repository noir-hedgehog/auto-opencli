import { cli, Strategy } from '@jackwener/opencli/registry';
import { ensureItsmPage, fetchTicketDetail, findTicket, mapTicketDetailRow } from './common.js';

cli({
    site: 'itsm',
    name: 'show',
    aliases: ['detail'],
    access: 'read',
    description: 'Segway-Ninebot ITSM 单据详情，先支持需求提报类单据',
    domain: 'itsm.segway-ninebot.com',
    strategy: Strategy.COOKIE,
    browser: true,
    navigateBefore: false,
    siteSession: 'persistent',
    args: [
        { name: 'ticket', type: 'str', required: true, positional: true, help: 'Ticket number or id' },
        { name: 'viewId', type: 'str', required: false, help: 'Detail view id override for unsupported source tables' },
        { name: 'sourceTable', type: 'str', required: false, help: 'Source table override, e.g. T_REQUIREMENT' },
        { name: 'lookupLimit', type: 'int', default: 100, help: 'Rows to scan in the 全部 view when resolving a ticket number (1-500)' },
        { name: 'tenantId', type: 'str', required: false, help: 'ITSM tenant id; defaults to ITSM_TENANT_ID or ITSM_WORKSPACE_URL' },
        { name: 'solutionId', type: 'str', required: false, help: 'ITSM solution id; defaults to ITSM_SOLUTION_ID or ITSM_WORKSPACE_URL' },
    ],
    columns: ['number', 'title', 'status', 'priority', 'requester', 'assignee', 'serviceItem', 'system', 'submittedTime', 'updateTime', 'description', 'sourceTable', 'ticketId', 'viewId'],
    func: async (page, args) => {
        await ensureItsmPage(page, args);
        const ticket = await findTicket(page, args, args.ticket);
        if (args.sourceTable) ticket.source_table = String(args.sourceTable);
        const detail = await fetchTicketDetail(page, args, ticket, args.viewId);
        return [mapTicketDetailRow(detail)];
    },
});
