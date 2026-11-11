# Validation

| requirement | adversarial check | gate |
|---|---|---|
| OFW-001 | Change the selected case and detach the selected circuit operation from its computed stream and evidence panel; the product acceptance check must identify the disconnected live state. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_wb_016` |
