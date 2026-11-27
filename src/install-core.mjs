import {access, stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {delimiter, join} from 'node:path';

export const AGENTS = [
    {id: 'codex', name: 'Codex', commands: ['codex'], apps: ['/Applications/Codex.app', '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app'], config: '.codex'},
    {id: 'claude-code', name: 'Claude Code', commands: ['claude'], apps: ['/Applications/Claude.app'], config: '.claude'},
    {id: 'cursor', name: 'Cursor', commands: ['cursor'], apps: ['/Applications/Cursor.app'], config: '.cursor'},
    {id: 'opencode', name: 'OpenCode', commands: ['opencode'], config: '.config/opencode'},
    {id: 'gemini-cli', name: 'Gemini CLI', commands: ['gemini'], config: '.gemini'},
    {id: 'github-copilot', name: 'GitHub Copilot CLI', commands: ['copilot'], config: '.copilot'},
    {id: 'cline', name: 'Cline CLI', commands: ['cline'], config: '.cline'},
    {id: 'openclaw', name: 'OpenClaw', commands: ['openclaw'], config: '.openclaw'},
    {id: 'antigravity', name: 'Antigravity', commands: ['antigravity'], apps: ['/Applications/Antigravity.app'], config: '.gemini/antigravity'},
    {id: 'windsurf', name: 'Windsurf', commands: ['windsurf'], apps: ['/Applications/Windsurf.app'], config: '.codeium/windsurf'},
];

async function exists(path, executable = false) {
    try {
        await access(path, executable && process.platform !== 'win32' ? constants.X_OK : constants.F_OK);
        return !executable || (await stat(path)).isFile();
    } catch { return false; }
}

export async function detectAgents({home, path = '', platform = process.platform, appPaths = true} = {}) {
    const dirs = path.split(delimiter).filter(Boolean);
    const extensions = platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
    return Promise.all(AGENTS.map(async agent => {
        let installed = false;
        for (const command of agent.commands) {
            for (const dir of dirs) {
                for (const extension of extensions) {
                    if (await exists(join(dir, command + extension), true)) installed = true;
                }
            }
        }
        if (!installed && platform === 'darwin' && appPaths) {
            for (const app of agent.apps || []) if (await exists(app)) installed = true;
        }
        const configured = agent.id === 'codex' && process.env.CODEX_HOME
            ? await exists(process.env.CODEX_HOME) : await exists(join(home, agent.config));
        return {...agent, installed, configured};
    }));
}

export function parseSelection(input, choices) {
    const indices = input.trim().split(/[\s,，]+/).filter(Boolean);
    if (!indices.length || indices.some(value => !/^\d+$/.test(value))) throw new Error('请输入要安装的编号，多个编号用逗号分隔');
    const result = [...new Set(indices.map(value => Number(value)))];
    if (result.some(number => number < 1 || number > choices.length)) throw new Error('选择的编号超出范围');
    return result.map(number => choices[number - 1].id);
}
