import * as vscode from "vscode";
import { configurations } from "./config";

import { NvidiaSmiService, openAsJsonFile } from "./gpu-info-service";
import { GPUInfoProvider } from "./gpu-treeview";

let nvidiaSmiService: NvidiaSmiService | undefined;

export function updateNvidiaInfo(): void {
  nvidiaSmiService?.update();
}

export async function setAutoRefresh(value: boolean): Promise<void> {
  await configurations.update("refresh.autoRefresh", value);
  nvidiaSmiService?.setAutoUpdate();
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  nvidiaSmiService = new NvidiaSmiService();
  context.subscriptions.push(nvidiaSmiService);

  const nvidiaRefreshCmd = vscode.commands.registerCommand(
    "nvidia-smi-plus.refresh",
    updateNvidiaInfo
  );
  context.subscriptions.push(nvidiaRefreshCmd);

  const nvidiaEnableAutoRefreshCmd = vscode.commands.registerCommand(
    "nvidia-smi-plus.enable-auto-refresh",
    () => setAutoRefresh(true)
  );
  context.subscriptions.push(nvidiaEnableAutoRefreshCmd);
  const nvidiaDisableAutoRefreshCmd = vscode.commands.registerCommand(
    "nvidia-smi-plus.disable-auto-refresh",
    () => setAutoRefresh(false)
  );
  context.subscriptions.push(nvidiaDisableAutoRefreshCmd);

  const nvidiaOpenJsonCmd = vscode.commands.registerCommand(
    "nvidia-smi-plus.open-json",
    () => openAsJsonFile()
  );
  context.subscriptions.push(nvidiaOpenJsonCmd);

  const gpuInfoProvider = new GPUInfoProvider();
  nvidiaSmiService.onDidInfoAcquired(gpuInfoProvider.refresh, gpuInfoProvider);
  vscode.window.registerTreeDataProvider("nvidia-gpus", gpuInfoProvider);

  const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("nvidia-smi-plus.refresh")) {
      nvidiaSmiService?.setAutoUpdate();
    }
    if (event.affectsConfiguration("nvidia-smi-plus")) {
      nvidiaSmiService?.update();
    }
  });
  context.subscriptions.push(configChange);

  await vscode.commands.executeCommand("nvidia-smi-plus.refresh");
}
