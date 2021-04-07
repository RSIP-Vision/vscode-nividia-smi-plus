import * as vscode from 'vscode';

import { NvidiaSmiService } from './gpu-info-service'
import { GPUInfoProvider } from './gpu-treeview';

let nvidiaSmiService: NvidiaSmiService | undefined;

export function updateNvidiaInfo() {
	nvidiaSmiService?.update();
}

export async function setAutoRefresh(value: boolean) {
	const config = vscode.workspace.getConfiguration('nvidia-smi-plus');
	await config.update('refresh.autoRefresh', value);
	nvidiaSmiService?.setAutoUpdate();
}

export async function activate(context: vscode.ExtensionContext) {
	nvidiaSmiService = new NvidiaSmiService();
	context.subscriptions.push(nvidiaSmiService);

	const nvidiaRefreshCmd = vscode.commands.registerCommand('nvidia-smi-plus.refresh', updateNvidiaInfo);
	context.subscriptions.push(nvidiaRefreshCmd);

	const nvidiaEnableAutoRefreshCmd = vscode.commands.registerCommand(
		'nvidia-smi-plus.enable-auto-refresh', () => setAutoRefresh(true));
	context.subscriptions.push(nvidiaEnableAutoRefreshCmd);
	const nvidiaDisableAutoRefreshCmd = vscode.commands.registerCommand(
		'nvidia-smi-plus.disable-auto-refresh', () => setAutoRefresh(false));
	context.subscriptions.push(nvidiaDisableAutoRefreshCmd);

	const gpuInfoProvider = new GPUInfoProvider();
	nvidiaSmiService.onDidInfoAquired(gpuInfoProvider.refresh, gpuInfoProvider);
	vscode.window.registerTreeDataProvider(
		'nvidia-gpus',
		gpuInfoProvider
	);

	const configChange = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration("nvidia-smi-plus.refresh")) {
			nvidiaSmiService?.setAutoUpdate();
		}
		if (event.affectsConfiguration("nvidia-smi-plus")) {
			nvidiaSmiService?.update();
		}
	});
	context.subscriptions.push(configChange);

	context.extension.exports

	await vscode.commands.executeCommand('nvidia-smi-plus.refresh');
}

// this method is called when your extension is deactivated
export function deactivate() { }