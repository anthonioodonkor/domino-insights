# Source bibliography

| ID | Origin and usage | Attribution and terms |
|---|---|---|
| `lbnl_chiller_plant` | EnergyPlus–Modelica research simulation of a Chicago office chiller plant. A two-hour extract per case, four logged points per minute. | Lawrence Berkeley National Laboratory, LBNL FDD Data Sets, with Pacific Northwest National Laboratory. [Dataset DOI](https://doi.org/10.25984/1881324), [source portal](https://faultdetection.lbl.gov/data/), [catalog](https://catalog.data.gov/dataset/lbnl-fault-detection-and-diagnostics-datasets), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Selected records were reshaped, rounded, and converted to Celsius and UTC milliseconds under the documented timezone convention. |
| `open_meteo` | Dallas-area external weather-model estimates at the requested coordinates 32.7767, −96.7970. The observation timestamp is the estimate's valid time. | Weather data by [Open-Meteo.com](https://open-meteo.com/). [API documentation](https://open-meteo.com/en/docs), [license and attribution](https://open-meteo.com/en/licence), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The response was mapped to documented fields with an additional retrieval timestamp. |
| `domino_campus` | Deterministic fictional campus assets, dependencies, telemetry, access events, work orders and leases. | Created for the Domino Insights demo. Tenant names, contract terms and identities are fictional. |

The three sources use independent timelines. The weather snapshot demonstrates live enrichment and remains separate from the historical research windows and the fixed-date cooling scenario. There is no field-measured building telemetry in this package. The optional ERCOT and CISA sources were outside the first cooling scenario scope.
