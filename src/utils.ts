
export function shallowEqual(object1: Record<string, unknown>, object2: Record<string, unknown>): boolean {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (object1[key] !== object2[key]) {
            return false;
        }
    }

    return true;
}

export function replaceAll(string: string, search: string | RegExp, replace: string): string {
    return string.split(search).join(replace);
}

export type json =
  | string
  | number
  | boolean
  | null
  | json[]
  | { [key: string]: json }