import * as vscode from "vscode";
import { configurations } from "./config";
import { NvidiaSmiInfo, NvidiaSmiEvent, GpuInfo } from "./gpu-info-service";
import { NVIDIA_SMI_FIELDS } from "./nvidia-smi-fields";

enum GPUTreeItemType {
  gpuItem = "GPUItem",
  gpuInfoItem = "GPUInfoItem",
}

class GPUItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: GPUTreeItemType,
    public readonly description: string = "",
    public readonly iconPath?: vscode.Uri | string,
    public readonly nestedItems: GPUItem[] = []
  ) {
    super(label, collapsibleState);
    this.contextValue = itemType;
  }
}

function itemLabel(itemId: string, _itemValue: any): string {
  const field = NVIDIA_SMI_FIELDS[itemId];
  return `${field.label}`;
}

function itemDescription(itemId: string, itemValue: any): string {
  return `${itemValue}`;
}

function gpuInfoItems(gpu: GpuInfo): GPUItem[] {
  const infoItemsToShow = configurations.get("view.gpuItems");

  if (!infoItemsToShow) {
    return [];
  } else {
    const items = [];
    for (const infoId of infoItemsToShow) {
      items.push(
        new GPUItem(
          itemLabel(infoId, gpu[infoId]),
          vscode.TreeItemCollapsibleState.None,
          GPUTreeItemType.gpuInfoItem,
          itemDescription(infoId, gpu[infoId]),
          NVIDIA_SMI_FIELDS[infoId].iconPath
        )
      );
    }
    return items;
  }
}

function gpusInfo(info: NvidiaSmiInfo): GPUItem[] {
  const gpuMainDescription = configurations.get("view.gpuMainDescription");

  return info.gpus.map(
    (gpu) =>
      new GPUItem(
        `GPU ${gpu.id}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        GPUTreeItemType.gpuItem,
        (gpuMainDescription ? gpu[gpuMainDescription] : undefined) ?? "",
        undefined,
        gpuInfoItems(gpu)
      )
  );
}

export class GPUInfoProvider implements vscode.TreeDataProvider<GPUItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    GPUItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _currentInfo: NvidiaSmiInfo | undefined;

  refresh(event: NvidiaSmiEvent): void {
    this._currentInfo = event.info;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: GPUItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GPUItem): Thenable<GPUItem[]> {
    if (!element) {
      if (this._currentInfo) {
        return Promise.resolve(gpusInfo(this._currentInfo));
      } else {
        return Promise.resolve([]);
      }
    } else if (element.itemType === GPUTreeItemType.gpuItem) {
      return Promise.resolve(element.nestedItems);
    } else {
      return Promise.resolve([]);
    }
  }
}
