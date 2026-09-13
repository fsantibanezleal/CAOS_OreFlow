import type { Citation } from '@fasl-work/caos-app-shell';
export const CONTENT_CITATIONS: Citation[] = [
  { id: 'nptel', label: 'NPTEL · Introduction to Mineral Processing', citation: 'NPTEL, Introduction to Mineral Processing, course outline covering comminution, classification, flotation and process economics.', url: 'https://onlinecourses-archive.nptel.ac.in/noc18_ce14/preview' },
  { id: 'bond', label: 'Bond · third theory of comminution', citation: 'F. C. Bond, The third theory of comminution, Mining Engineering, 1952.', url: 'https://onemine.org/documents/the-third-theory-of-comminution' },
  { id: 'pbm', label: 'Austin · population balance model', citation: 'L. G. Austin, A review introduction to the description of size reduction by the mathematical treatment of milling, Powder Technology, 1973.', url: 'https://doi.org/10.1016/0032-5910(73)80013-7' },
  { id: 'whiten', label: 'Whiten crusher model review', citation: 'M. A. M. Evertsson and others, crusher modelling and simulation reviews in Minerals.', url: 'https://www.mdpi.com/2075-163X/11/11/1256' },
  { id: 'hydrocyclone', label: 'Plitt hydrocyclone model', citation: 'Plitt-style hydrocyclone cut-size and partition modelling, reviewed in mineral-processing classification literature.', url: 'https://doi.org/10.1016/j.minpro.2009.02.004' },
  { id: 'flotation', label: 'Flotation kinetics review', citation: 'Mineral flotation kinetics and rate models, including fast/slow populations and residence-time response.', url: 'https://doi.org/10.1016/j.mineng.2015.04.010' },
  { id: 'ml-mining', label: 'Machine learning in mineral processing', citation: 'Recent review of machine-learning applications across mineral processing and extractive metallurgy.', url: 'https://doi.org/10.3390/min14040331' },
  { id: 'ml-review', label: 'ML review for mining', citation: 'Machine learning methods and applications in mining engineering, with emphasis on data quality and generalisation.', url: 'https://doi.org/10.3390/min13060788' },
  { id: 'hzdr', label: 'HZDR RODARE particle dataset', citation: 'HZDR RODARE, constructed cases particle-mineralogy data, DOI 10.14278/rodare.336, CC BY 4.0.', url: 'https://doi.org/10.14278/rodare.336' },
  { id: 'sklearn', label: 'scikit-learn · leakage and evaluation', citation: 'Scikit-learn documentation on common pitfalls, data leakage and model evaluation.', url: 'https://scikit-learn.org/stable/common_pitfalls.html' },
  { id: 'pytorch', label: 'PyTorch · CUDA semantics', citation: 'PyTorch documentation for CUDA tensor and accelerator execution.', url: 'https://docs.pytorch.org/docs/cuda.html' },
  { id: 'onnx', label: 'ONNX Runtime Web', citation: 'ONNX Runtime Web documentation for browser-side model inference.', url: 'https://onnxruntime.ai/docs/tutorials/web/' },
  { id: 'scipy-opt', label: 'SciPy · constrained optimisation', citation: 'SciPy optimisation reference for bounded nonlinear least squares and constrained solvers.', url: 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html' },
  { id: 'optuna', label: 'Optuna · efficient optimisation', citation: 'Optuna documentation on efficient hyperparameter optimisation algorithms.', url: 'https://optuna.readthedocs.io/en/stable/tutorial/10_key_features/003_efficient_optimization_algorithms.html' },
  { id: 'modsim', label: 'MODSIM ecosystem', citation: 'MODSIM, commercial mineral-processing simulation ecosystem used as a comparison point for process flowsheeting.', url: 'https://www.mineraltech.com/MODSIM/' },
  { id: 'prommis', label: 'PrOMMiS open-source framework', citation: 'PrOMMiS, open-source process modelling and optimisation framework for mineral processing.', url: 'https://github.com/prommis/prommis' },
];
