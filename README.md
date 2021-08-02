# nvidia-smi-plus 

Provides a view on Nvidia's GPUs. It utilize the `nvidia-smi` tool to extract the information.

* Highly customizable
* Automatic refresh (optionally)

Note: this extension has no affiliation with the Nvidia corp.

## Available information fields:

* `product_name`: displays the Product name
* `gpu_temp`: displays the GPU's temperature
* `gpu_util`: displays the GPU's utilization (percents)
* `fan_speed`: displays the GPU's fan speed (percents)
* `memory_util`: displays the GPU's memory utilization (percents)
* `memory_total`:  displays the GPU's total memory amount
* `memory_free`: displays the GPU's free memory amount
* `memory_used`: displays the GPU's used memory amount
* `memory_used_percent`: displays the GPU's used memory (percents)

## Extension Settings

This extension contributes the following settings:

* `nvidia-smi-plus.executablePath`: configure where the nvidia-smi executable is located
* `nvidia-smi-plus.refresh.autoRefresh`: enable/disable auto fetching GPUs information
* `nvidia-smi-plus.refresh.timeInterval`: time interval in seconds to fetch information
* `nvidia-smi-plus.view.gpuMainDescription`: main information field to show next to the GPU id. see [Available information fields](#Available-information-fields)
* `nvidia-smi-plus.view.gpuItems`: fields to show under each GPU. see [Available information fields](#Available-information-fields)
