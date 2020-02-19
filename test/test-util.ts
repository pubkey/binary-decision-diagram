import * as fs from 'fs';

export function readJsonFile(path: string): any {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

export function objectToMap<K, V>(object: {
    [k: string]: V
}): Map<K, V> {
    const ret = new Map();
    Object.entries(object).forEach(([k, v]) => {
        ret.set(k, v);
    });
    return ret;
}
