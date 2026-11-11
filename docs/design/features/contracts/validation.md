# Validation

| requirement | adversarial check | gate |
|---|---|---|
| CT-001 | Remove or corrupt a declared contract input or change its identity; the contract guard must refuse the planted inconsistency rather than accept it as a valid artifact. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_01` |
