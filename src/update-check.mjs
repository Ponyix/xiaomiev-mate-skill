const TAGS_URL = 'https://api.github.com/repos/Ponyix/xiaomiev-mate-skill/tags?per_page=100';
const TAGS_FEED_URL = 'https://github.com/Ponyix/xiaomiev-mate-skill/tags.atom';

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

async function getTags(url, fetchImpl, feed) {
    try {
        const response = await fetchImpl(url, {
            headers: {Accept: feed ? 'application/atom+xml' : 'application/vnd.github+json'},
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        if (feed) {
            const xml = await response.text();
            return [...xml.matchAll(/<entry\b[\s\S]*?<title>\s*(v?\d+\.\d+\.\d+)\s*<\/title>[\s\S]*?<\/entry>/g)]
                .map(match => match[1]);
        }
        const tags = await response.json();
        return Array.isArray(tags) ? tags.map(tag => tag?.name) : null;
    } catch { return null; }
}

export async function checkUpdate(currentVersion, fetchImpl = fetch) {
    const current = parseVersion(currentVersion);
    if (!current) return {status: 'unknown', currentVersion, reason: '本地版本格式无效'};
    let tags = await getTags(TAGS_URL, fetchImpl, false);
    if (!tags?.length) tags = await getTags(TAGS_FEED_URL, fetchImpl, true);
    if (!tags) return {status: 'unknown', currentVersion, reason: '无法连接版本服务'};
    const versions = tags.map(parseVersion).filter(Boolean).sort((a, b) => compareVersions(b, a));
    if (!versions.length) return {status: 'unknown', currentVersion, reason: '暂未找到正式版本'};
    const latestVersion = versions[0].join('.');
    return {status: compareVersions(versions[0], current) > 0 ? 'update_available' : 'up_to_date',
        currentVersion, latestVersion};
}
