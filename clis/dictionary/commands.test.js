import { getRegistry } from '@jackwener/opencli/registry';
import { executePipeline } from '@jackwener/opencli/pipeline';
import { afterEach, describe, expect, it, vi } from 'vitest';
import './search.js';
import './synonyms.js';
import './examples.js';

// Exercise the real registered pipelines without depending on the public API.
const entry = {
    word: 'perfect',
    phonetics: [{ audio: '' }, { text: '/perfect/' }],
    meanings: [
        {
            partOfSpeech: 'adjective',
            synonyms: ['flawless', 'ideal'],
            definitions: [{ definition: 'Without a fault.', synonyms: ['ideal', 'complete'] }],
        },
        {
            partOfSpeech: 'verb',
            synonyms: ['improve'],
            definitions: [{ definition: 'To improve.', example: 'Practice helped perfect the design.' }],
        },
    ],
};

function run(name, word = 'perfect') {
    const command = getRegistry().get(`dictionary/${name}`);
    expect(command?.browser).toBe(false);
    expect(command?.pipeline).toBeDefined();
    return executePipeline(null, command.pipeline, { args: { word } });
}

function respond(payload) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
    }));
}

afterEach(() => vi.unstubAllGlobals());

describe('dictionary adapter contracts', () => {
    it('extracts the definition and falls back to phonetics, limiting to one entry', async () => {
        respond([entry, { ...entry, word: 'ignored' }]);
        expect(await run('search')).toEqual([{
            word: 'perfect', phonetic: '/perfect/', type: 'adjective', definition: 'Without a fault.',
        }]);
        expect(fetch).toHaveBeenCalledWith(
            'https://api.dictionaryapi.dev/api/v2/entries/en/perfect',
            { method: 'GET', headers: {} },
        );
    });

    it('combines and deduplicates synonyms from meanings and definitions', async () => {
        respond([entry]);
        expect(await run('synonyms')).toEqual([{
            word: 'perfect', synonyms: 'flawless, ideal, complete, improve',
        }]);
    });

    it('finds an example in a later meaning', async () => {
        respond([entry]);
        expect(await run('examples')).toEqual([{
            word: 'perfect', example: 'Practice helped perfect the design.',
        }]);
    });

    it.each(['search', 'synonyms', 'examples'])('URL-encodes the word for %s', async (name) => {
        respond([entry]);
        await run(name, 'ice cream');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.dictionaryapi.dev/api/v2/entries/en/ice%20cream',
            { method: 'GET', headers: {} },
        );
    });

    it.each(['search', 'synonyms', 'examples'])('propagates API errors for %s', async (name) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false, status: 404, statusText: 'Not Found',
        }));
        await expect(run(name)).rejects.toMatchObject({ code: 'FETCH_ERROR' });
    });

    it.each(['search', 'synonyms', 'examples'])('propagates malformed JSON for %s', async (name) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); },
        }));
        await expect(run(name)).rejects.toThrow('Invalid JSON');
    });
});
