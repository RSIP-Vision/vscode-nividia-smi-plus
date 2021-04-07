import * as vscode from 'vscode';
import { NvidiaSmiInfo, NvidiaSmiEvent, GpuInfo, NVIDIA_SMI_FIELDS } from './gpu-info-service'
import { valueOr } from './utils';


enum GPUTreeItemType {
    GPUItem = "GPUItem",
    GPUInfoItem = "GPUInfoItem",
}

class GPUItem extends vscode.TreeItem {

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: GPUTreeItemType,
        public readonly description: string = "",
        public readonly nestedItems: GPUItem[] = [],
    ) {
        super(label, collapsibleState);
        this.contextValue = itemType;

    }
}

function itemLabel(itemId: string, itemValue: any): string {
    const field = NVIDIA_SMI_FIELDS[itemId];
    return `${field.label}`;
}

function itemDescription(itemId: string, itemValue: any): string {
    return `${itemValue}`;
}

function gpuInfoItems(gpu: GpuInfo): GPUItem[] {
    const infoItemsToShow = vscode.workspace.getConfiguration(
        'nvidia-smi-plus'
    ).get<string[]>('view.gpuItems');

    if (!infoItemsToShow) {
        return [];
    }
    else {
        const items = [];
        for (const infoId of infoItemsToShow) {
            items.push(
                new GPUItem(
                    itemLabel(infoId, gpu[infoId]),
                    vscode.TreeItemCollapsibleState.None,
                    GPUTreeItemType.GPUInfoItem,
                    itemDescription(infoId, gpu[infoId]),
                )
            );
        }
        return items;
    }
}

function gpusInfo(info: NvidiaSmiInfo): GPUItem[] {
    const gpuDescId = vscode.workspace.getConfiguration('nvidia-smi-plus').get<string>('view.gpuDesc');

    return info.gpus.map(gpu => new GPUItem(
        `GPU ${gpu.id}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        GPUTreeItemType.GPUItem,
        valueOr(gpuDescId ? gpu[gpuDescId] : undefined, ""),
        gpuInfoItems(gpu),
    ));
}

export class GPUInfoProvider implements vscode.TreeDataProvider<GPUItem> {

    constructor() { }

    private _onDidChangeTreeData = new vscode.EventEmitter<GPUItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _currentInfo: NvidiaSmiInfo | undefined;

    refresh(event: NvidiaSmiEvent) {
        this._currentInfo = event.info;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: GPUItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GPUItem): Thenable<GPUItem[]> {
        if (!element)
            if (this._currentInfo)
                return Promise.resolve(gpusInfo(this._currentInfo));
            else
                return Promise.resolve([]);

        else if (element.itemType === GPUTreeItemType.GPUItem)
            return Promise.resolve(element.nestedItems);

        else
            return Promise.resolve([]);

    }
}