import * as vscode from "vscode";
import { spawn } from "child_process";
import { CronJob } from "cron";
import { json, shallowEqual } from "./utils";
import { NVIDIA_SMI_FIELDS, ROCM_SMI_FIELDS, resolveGpuInfoField } from "./nvidia-smi-fields";
import { configurations } from "./config";

/* eslint-disable */
const { XMLParser } = require("fast-xml-parser");

type NvidiaSmiInfoJson = {
  nvidia_smi_log: {
    gpu: json[]
  }
}

export type GpuInfo = {
  id: string | number;
  [key: string]: string | number;
};

export type SmiInfo = {
  gpus: GpuInfo[];
};

export interface SmiEvent {
  info: SmiInfo;
}

function asCronTime(seconds: number) {
  if (seconds < 60) {
    return `*/${seconds} * * * * *`;
  } else if (seconds < 3600) {
    const minutes = Math.trunc(seconds / 60);
    seconds = seconds % 60;
    return `*/${seconds} */${minutes} * * * *`;
  } else {
    return `* * 1 * * *`;
  }
}

type RefreshConfig = {
  autoRefresh: boolean;
  refreshInterval: number;
};
function refreshConfiguration(): RefreshConfig {
  const autoRefresh = configurations.get("refresh.autoRefresh");
  const seconds = configurations.get("refresh.timeInterval");
  return {
    autoRefresh: Boolean(autoRefresh),
    refreshInterval: seconds ? seconds : 0,
  };
}

export abstract class SmiService implements vscode.Disposable {
  private _updateInfoJob: CronJob | undefined;
  private _currentRefreshSettings: RefreshConfig | undefined;

  constructor() {
    this.setAutoUpdate();
  }

  protected readonly _onDidInfoAcquired =
    new vscode.EventEmitter<SmiEvent>();
  readonly onDidInfoAcquired = this._onDidInfoAcquired.event;

  abstract update(): void;

  setAutoUpdate(): void {
    const currentConfig = refreshConfiguration();
    if (
      !this._currentRefreshSettings ||
      !shallowEqual(this._currentRefreshSettings, currentConfig)
    ) {
      this._currentRefreshSettings = currentConfig;
      this._updateInfoJob?.stop();
      if (this._currentRefreshSettings.autoRefresh) {
        const seconds = this._currentRefreshSettings.refreshInterval;
        this._updateInfoJob = new CronJob(asCronTime(seconds), () =>
          this.update()
        );
        if (!this._updateInfoJob.running) {
          this._updateInfoJob.start();
        }
      }
    }
  }

  dispose(): void {
    if (this._updateInfoJob?.running) {
      this._updateInfoJob.stop();
    }
  }
}

export class RocmSmiService extends SmiService {
  constructor() {
    super()
  }

  private _currentState: SmiInfo | undefined;

  async update(): Promise<void> {
    this._currentState = await this.currentRocmStatus();
    if (this._currentState) {
      this._onDidInfoAcquired.fire({ info: this._currentState });
    }
  }

  async currentRocmStatus(): Promise<SmiInfo | undefined> {
    try {
      const jsonObj: json = await rocmSmiAsJsonObject();
      const gpus: GpuInfo[] = [];
      for (let [gpuId, gpuInfo] of Object.entries(jsonObj!)) {
        if (!gpuId.includes("card"))
          continue

        const gpuInfoFields: Record<string, number | string> = {};
        for (const [name, field] of Object.entries(ROCM_SMI_FIELDS)) {
          gpuInfoFields[name] = resolveGpuInfoField(
            gpuInfo,
            field,
            gpuInfoFields
          ) ?? "null";
        }
        gpus.push({
          id: gpuId,
          ...gpuInfoFields,
        });
      }
      return {
        gpus: gpus,
      }
    } catch (error) {
      console.error(error);
    }
  }
}

export class NvidiaSmiService extends SmiService {
  private _currentState: SmiInfo | undefined;

  async update(): Promise<void> {
    this._currentState = await this.currentNvidiaStatus();
    if (this._currentState) {
      this._onDidInfoAcquired.fire({ info: this._currentState });
    }
  }

  async currentNvidiaStatus(): Promise<SmiInfo | undefined> {
    try {
      const jsonObj = await nvidiaSmiAsJsonObject();
      const gpus: GpuInfo[] = [];
      for (const [gpuId, gpuInfo] of jsonObj?.nvidia_smi_log.gpu.entries()) {
        const gpuInfoFields: Record<string, number | string> = {};
        for (const [name, field] of Object.entries(NVIDIA_SMI_FIELDS)) {
          gpuInfoFields[name] = resolveGpuInfoField(
            gpuInfo,
            field,
            gpuInfoFields
          ) ?? "null";
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
      console.error(error);
    }
  }
}

export async function rocmSmiAsJsonObject(): Promise<json> {
  const exec = configurations.get("executablePath", undefined, "rocm-smi");

  const child = spawn(exec, ["--showallinfo", "--showfan", "--showmeminfo", "VRAM", "--json"]);
  let jsonData = "";
  for await (const data of child.stdout) {
    jsonData += data.toString();
  }
  const jsonObj: json = JSON.parse(jsonData)

  return jsonObj;
}

export async function nvidiaSmiAsJsonObject(): Promise<NvidiaSmiInfoJson> {
  const exec = configurations.get("executablePath", undefined, "nvidia-smi");

  const child = spawn(exec, ["-q", "-x"]);
  let xmlData = "";
  for await (const data of child.stdout) {
    xmlData += data.toString();
  }
  const parser = new XMLParser();
  const jsonObj: NvidiaSmiInfoJson = parser.parse(xmlData, {}, true);

  // for a system with a single GPU
  if (!Array.isArray(jsonObj.nvidia_smi_log.gpu)) {
    jsonObj.nvidia_smi_log.gpu = [jsonObj.nvidia_smi_log.gpu];
  }

  return jsonObj;
}

export async function openAsJsonFile(): Promise<void> {
  const exec = configurations.get("executablePath", undefined, "");
  let jsonObj: json;
  let fileName;
  if (exec.includes("rocm")) {
    jsonObj = await rocmSmiAsJsonObject()
    fileName = "rocm-smi.json";
  }
  else {
    jsonObj = await nvidiaSmiAsJsonObject();
    fileName = "nvidia-smi.json";
  }

  const newUri = vscode.Uri.file(fileName).with({
    scheme: "untitled",
    path: fileName,
  });

  const document = await vscode.workspace.openTextDocument(newUri);
  const textEdit = await vscode.window.showTextDocument(document);
  await textEdit.edit((edit) =>
    edit.insert(
      new vscode.Position(0, 0),
      JSON.stringify(jsonObj, undefined, 4)
    )
  );
}
