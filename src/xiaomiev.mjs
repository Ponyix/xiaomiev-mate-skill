#!/usr/bin/env node
import {chmod, mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';

if (Number(process.versions.node.split('.')[0]) < 20) {
    process.stderr.write('XiaomiEV Mate Agent Skill 需要 Node.js 20 或更高版本。\n');
    process.exit(1);
}

const {createInterface} = await import('node:readline/promises');

const configRoot = process.platform === 'win32'
    ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
    : (process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'));
const configPath = process.env.XIAOMIEV_AGENT_CONFIG
    ?? join(configRoot, 'xiaomiev-mate-agent', 'config.json');
const skillVersion = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();

const helpText = `XiaomiEV Mate Agent Skill 本地连接器 v${skillVersion}

首次配置：
  xiaomiev setup

检查本机配置（不显示 API Key）：
  xiaomiev doctor

查看本地 Skill 版本：
  xiaomiev version

能力自发现与通用只读查询：
  xiaomiev capabilities
  xiaomiev data-catalog
  xiaomiev data-query --car-id 1 --json-stdin
  xiaomiev get /openapi/v1/vehicles/1/overview --query startDate=2026-11-01 --query endDate=2026-11-26

常用只读命令：
  xiaomiev vehicles
  xiaomiev realtime --car-id 1
  xiaomiev charging-detect --car-id 1
  xiaomiev trips --car-id 1 --start-time "2026-11-20 00:00:00" --end-time "2026-11-21 00:00:00"
  xiaomiev trip-detail --car-id 1 --trip-id 100
  xiaomiev charges --car-id 1 --start-time "2026-11-01 00:00:00" --end-time "2026-12-01 00:00:00"
  xiaomiev charge-detail --car-id 1 --record-id 200
  xiaomiev overview --car-id 1 [--start-date 2026-11-01] [--end-date 2026-11-26]
  xiaomiev statistics --car-id 1 [--start-date 2026-11-01] [--end-date 2026-11-26]
  xiaomiev monthly-report --car-id 1 [--month 202611]
  xiaomiev trend --car-id 1 [--days 30] [--stat-date 2026-11-26]
  xiaomiev footprints --car-id 1 [--level PROVINCE|CITY] [--province 浙江省] [--city 杭州市] [--start-date 2026-01-01] [--end-date 2026-11-26]
  xiaomiev footprint-detail --car-id 1 [--level PROVINCE|CITY|DISTRICT] [--keyword 杭州] [--page-num 1] [--page-size 20]
  xiaomiev health --car-id 1 [--start-date 2026-11-01] [--end-date 2026-11-26] [--exclude-parking true]

配置文件：${configPath}
仅在本机保存服务地址和 API Key；请勿把 API Key 粘贴到聊天、URL 或日志中。`;

const readConfig = async () => {
    try {
        return JSON.parse(await readFile(configPath, 'utf8'));
    } catch {
        return {};
    }
};

const normalizeBaseUrl = (value) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('服务地址必须使用 HTTP 或 HTTPS');
    }
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString().replace(/\/$/, '').endsWith('/api')
        ? url.toString().replace(/\/$/, '')
        : `${url.toString().replace(/\/$/, '')}/api`;
};

const normalizeOpenApiPath = (rawPath) => {
    if (!rawPath || typeof rawPath !== 'string') {
        throw new Error('缺少请求路径，例如 /openapi/v1/vehicles');
    }
    const trimmed = rawPath.trim();
    if (!trimmed.startsWith('/openapi/v1/') || trimmed.includes('..') || trimmed.includes('://') || /\s/.test(trimmed)) {
        throw new Error('通用只读查询仅允许以 /openapi/v1/ 开头的合法路径');
    }
    const parsed = new URL(`https://placeholder.local${trimmed}`);
    if (!parsed.pathname.startsWith('/openapi/v1/')) {
        throw new Error('通用只读查询仅允许访问 /openapi/v1/ 下的只读资源');
    }
    const query = {};
    for (const [key, value] of parsed.searchParams.entries()) {
        query[key] = value;
    }
    return {path: parsed.pathname, query};
};

const parseQueryOptions = (args) => {
    const query = {};
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token !== '--query' && token !== '--param') {
            continue;
        }
        const pair = args[index + 1];
        if (!pair || !pair.includes('=')) {
            throw new Error(`参数 ${token} 必须使用 key=value 格式`);
        }
        const eqIndex = pair.indexOf('=');
        const key = pair.slice(0, eqIndex).trim();
        const value = pair.slice(eqIndex + 1);
        if (!key) {
            throw new Error(`参数 ${token} 缺少键名`);
        }
        query[key] = value;
        index += 1;
    }
    return query;
};

const saveConfig = async (config) => {
    await mkdir(dirname(configPath), {recursive: true, mode: 0o700});
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {mode: 0o600});
    await chmod(configPath, 0o600);
};

const readSecret = (prompt) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
        throw new Error('API Key 仅支持在本机交互终端中配置');
    }
    return new Promise((resolve, reject) => {
        const input = process.stdin;
        const wasRaw = input.isRaw;
        let value = '';
        const cleanup = () => {
            input.off('data', onData);
            if (!wasRaw) input.setRawMode(false);
            input.pause();
        };
        const onData = (chunk) => {
            for (const character of chunk.toString('utf8')) {
                if (character === '\r' || character === '\n') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }
                if (character === '\u0003') {
                    cleanup();
                    process.stdout.write('\n');
                    reject(new Error('已取消配置'));
                    return;
                }
                if (character === '\u007f' || character === '\b') {
                    value = value.slice(0, -1);
                    continue;
                }
                if (character >= ' ') {
                    value += character;
                }
            }
        };
        if (!wasRaw) input.setRawMode(true);
        input.on('data', onData);
        input.resume();
        process.stdout.write(prompt);
    });
};

const setup = async () => {
    const current = await readConfig();
    const terminal = createInterface({input: process.stdin, output: process.stdout});
    try {
        const baseUrl = normalizeBaseUrl(await terminal.question(`XiaomiEV Mate 地址${current.baseUrl ? ` [${current.baseUrl}]` : ''}: `) || current.baseUrl || '');
        terminal.close();
        const apiKey = await readSecret('API Key（输入不会回显）: ');
        if (!apiKey.startsWith('xm_sk_')) {
            throw new Error('API Key 格式无效');
        }
        await saveConfig({baseUrl, apiKey});
        process.stdout.write(`${JSON.stringify(await diagnose({baseUrl, apiKey}))}\n`);
    } finally {
        terminal.close();
    }
};

const request = async (path, query, body, suppliedConfig) => {
    const config = suppliedConfig ?? await readConfig();
    if (!config.baseUrl || !config.apiKey) {
        throw new Error('连接尚未配置，请在本机终端运行 xiaomiev setup');
    }
    const url = new URL(`${normalizeBaseUrl(config.baseUrl)}${path}`);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
    }
    let response;
    try {
        response = await fetch(url, {
            method: body === undefined ? 'GET' : 'POST',
            headers: {Accept: 'application/json', Authorization: `Bearer ${config.apiKey}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
            ...(body === undefined ? {} : {body: JSON.stringify(body)}),
            signal: AbortSignal.timeout(20_000),
        });
    } catch (error) {
        if (error.name === 'TimeoutError') throw new Error('连接超时，请检查服务地址和网络');
        throw new Error('无法连接 XiaomiEV Mate，请检查服务地址、网络和服务状态');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== 200) {
        const status = !response.ok ? response.status : payload.code;
        const messages = {
            401: 'API Key 无效、已撤销或已过期，请重新配置',
            403: 'API Key 没有车辆读取权限，请在开放平台启用 vehicle:read',
            404: '当前服务未提供此接口，请检查服务地址及后端版本',
            405: '当前后端不支持此查询方式，请升级 XiaomiEV Mate 后端',
            429: '请求过于频繁，请稍后重试',
        };
        const error = new Error(messages[status] || payload.msg || `请求失败（HTTP ${response.status}）`);
        error.status = status;
        throw error;
    }
    return payload.data;
};

const diagnose = async (config) => {
    const result = {skillVersion, configured: Boolean(config.baseUrl && config.apiKey),
        connection: 'not_checked', vehicleAccess: 'not_checked', vehicleCount: null, flexibleQuery: 'not_checked'};
    if (!result.configured) return {...result, message: '请在本机终端运行 setup 配置服务地址和 API Key'};
    try {
        const vehicles = await request('/openapi/v1/vehicles', {}, undefined, config);
        if (!Array.isArray(vehicles)) throw new Error('服务返回的车辆列表格式不正确');
        result.connection = 'ok';
        result.vehicleAccess = 'ok';
        result.vehicleCount = vehicles.length;
    } catch (error) {
        result.connection = error.status ? 'ok' : 'failed';
        result.vehicleAccess = error.status === 401 ? 'unauthorized' : error.status === 403 ? 'forbidden' : 'failed';
        result.message = error.message;
        return result;
    }
    try {
        await request('/openapi/v1/vehicles/data-catalog', {}, undefined, config);
        result.flexibleQuery = 'available';
    } catch (error) {
        result.flexibleQuery = error.status === 404 ? 'unsupported' : 'unknown';
        result.message = error.status === 404 ? '当前后端未提供数据目录；已有车辆接口仍可使用' : error.message;
    }
    return result;
};

const readQueryInput = async (args) => {
    const file = getOptionalOption(args, '--json-file');
    const stdin = args.includes('--json-stdin');
    if (Boolean(file) === stdin) throw new Error('请选择 --json-stdin 或 --json-file 之一');
    let input;
    if (stdin) {
        if (process.stdin.isTTY) throw new Error('请通过标准输入传入查询 JSON');
        let size = 0;
        const chunks = [];
        for await (const chunk of process.stdin) {
            size += chunk.length;
            if (size > 65536) throw new Error('查询参数过大');
            chunks.push(chunk);
        }
        input = Buffer.concat(chunks).toString('utf8');
    } else {
        input = await readFile(file, 'utf8');
        if (Buffer.byteLength(input) > 65536) throw new Error('查询参数过大');
    }
    let body;
    try { body = JSON.parse(input); } catch { throw new Error('查询参数不是有效 JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('查询参数必须是 JSON 对象');
    return body;
};

const getRequiredOption = (args, name) => {
    const index = args.indexOf(name);
    const value = index < 0 ? undefined : args[index + 1];
    if (!value) throw new Error(`缺少参数 ${name}`);
    return value;
};

const getOptionalOption = (args, name) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
};

const run = async () => {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'help' || command === '--help' || command === '-h' || !command) {
        process.stdout.write(`${helpText}\n`);
        return;
    }
    if (command === 'setup') return setup();
    if (command === 'version') {
        process.stdout.write(`${JSON.stringify({skillVersion, apiVersion: 'v1'})}\n`);
        return;
    }
    if (command === 'doctor') return diagnose(await readConfig());
    if (command === 'capabilities') return request('/openapi/v1/capabilities', {});
    if (command === 'data-catalog') return request('/openapi/v1/vehicles/data-catalog', {});
    if (command === 'data-query') {
        const carId = getRequiredOption(args, '--car-id');
        if (!/^[1-9][0-9]*$/.test(carId)) throw new Error('无效的车辆ID');
        const body = await readQueryInput(args);
        return request(`/openapi/v1/vehicles/${carId}/data/query`, {}, body);
    }
    if (command === 'get') {
        const [rawPath, ...restArgs] = args;
        const normalized = normalizeOpenApiPath(rawPath);
        const query = {...normalized.query, ...parseQueryOptions(restArgs)};
        return request(normalized.path, query);
    }
    if (command === 'vehicles') return request('/openapi/v1/vehicles', {});
    const carId = getRequiredOption(args, '--car-id');
    if (command === 'realtime') return request(`/openapi/v1/vehicles/status/${carId}`, {});
    if (command === 'charging-detect') return request(`/openapi/v1/charging/detect/${carId}`, {});
    if (command === 'trips') return request(`/openapi/v1/vehicles/${carId}/trips`, {}, {
        startTime: getRequiredOption(args, '--start-time'), endTime: getRequiredOption(args, '--end-time'),
        pageSize: getOptionalOption(args, '--page-size'), cursor: getOptionalOption(args, '--cursor'),
    });
    if (command === 'trip-detail') return request(`/openapi/v1/vehicles/${carId}/trips/${getRequiredOption(args, '--trip-id')}`, {});
    if (command === 'charges') return request(`/openapi/v1/vehicles/${carId}/charge-records`, {}, {
        startTime: getRequiredOption(args, '--start-time'), endTime: getRequiredOption(args, '--end-time'),
        pageSize: getOptionalOption(args, '--page-size'), cursor: getOptionalOption(args, '--cursor'),
    });
    if (command === 'charge-detail') return request(`/openapi/v1/vehicles/${carId}/charge-records/${getRequiredOption(args, '--record-id')}`, {});
    if (command === 'overview') return request(`/openapi/v1/vehicles/${carId}/overview`, {
        startDate: getOptionalOption(args, '--start-date'), endDate: getOptionalOption(args, '--end-date'),
    });
    if (command === 'statistics') return request(`/openapi/v1/vehicles/${carId}/statistics`, {
        startDate: getOptionalOption(args, '--start-date'), endDate: getOptionalOption(args, '--end-date'),
    });
    if (command === 'monthly-report') return request(`/openapi/v1/vehicles/${carId}/monthly-report`, {
        month: getOptionalOption(args, '--month'),
    });
    if (command === 'trend') return request(`/openapi/v1/vehicles/${carId}/trend`, {
        days: getOptionalOption(args, '--days'), statDate: getOptionalOption(args, '--stat-date'),
    });
    if (command === 'footprints') return request(`/openapi/v1/vehicles/${carId}/footprints`, {}, {
        level: getOptionalOption(args, '--level'),
        provinceName: getOptionalOption(args, '--province'),
        cityName: getOptionalOption(args, '--city'),
        startDate: getOptionalOption(args, '--start-date'),
        endDate: getOptionalOption(args, '--end-date'),
    });
    if (command === 'footprint-detail') return request(`/openapi/v1/vehicles/${carId}/footprints/detail`, {}, {
        level: getOptionalOption(args, '--level'),
        keyword: getOptionalOption(args, '--keyword'),
        startDate: getOptionalOption(args, '--start-date'),
        endDate: getOptionalOption(args, '--end-date'),
        pageNum: getOptionalOption(args, '--page-num'),
        pageSize: getOptionalOption(args, '--page-size'),
    });
    if (command === 'health') return request(`/openapi/v1/vehicles/${carId}/health`, {}, {
        startDate: getOptionalOption(args, '--start-date'),
        endDate: getOptionalOption(args, '--end-date'),
        excludeParking: getOptionalOption(args, '--exclude-parking'),
        detailStartTime: getOptionalOption(args, '--detail-start-time'),
        detailEndTime: getOptionalOption(args, '--detail-end-time'),
    });
    throw new Error('未知命令。请运行 xiaomiev help 查看使用说明。');
};

run().then((data) => {
    if (data !== undefined) process.stdout.write(`${JSON.stringify(data)}\n`);
}).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : '执行失败'}\n`);
    process.exitCode = 1;
});
