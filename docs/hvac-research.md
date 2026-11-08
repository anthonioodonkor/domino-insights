# LBNL chiller plant extract

The [LBNL chiller plant dataset](https://faultdetection.lbl.gov/dataset/simulated-chiller-plant/) represents a simulated Chicago office building with three chillers and 12 air handlers. LBNL and PNNL created the data using EnergyPlus and Modelica with Chicago typical meteorological year inputs. The CSVs model separate year-long cases at one-minute cadence. They contain simulated BAS values. Dataset DOI is [10.25984/1881324](https://doi.org/10.25984/1881324). The [collection catalog](https://catalog.data.gov/dataset/lbnl-fault-detection-and-diagnostics-datasets) lists CC BY 4.0.

The [inventory PDF](https://fdddata.lbl.gov/data/Simulated_LBNL_FDD_Data_Sets_Chiller_Plant/LBNL_FDD_Data_Sets_Chiller_Plant.pdf) identifies point units in Table 2 and case labels in Table 4. Cataloged faults include sensor bias, bypass-valve leakage and sticking, cooling-tower heat exchanger fouling, and condenser-loop controller tuning. The ZIP directory contains two additional chiller-fouling filenames that the inspected inventory does not document. This extract uses only two documented cases.

| Source archive member | Source classification |
|---|---|
| `ChillerPlant.csv` | Fault-free |
| `ChillerPlant_chiller_bias_-2.csv` | Chiller 1 leaving chilled-water temperature sensor bias, −2 °C additive offset |

The fault is imposed throughout the source faulted run. The logged supply temperature reflects the faulty sensor output, so it cannot establish the true leaving-water temperature. The selected 120 one-minute records per case cover source timestamps 2018-07-16 14:00 through 15:59 inclusive. Chiller 1 is on across both selected windows. The files use timezone-naive `Datetime` values. Normalization assigns fixed UTC−06:00 as a reproducible Chicago standard-time convention for simulation time. The file supplies no authoritative UTC offset. Use the saved source bounds when comparing to raw data. The two runs intentionally overlap in simulated time and must be handled separately.

| CSV field | Meaning | Source unit | Normalized field | Unit |
|---|---|---|---|---|
| `CHL_SW_TEMP_1` | Chiller 1 leaving chilled water, as logged | °F | `chilled_water_supply_temp_c` | °C |
| `CHL_RW_TEMP_1` | Chiller 1 entering chilled water | °F | `chilled_water_return_temp_c` | °C |
| `CHL_POW_1` | Chiller 1 electrical consumption | kW | `chiller_power_kw` | kW |
| `CHL_STA_1` | Chiller 1 on/off | 0/1 | `chiller_on` | 0/1 |

Temperatures use `(°F − 32) × 5/9`. Other values retain source units. Values are rounded to six decimals. The normalizer checks cadence, row counts, required fields, finite numbers and status range. The extract includes no source chiller-load percentage or air-handler supply-air temperature. Those metrics appear only in the fictional replay.

The [official ZIP](https://fdddata.lbl.gov/data/Simulated_LBNL_FDD_Data_Sets_Chiller_Plant/LBNL_FDD_Data_Sets_Chiller_Plant.zip) was accessed using its central directory and byte ranges for the selected members. It is excluded from this bundle. The normalizer accepts the complete ZIP and reads just the named member streams to the window cutoff. The companion annotations record each selected member and its ZIP directory CRC32 for source identification.
