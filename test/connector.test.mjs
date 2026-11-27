import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const entry = fileURLToPath(new URL('../src/xiaomiev.mjs', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'xiaomiev-skill-test-'));
const config = join(directory, 'config.json');
const secret = 'xm_sk_example_secret';
let mode = 'normal';
let bodyReceived;
const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.headers.authorization !== `Bearer ${secret}`) { res.writeHead(401).end(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'forbidden') { res.writeHead(403).end('{"code":403}'); return; }
    if (req.url === '/api/openapi/v1/vehicles') {
        res.end('{"code":200,"data":[{"id":1},{"id":2}]}'); return;
    }
    if (req.url === '/api/openapi/v1/vehicles/data-catalog') {
        if (mode === 'old') { res.writeHead(404).end('{"code":404}'); return; }
        res.end('{"code":200,"data":[]}'); return;
    }
    if (req.url.startsWith('/api/openapi/v1/vehicles/1/trips')) {
        if (req.method === 'POST' && mode === 'old') { res.writeHead(405).end('{"code":405}'); return; }
        bodyReceived = req.method === 'POST' ? JSON.parse(body) : Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        res.end('{"code":200,"data":{"list":[],"nextCursor":"next"}}'); return;
    }
    if (req.url === '/api/openapi/v1/vehicles/1/data/query'  && req.method === 'POST') {
        bodyReceived = JSON.parse(body);
        res.end('{"code":200,"data":{"rows":[{"total":8}]}}'); return;
    }
    res.writeHead(404).end('{"code":404}');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await writeFile(config, JSON.stringify({baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: secret}));
after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, {recursive: true, force: true}); });

const run = (args, input) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {env: {...process.env, XIAOMIEV_AGENT_CONFIG: config}});
    let out = '', err = '';
    child.stdout.on('data', chunk => out += chunk);
    child.stderr.on('data', chunk => err += chunk);
    child.on('error', reject);
    child.on('close', code => resolve({code, out, err}));
    child.stdin.end(input);
});

test('doctor checks connection, permission and supported data catalog without leaking key', async () => {
    mode = 'normal';
    const result = await run(['doctor']);
    const data = JSON.parse(result.out);
    assert.equal(result.code, 0);
    assert.equal(data.vehicleAccess, 'ok');
    assert.equal(data.vehicleCount, 2);
    assert.equal(data.flexibleQuery, 'available');
    assert.ok(!result.out.includes(secret));
});

test('older server preserves vehicle access while reporting unsupported data catalog', async () => {
    mode = 'old';
    const data = JSON.parse((await run(['doctor'])).out);
    assert.equal(data.vehicleAccess, 'ok');
    assert.equal(data.flexibleQuery, 'unsupported');
});

test('doctor reports permission errors without key', async () => {
    mode = 'forbidden';
    const result = await run(['doctor']);
    assert.equal(JSON.parse(result.out).vehicleAccess, 'forbidden');
    assert.ok(!result.out.includes(secret));
});

test('query reads structured input from stdin', async () => {
    mode = 'normal';
    const query = {dataset: 'charges', startDate: '2026-01-01', endDate: '2026-01-31'};
    const result = await run(['data-query', '--car-id', '1', '--json-stdin'], JSON.stringify(query));
    assert.equal(result.code, 0, result.err);
    assert.deepEqual(bodyReceived, query);
    assert.equal(JSON.parse(result.out).rows[0].total, 8);
    const invalid = await run(['data-query', '--car-id', '1', '--json-stdin'], 'not-json');
    assert.notEqual(invalid.code, 0);
    assert.match(invalid.err, /JSON/);
});

test('history uses POST body and reports unsupported old server', async () => {
    const args = ['trips', '--car-id', '1', '--start-time', '2026-01-01 00:00:00', '--end-time', '2026-02-01 00:00:00', '--cursor', 'next'];
    mode = 'normal';
    let result = await run(args);
    assert.equal(result.code, 0, result.err);
    assert.equal(bodyReceived.cursor, 'next');
    mode = 'old';
    result = await run(args);
    assert.notEqual(result.code, 0);
    assert.match(result.err, /升级 XiaomiEV Mate 后端/);
});

test('unreachable host gives actionable error', async () => {
    await writeFile(config, JSON.stringify({baseUrl: 'http://127.0.0.1:1', apiKey: secret}));
    const result = await run(['doctor']);
    assert.equal(JSON.parse(result.out).connection, 'failed');
    assert.match(JSON.parse(result.out).message, /无法连接/);
    assert.ok(!result.out.includes(secret));
});
