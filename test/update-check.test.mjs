import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkUpdate, parseVersion} from '../src/update-check.mjs';

const response = tags => async () => ({ok: true, json: async () => tags.map(name => ({name}))});

test('比较正式版本并忽略预发布版本', async () => {
    assert.equal(parseVersion('v1.2.3-rc1'), null);
    assert.deepEqual(await checkUpdate('1.0.1', response(['v1.9.9', 'v1.10.0', 'v9.0.0-rc1'])),
        {status:'update_available', currentVersion:'1.0.1', latestVersion:'1.10.0'});
    assert.equal((await checkUpdate('1.10.0', response(['v1.9.9', 'v1.10.0']))).status, 'up_to_date');
});

test('网络失败、限流及无版本均为未知，不误报已更新', async () => {
    assert.equal((await checkUpdate('1.0.1', async () => {throw new Error('offline');})).status, 'unknown');
    assert.equal((await checkUpdate('1.0.1', async () => ({ok:false, status:403}))).status, 'unknown');
    assert.equal((await checkUpdate('1.0.1', response([]))).status, 'unknown');
    assert.equal((await checkUpdate('invalid', response(['v1.0.1']))).status, 'unknown');
});
