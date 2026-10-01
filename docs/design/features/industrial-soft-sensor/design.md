# Industrial soft-sensor design

The publisher's [CC0 Kaggle record](https://www.kaggle.com/datasets/edumagalhaes/quality-prediction-in-a-mining-process) contains 737,453 rows of mixed-frequency plant variables, 2017-03-10 through 2017-09-09. The date field is hourly, while most process channels have approximately 180 records per hour. Both concentrate assays are laboratory outputs. Inspection shows 310 nominal hours whose silica target changes on almost every 20-second row by linear interpolation. Those hours cannot be treated as measured hourly labels and are excluded in full. The remaining hours are summarized by sensor median; only exact consecutive-hour pairs with valid labels become examples.

At time `t`, the 21 feed, reagent, pulp and flotation-column sensor medians predict the measured silica assay at `t+1h`. This is an observational forecast experiment, not an intervention, a calibrated control response or a claim about laboratory reporting latency. The simultaneously measured iron-concentrate value is removed, as is current/future silica from all learned features. A previous-lab persistence comparator is reported separately and assumes the previous assay has become available.

Three future windows are evaluated with expanding training histories and a 24-hour embargo before each test window. Training-fold median imputation and standardization live inside scikit-learn pipelines. A train-mean, previous-lab, ridge, random forest and histogram gradient-boosting comparison shares identical target rows. Two additional learned models receive the previous measured assay along with sensors and are evaluated against the same persistence comparator; the reporting-latency assumption remains explicit. The compact artifact stores source hash, exact exclusions, feature names, fold boundaries, metrics and downsampled visual traces; the 53 MB archive and 184 MB CSV stay ignored locally. No raw plant row is committed.

The Benchmark route gains an independent industrial-quality tab with fold/model controls, time-linked observed/predicted curves, residual diagnostics and explicit limits. Since sensor interventions were not randomized and the iron system is not the copper circuit, the app does not turn observed relationships into set-point advice.

## References (dossier of 2026-09-28, section 5)

- Kadlec, P., Gabrys, B. and Strandt, S. (2009). Data-driven soft sensors in the process industry. Computers and
  Chemical Engineering 33(4):795-814. doi:10.1016/j.compchemeng.2008.12.012.
- Bergmeir, C. and Benítez, J.M. (2012). On the use of cross-validation for time series predictor evaluation.
  Information Sciences 191:192-213. doi:10.1016/j.ins.2011.12.028. The forward windows and the embargo follow it.
- Pural, Y.E. (2023). Developing a data-driven soft sensor to predict silicate impurity in iron ore flotation
  concentrate. Physicochemical Problems of Mineral Processing 59(5):169823. doi:10.37190/ppmp/169823. By its
  abstract, a random forest reached R² 0.965 on the same data. The split protocol and the treatment of the
  interpolated hours are not in the abstract (UNVERIFIED). The lane cites it and does not compare its numbers,
  because a random split of the 20-second rows would put rows of one hourly label on both sides.
- Ramos, K., Frade, A., Santos, I. and Pinto, T. (2025). Interpretable prediction of silica content in iron ore
  flotation using machine learning. IFAC-PapersOnLine 59(32):132-137. doi:10.1016/j.ifacol.2025.12.409. Data source
  UNVERIFIED.

## Measured on 2026-09-30 (the artifact regenerated from the pinned archive)

- The data: 737,453 rows in 4,097 nominal hours, with 174 to 180 rows per hour. 310 hours carry an interpolated
  label and are excluded (55,800 rows); 3,701 exact next-hour pairs remain.
- Pooled mean absolute error over the three forward windows, in percentage points of silica:
  - persistence (the previous laboratory assay) 0.464;
  - ridge with the previous assay 0.501, and gradient boosting with it 0.523;
  - the training mean 0.766, ridge 0.765, random forest 0.779 and gradient boosting 0.812.

  The sensor-only models do no better than the training mean (ridge is 0.001 points below it; the random forest
  and gradient boosting are above it), and no model beats persistence. The record says so; it is the lane's result.
- The regenerated artifact reproduces every value of the branch's first artifact. It adds the two lab-conditioned
  models the script gained after that artifact was written.
