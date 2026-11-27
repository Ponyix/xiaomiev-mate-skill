import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, chmod, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, delimiter} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {detectAgents, parseSelection} from '../src/install-core.mjs';

const entry = fileURLToPath(new URL('../bin/install.mjs', import.meta.url));

test('区分程序存在和仅有配置痕迹', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xm-detect-'));
    const previous = process.env.CODEX_HOME;
    try {
        delete process.env.CODEX_HOME;
        await mkdir(join(home, 'bin'));
        await writeFile(join(home, 'bin', 'codex'), '#!/bin/sh\n');
        await chmod(join(home, 'bin', 'codex'), 0o755);
        await mkdir(join(home, '.claude'));
        const agents = await detectAgents({home, path: join(home, 'bin'), platform: 'linux', appPaths: false});
        assert.equal(agents.find(item => item.id === 'codex').installed, true);
        assert.equal(agents.find(item => item.id === 'claude-code').installed, false);
        assert.equal(agents.find(item => item.id === 'claude-code').configured, true);
        assert.equal(agents.find(item => item.id === 'cursor').configured, false);
    } finally {
        if (previous === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previous;
        await rm(home, {recursive: true, force: true});
    }
});

test('多选去重并拒绝无效编号', () => {
    const choices = [{id: 'codex'}, {id: 'claude-code'}];
    assert.deepEqual(parseSelection('2，1,2', choices), ['claude-code', 'codex']);
    assert.throws(() => parseSelection('3', choices));
    assert.throws(() => parseSelection('1;echo', choices));
});

test('明确指定 Agent 时只调用对应目标并保留配置', async () => {
    if (process.platform === 'win32') return;
    const home = await mkdtemp(join(tmpdir(), 'xm-install-'));
    try {
        await mkdir(join(home, 'bin'));
        const fake = join(home, 'bin', 'npx');
        await writeFile(fake, '#!/bin/sh\nif [ -n "$npm_config_package" ]; then exit 99; fi\nprintf "%s\\n" "$@" > "$XM_TEST_ARGS"\n');
        await chmod(fake, 0o755);
        const config = join(home, 'config.json');
        await writeFile(config, '{"baseUrl":"https://example.test","apiKey":"test-secret"}');
        const result = spawnSync(process.execPath, [entry, '--agent', 'codex,claude-code', '--skip-config'], {
            encoding: 'utf8', env: {...process.env, PATH: join(home, 'bin') + delimiter + process.env.PATH,
                XIAOMIEV_AGENT_CONFIG: config, XM_TEST_ARGS: join(home, 'args'), npm_config_package: 'outer-package'},
        });
        assert.equal(result.status, 0, result.stderr);
        assert.match(await readFile(join(home, 'args'), 'utf8'), /-a\ncodex\nclaude-code\n-y/);
        assert.equal(JSON.parse(await readFile(config, 'utf8')).apiKey, 'test-secret');
        assert.doesNotMatch(result.stdout + result.stderr, /test-secret/);
        const invalid = spawnSync(process.execPath, [entry, '--agent', 'codex;bad'], {encoding: 'utf8'});
        assert.notEqual(invalid.status, 0);
    } finally { await rm(home, {recursive: true, force: true}); }
});
