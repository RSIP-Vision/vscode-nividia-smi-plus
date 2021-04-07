
export function shallowEqual(object1: any, object2: any) {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (let key of keys1) {
        if (object1[key] !== object2[key]) {
            return false;
        }
    }

    return true;
}

export function replaceAll(string: string, search: string | RegExp, replace: string) {
    return string.split(search).join(replace);
}

export function valueOr<T>(val: T | undefined, or: T): T {
    return val ? val : or;
}