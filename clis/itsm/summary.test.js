import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistry } from '@jackwener/opencli/registry';
import { fetchTicketRows } from './common.js';
import './summary.js';

vi.mock('./common.js', async (importOriginal) => ({
    ...await importOriginal(),
    ensureItsmPage: vi.fn(),
    fetchTicketRows: vi.fn(),
}));

async function summarize(content, total = content.length) {
    fetchTicketRows.mockImplementation(async (_page, _args, { view }) => ({
        view: { name: view },
        payload: { totalElements: total },
        content,
    }));
    const command = getRegistry().get('itsm/summary');
    const result = await command.func({}, { limit: 100 });
    expect(result.map((row) => row.view)).toEqual(['pending', 'processing', 'done']);
    return result[0];
}

beforeEach(() => vi.clearAllMocks());

describe('itsm summary', () => {
    it('preserves counts and ordering for complete ticket data', async () => {
        const result = await summarize([
            { 'state_id:name': 'Open', 'assignee_person_id:real_name': 'Ada', last_update_date: '2026-09-16' },
            { 'state_id:name': 'Open', 'assignee_person_id:real_name': 'Ada', last_update_date: '2026-09-17' },
            { 'state_id:name': 'Done', 'assignee_person_id:real_name': 'Bob' },
        ], 50);
        expect(result).toMatchObject({
            total: 50, visibleRows: 3,
            statusBreakdown: 'Open:2, Done:1',
            assigneeBreakdown: 'Ada:2, Bob:1',
            missingStatusRows: 0, missingAssigneeRows: 0,
            latestUpdateTime: '2026-09-17',
        });
    });

    it('counts missing values separately without mixing them with a literal dash', async () => {
        const result = await summarize([
            { 'state_id:name': 'Open', 'assignee_person_id:real_name': 'Ada' },
            { 'state_id:name': null, 'assignee_person_id:real_name': 'Bob' },
            { 'state_id:name': 'Open', 'assignee_person_id:real_name': '  ' },
            {},
            { 'state_id:name': '-', 'assignee_person_id:real_name': '-' },
        ]);
        expect(result).toMatchObject({
            visibleRows: 5,
            statusBreakdown: 'Open:2, -:1',
            missingStatusRows: 2,
            missingAssigneeRows: 2,
        });
        expect(result.assigneeBreakdown.split(', ').sort()).toEqual(['-:1', 'Ada:1', 'Bob:1']);
    });

    it('reports zero missing counts for an empty view', async () => {
        expect(await summarize([])).toMatchObject({
            total: 0, visibleRows: 0,
            statusBreakdown: '', assigneeBreakdown: '',
            missingStatusRows: 0, missingAssigneeRows: 0,
            latestUpdateTime: null,
        });
    });
});
