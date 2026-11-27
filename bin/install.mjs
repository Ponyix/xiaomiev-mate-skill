#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {detectAgents, parseSelection} from '../src/install-core.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 20)) {
    console.error('安装器需要 Node.js 22.20.0 或更新版本，请先切换 Node.js。');
    process.exit(1);
}
const {createInterface} = await import('node:readline/promises');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function run(command, argv) {
    return new Promise((resolve, reject) => {
        const env = {...process.env};
        delete env.npm_config_package;
        const child = spawn(command, argv, {stdio: 'inherit', env, shell: process.platform === 'win32'});
        child.on('error', reject);
        child.on('close', (code, signal) => code === 0 ? resolve() : reject(new Error(`安装未完成：${signal || code}`)));
    });
}

async function ask(question) {
    const prompt = createInterface({input: process.stdin, output: process.stdout});
    try { return (await prompt.question(question)).trim(); }
    finally { prompt.close(); process.stdin.pause(); }
}

async function configState() {
    const base = process.platform === 'win32' ? (process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'))
        : (process.env.XDG_CONFIG_HOME || join(homedir(), '.config'));
    const file = process.env.XIAOMIEV_AGENT_CONFIG || join(base, 'xiaomiev-mate-agent', 'config.json');
    try {
        const config = JSON.parse(await readFile(file, 'utf8'));
        return config.baseUrl && config.apiKey ? 'configured' : 'incomplete';
    } catch (error) {
        return error.code === 'ENOENT' ? 'missing' : 'incomplete';
    }
}

async function main() {
    if (args.includes('--help') || args.includes('-h')) {
        console.log('用法：npx --yes github:Ponyix/xiaomiev-mate-skill [--agent codex,claude-code] [--skip-config]');
        return;
    }
    const index = args.indexOf('--agent');
    const raw = index >= 0 ? args[index + 1] : null;
    if (index >= 0 && (!raw || raw.startsWith('--'))) throw new Error('--agent 需要 Agent 标识');
    const unknown = args.filter((arg, position) => arg !== '--agent' && arg !== '--skip-config' && (index < 0 || position !== index + 1));
    if (unknown.length) throw new Error('不支持的参数：' + unknown.join(' '));
    let selected = raw ? raw.split(',').map(item => item.trim()).filter(Boolean) : [];
    if (selected.some(id => !/^[a-z0-9][a-z0-9-]*$/.test(id))) throw new Error('Agent 标识无效');
    if (!selected.length) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('请在交互终端运行，或通过 --agent 指定 Agent');
        const detected = await detectAgents({home: homedir(), path: process.env.PATH || ''});
        const choices = detected.filter(agent => agent.installed || agent.configured);
        console.log('检测到的 Agent（仅配置痕迹不代表软件当前仍已安装）：');
        if (choices.length) choices.forEach((agent, i) => console.log(`${i + 1}. ${agent.name}${agent.installed ? '（已检测到程序）' : '（仅发现配置）'}`));
        else console.log('未检测到已安装的 Agent。');
        console.log('m. 手动输入其他 Agent 标识    q. 退出');
        const answer = await ask('请选择编号（多个用逗号分隔），或输入 m：');
        if (answer.toLowerCase() === 'q') return;
        if (answer.toLowerCase() === 'm') {
            const manual = await ask('输入 Agent 标识（例如 cursor、github-copilot；多个用逗号分隔）：');
            selected = [...new Set(manual.split(/[,，\s]+/).filter(Boolean))];
            if (!selected.length || selected.some(id => !/^[a-z0-9][a-z0-9-]*$/.test(id))) throw new Error('Agent 标识无效');
        } else selected = parseSelection(answer, choices);
    }
    console.log(`正在安装到：${selected.join(', ')}`);
    await run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'skills', 'add', 'Ponyix/xiaomiev-mate-skill', '-g', '-a', ...selected, '-y']);
    if (args.includes('--skip-config')) {
        console.log('已跳过配置；后续可运行 Skill 目录中的 node src/xiaomiev.mjs setup。');
        return;
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.log('安装完成。请在本机交互终端运行 Skill 目录中的 node src/xiaomiev.mjs setup。');
        return;
    }
    const state = await configState();
    const existing = state !== 'missing';
    const prompt = state === 'incomplete' ? '检测到现有配置文件但无法读取完整配置，是否重新配置？[y/N]：'
        : existing ? '检测到已有连接配置，是否重新配置？[y/N]：' : '现在配置服务地址和 API Key？[Y/n]：';
    const answer = await ask(prompt);
    if (existing ? answer.toLowerCase() !== 'y' : answer.toLowerCase() === 'n') {
        console.log(existing ? '已保留现有配置。' : '已跳过配置，可稍后运行 node src/xiaomiev.mjs setup。');
    } else {
        await run(process.execPath, [join(root, 'src', 'xiaomiev.mjs'), 'setup']);
    }
    console.log('完成后请刷新或重启 Agent，使 Skill 生效。');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
