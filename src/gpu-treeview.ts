import * as vscode from "vscode";
import { configurations } from "./config";
import { SmiInfo, SmiEvent, GpuInfo } from "./gpu-info-service";
import { NVIDIA_SMI_FIELDS, ROCM_SMI_FIELDS } from "./nvidia-smi-fields";

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

function itemLabel(itemId: string, _itemValue: string | number): string {
  const exec = configurations.get("executablePath", undefined, "");
  if (exec.includes("rocm")) {
    const field = ROCM_SMI_FIELDS[itemId];
    return `${field.label}`;
  } else {
    const field = NVIDIA_SMI_FIELDS[itemId];
    return `${field.label}`;
  }
}

function itemDescription(itemId: string, itemValue: string | number): string {
  return `${itemValue}`;
}

function gpuInfoItems(gpu: GpuInfo): GPUItem[] {
  const infoItemsToShow = configurations.get("view.gpuItems");
  const exec = configurations.get("executablePath", undefined, "");

  if (!infoItemsToShow) {
    return [];
  } else {
    const items = [];
    for (const infoId of infoItemsToShow) {
      let iconPath: string = ""
      if (exec.includes("rocm")) {
        iconPath = ROCM_SMI_FIELDS[infoId].iconPath!
      } else {
        iconPath = NVIDIA_SMI_FIELDS[infoId].iconPath!
      }
      items.push(
        new GPUItem(
          itemLabel(infoId, gpu[infoId]),
          vscode.TreeItemCollapsibleState.None,
          GPUTreeItemType.gpuInfoItem,
          itemDescription(infoId, gpu[infoId]),
          iconPath
        )
      );
    }
    return items;
  }
}

function gpusInfo(info: SmiInfo): GPUItem[] {
  const gpuMainDescription = configurations.get("view.gpuMainDescription");

  return info.gpus.map(
    (gpu) =>
      new GPUItem(
        `GPU ${gpu.id}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        GPUTreeItemType.gpuItem,
        (gpuMainDescription ? itemDescription(gpuMainDescription, gpu[gpuMainDescription]) : undefined) ?? "",
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

  private _currentInfo: SmiInfo | undefined;

  refresh(event: SmiEvent): void {
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
