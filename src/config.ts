import { configUtils } from "vscode-extensions-json-generator/utils";

type ItemOption =
  | "product_name"
  | "gpu_temp"
  | "gpu_util"
  | "fan_speed"
  | "memory_util"
  | "memory_total"
  | "memory_free"
  | "memory_used"
  | "memory_used_percent";


export interface Config {
  /**
   * @title nvidia-smi Path
   * @default "nvidia-smi"
   */
  executablePath: string;

  /**
   * @title Auto Refresh
   * @default true
   */
  "refresh.autoRefresh": boolean;

  /**
   * @asType integer
   * @title Time Interval (sec)
   * @default 3
   * @minimum 1
   * @maximum 3600
   * @markdownDescription "Controls the refresh time interval in seconds. Only applies when `#nvidia-smi-plus.refresh.autoRefresh#` is set to `true`."
   */
  "refresh.timeInterval": number;

  /**
   * @default "product_name"
   */
  "view.gpuMainDescription": ItemOption;

  /**
   * @title GPU Information
   * @default ["memory_total", "memory_free", "memory_used_percent"]
   * @description Configure which information will be shown on the view. see https://github.com/RSIP-Vision/vscode-nividia-smi-plus#available-information-fields for the complete list.
   */
  "view.gpuItems": ItemOption[];
}

const configSection = "nvidia-smi-plus";
export const configurations = new configUtils.VSCodeConfigurations<Config>(configSection);
