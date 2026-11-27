const TAGS_URL = 'https://api.github.com/repos/Ponyix/xiaomiev-mate-skill/tags?per_page=100';

export function parseVersion(value) {
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
    return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(left, right) {
    for (let index = 0; index < 3; index++) {
        if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
    }
    return 0;
}

export async function checkUpdate(currentVersion, fetchImpl = fetch) {
    const current = parseVersion(currentVersion);
    if (!current) return {status: 'unknown', currentVersion, reason: '本地版本格式无效'};
    try {
        const response = await fetchImpl(TAGS_URL, {
            headers: {Accept: 'application/vnd.github+json'},
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return {status: 'unknown', currentVersion, reason: `版本服务不可用（HTTP ${response.status}）`};
        const tags = await response.json();
        if (!Array.isArray(tags)) return {status: 'unknown', currentVersion, reason: '版本信息格式无效'};
        const versions = tags.map(tag => ({name: tag?.name, parsed: parseVersion(tag?.name)}))
            .filter(item => item.parsed)
            .sort((a, b) => compareVersions(b.parsed, a.parsed));
        if (!versions.length) return {status: 'unknown', currentVersion, reason: '暂未找到正式版本'};
        const latestVersion = versions[0].parsed.join('.');
        return {status: compareVersions(versions[0].parsed, current) > 0 ? 'update_available' : 'up_to_date',
            currentVersion, latestVersion};
    } catch {
        return {status: 'unknown', currentVersion, reason: '无法连接版本服务'};
    }
}
