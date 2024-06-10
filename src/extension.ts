import * as vscode from "vscode";
import { configurations } from "./config";
import { SmiService, NvidiaSmiService, RocmSmiService, openAsJsonFile } from "./gpu-info-service";
import { GPUInfoProvider } from "./gpu-treeview";

let smiService: SmiService | undefined;

export function updateNvidiaInfo(): void {
  smiService?.update();
}

export async function setAutoRefresh(value: boolean): Promise<void> {
  await configurations.update("refresh.autoRefresh", value);
  smiService?.setAutoUpdate();
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const exec = configurations.get("executablePath", undefined, "");
  if (exec.includes("rocm")) {
    smiService = new RocmSmiService();
  } else {
    smiService = new NvidiaSmiService();
  }
  context.subscriptions.push(smiService);

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
  smiService.onDidInfoAcquired(gpuInfoProvider.refresh, gpuInfoProvider);
  vscode.window.registerTreeDataProvider("nvidia-gpus", gpuInfoProvider);

  const configChange = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("nvidia-smi-plus.refresh")) {
      smiService?.setAutoUpdate();
    }
    if (event.affectsConfiguration("nvidia-smi-plus")) {
      smiService?.update();
    }
  });
  context.subscriptions.push(configChange);

  await vscode.commands.executeCommand("nvidia-smi-plus.refresh");
}
