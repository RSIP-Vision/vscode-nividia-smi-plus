// keep the NVIDIA_SMI_FIELDS records in snake_case to match the configuration style
/* eslint-disable @typescript-eslint/naming-convention */
import { json, replaceAll } from './utils';

enum InfoFieldType {
    expr,
    value,
}

export class InfoField {
    constructor(
        public readonly type: InfoFieldType,
        public readonly label: string,
        public readonly accessor: string[] | string,
        public readonly depends?: string[],
        public readonly iconPath?: string,
    ) { }
}

// for `Expr` Field, the order is significant. you can't reference a field that has not beed calculated yet.
export const NVIDIA_SMI_FIELDS: Record<string, InfoField> = {
    gpu_temp: new InfoField(InfoFieldType.value, 'GPU Temperature', ['temperature', 'gpu_temp']),
    gpu_util: new InfoField(InfoFieldType.value, 'GPU Utilization', ['utilization', 'gpu_util']),
    memory_util: new InfoField(InfoFieldType.value, 'Memory Utilization', ['utilization', 'memory_util']),
    memory_total: new InfoField(InfoFieldType.value, 'Total memory', ['fb_memory_usage', 'total']),
    memory_free: new InfoField(InfoFieldType.value, 'Free memory', ['fb_memory_usage', 'free']),
    memory_used: new InfoField(InfoFieldType.value, 'Used memory', ['fb_memory_usage', 'used']),
    memory_used_percent: new InfoField(
        InfoFieldType.expr,
        "Memory Used (%)",
        '`${Math.trunc(("{memory_used}").replace(" MiB", "") / ("{memory_total}").replace(" MiB", "") * 100)} %`',
        ['memory_used', 'memory_total']),

    fan_speed: new InfoField(InfoFieldType.value, "Fan speed", ['fan_speed']),
    product_name: new InfoField(InfoFieldType.value, "Product Name", ['product_name']),
};


// for `Expr` Field, the order is significant. you can't reference a field that has not beed calculated yet.
export const ROCM_SMI_FIELDS: Record<string, InfoField> = {
    gpu_temp: new InfoField(InfoFieldType.value, 'GPU Temperature', ['Temperature (Sensor edge) (C)']),
    gpu_util: new InfoField(InfoFieldType.value, 'GPU Utilization', ['GPU use (%)']),
    memory_util: new InfoField(InfoFieldType.value, 'Memory Utilization', ['GPU memory use (%)']),
    memory_total: new InfoField(InfoFieldType.value, 'Total memory', ['VRAM Total Memory (B)']),
    memory_used: new InfoField(InfoFieldType.value, 'Used memory', ['VRAM Total Used Memory (B)']),
    memory_used_percent: new InfoField(
        InfoFieldType.expr,
        "Memory Used (%)",
        '`${Math.trunc(("{memory_used}") / ("{memory_total}") * 100)} %`',
        ['memory_used', 'memory_total']),
    fan_speed: new InfoField(InfoFieldType.value, "Fan speed", ['Fan speed (%)']),
    product_name: new InfoField(InfoFieldType.value, "Product Name", ['Card series']),
};

export function resolveGpuInfoField(gpuInfo: json, field: InfoField, values: Record<string, string | number>): string | number | undefined {
    switch (field.type) {
        case InfoFieldType.value:
            let val = gpuInfo;
            for (const key of field.accessor) {
                try {
                    // @ts-expect-error. The accessor should be valid by definition.
                    val = val[key];
                }
                catch (e) {
                    console.log(`evaluation failed`, e);
                    return undefined;
                }
            }
            if(typeof val === 'string' || typeof val === 'number') {
                return val;
            }
            else {
                console.log(`evaluation failed`, "expected a number or string");
                return undefined;
            }
        case InfoFieldType.expr:
            if (typeof field.accessor !== 'string') { return "!Error!"; }
            let str = field.accessor;
            field.depends?.forEach(name => {
                str = replaceAll(str, `{${name}}`, `${values[name]}`);
            });
            try {
                const value = (0, eval)(str);
                return value;
            } catch (err) {
                console.log(`evaluation failed`, err);
                return undefined;
            }
    }
}
