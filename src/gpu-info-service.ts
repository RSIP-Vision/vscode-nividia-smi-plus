import * as vscode from 'vscode';

var parser = require('fast-xml-parser');
import { spawn } from 'child_process';
import { CronJob } from 'cron';
import { shallowEqual, replaceAll } from './utils';

enum InfoFieldType {
    Expr,
    Value,
}
class InfoField {
    constructor(
        public readonly type: InfoFieldType,
        public readonly label: string,
        public readonly accessor: string[] | string,
        public readonly depends?: string[],
        public readonly iconPath?: vscode.Uri | string,
    ) { }
}

// for `Expr` Field, the order is sinificant. you can't refernce a field that has not beed calculated yet.
export const NVIDIA_SMI_FIELDS: Record<string, InfoField> = {
    gpu_temp: new InfoField(InfoFieldType.Value, 'GPU Temperature', ['temperature', 'gpu_temp']),
    gpu_util: new InfoField(InfoFieldType.Value, 'GPU Utilization', ['utilization', 'gpu_util']),
    memory_util: new InfoField(InfoFieldType.Value, 'Memory Utilization', ['utilization', 'memory_util']),
    memory_total: new InfoField(InfoFieldType.Value, 'Total memory', ['fb_memory_usage', 'total']),
    memory_free: new InfoField(InfoFieldType.Value, 'Free memory', ['fb_memory_usage', 'free']),
    memory_used: new InfoField(InfoFieldType.Value, 'Used memory', ['fb_memory_usage', 'used']),
    memory_used_percent: new InfoField(
        InfoFieldType.Expr,
        "Memory Used (%)",
        '`${Math.trunc(("{memory_used}").replace(" MiB", "") / ("{memory_total}").replace(" MiB", "") * 100)} %`',
        ['memory_used', 'memory_total']),

    fan_speed: new InfoField(InfoFieldType.Value, "Fan speed", ['fan_speed']),
    product_name: new InfoField(InfoFieldType.Value, "Produc Name", ['product_name']),
};

function resolveGpuInfoField(gpuInfo: any, field: InfoField, values: Record<string, any>): any {
    switch (field.type) {
        case InfoFieldType.Value:
            let val = gpuInfo;
            for (const key of field.accessor) val = val[key];
            return val;
        case InfoFieldType.Expr:
            if (typeof field.accessor !== 'string') return "!Error!";
            let str = field.accessor;
            field.depends?.forEach(name => {
                str = replaceAll(str, `{${name}}`, `${values[name]}`);
            });
            try {
                const value = eval(str);
                return value;
            } catch (err) {
                console.log(`evaluation failed`, err);
                return undefined;
            }
    }
}

export type GpuInfo = {
    id: number;
    [key: string]: any;
};

export type NvidiaSmiInfo = {
    gpus: GpuInfo[];
};


export interface NvidiaSmiEvent {
    info: NvidiaSmiInfo
}

function asCronTime(seconds: number) {
    if (seconds < 60) {
        return `*/${seconds} * * * * *`;
    } else if (seconds < 3600) {
        let minutes = Math.trunc(seconds / 60);
        seconds = seconds % 60;
        return `*/${seconds} */${minutes} * * * *`;
    } else {
        return `* * 1 * * *`;
    }
}

type RefreshConfig = {
    autoRefresh: boolean
    refreshInterval: number
}
function refreshConfiguration(): RefreshConfig {
    const extConfig = vscode.workspace.getConfiguration('nvidia-smi-plus');

    const autoRefresh = extConfig.get<boolean>('refresh.autoRefresh')
    const seconds = extConfig.get<number>('refresh.timeInterval');
    return {
        autoRefresh: Boolean(autoRefresh),
        refreshInterval: seconds ? seconds : 0,
    }

}

export class NvidiaSmiService implements vscode.Disposable {
    private _updateInfoJob: CronJob | undefined;
    private _currentRefereshSettings: RefreshConfig | undefined;

    constructor() {
        this.setAutoUpdate();
    }

    setAutoUpdate() {
        const currentConfig = refreshConfiguration();
        if (!this._currentRefereshSettings || !shallowEqual(this._currentRefereshSettings, currentConfig)) {
            this._currentRefereshSettings = currentConfig;
            this._updateInfoJob?.stop();
            if (this._currentRefereshSettings.autoRefresh) {
                const seconds = this._currentRefereshSettings.refreshInterval;
                this._updateInfoJob = new CronJob(asCronTime(seconds), () => this.update());
                if (!this._updateInfoJob.running) {
                    this._updateInfoJob.start();
                }
            }
        }
    }

    private readonly _onDidInfoAquired = new vscode.EventEmitter<NvidiaSmiEvent>();
    readonly onDidInfoAquired = this._onDidInfoAquired.event;

    private _currentState: NvidiaSmiInfo | undefined;

    async update(): Promise<void> {
        this._currentState = await this.currentNvidiaStatus();
        if (this._currentState) {
            this._onDidInfoAquired.fire({ info: this._currentState });
        }
    }

    async currentNvidiaStatus(): Promise<NvidiaSmiInfo | undefined> {
        try {
            const jsonObj = await nvidiaSmiAsJsonObject();
            const gpus: GpuInfo[] = [];
            for (const [gpuId, gpuInfo] of jsonObj.nvidia_smi_log.gpu.entries()) {
                const gpuInfoFields: Record<string, any> = {};
                for (const [name, field] of Object.entries(NVIDIA_SMI_FIELDS)) {
                    gpuInfoFields[name] = resolveGpuInfoField(gpuInfo, field, gpuInfoFields);
                }
                gpus.push({
                    id: gpuId,
                    ...gpuInfoFields,
                });
            }
            return {
                gpus: gpus,
            };
        } catch (error) {
            console.log(error.message)
        }
    }

    dispose() {
        if (this._updateInfoJob?.running) {
            this._updateInfoJob.stop();
        }
    }
}

export async function nvidiaSmiAsJsonObject() {
    const child = spawn("nvidia-smi", ["-q", "-x"]);
    let xmlData = '';
    for await (const data of child.stdout) {
        xmlData += data.toString();
    };
    const jsonObj = parser.parse(xmlData, {}, true);

    // for a system with a single GPU
    if (!Array.isArray(jsonObj.nvidia_smi_log.gpu))
        jsonObj.nvidia_smi_log.gpu = [jsonObj.nvidia_smi_log.gpu];

    return jsonObj;
}

export async function openAsJsonFile() {
    const jsonObj = await nvidiaSmiAsJsonObject();

    const fileName = 'nvidia-smi.json';
    const newUri = vscode.Uri.file(fileName).with({ scheme: 'untitled', path: fileName });

    const document = await vscode.workspace.openTextDocument(newUri);
    const textEdit = await vscode.window.showTextDocument(document);
    await textEdit.edit(edit => edit.insert(new vscode.Position(0, 0), JSON.stringify(jsonObj, undefined, 4)));
}