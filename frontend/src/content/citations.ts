/**
 * Every reference the interface cites, transcribed from the 2026-09-26 research dossier and the
 * methodology pages (each carries a DOI or a link; ADR-0016 section 7). Titles, authors and venues of
 * every DOI were checked against the Crossref and DataCite registries on 2026-09-26. A source whose
 * original has no online record (Plitt 1976, Kelsall 1961, Klimpel 1980) is cited through the verified
 * documentation that reproduces its equations.
 */
import type { Citation } from '@fasl-work/caos-app-shell';
import type { Lang } from '../lib/format';

export const CONTENT_CITATIONS: Citation[] = [
  // comminution
  { id: 'bond1952', label: 'Bond 1952', citation: 'Bond, F.C. (1952). The third theory of comminution. Transactions AIME 193:484-494.', url: 'https://onemine.org/documents/the-third-theory-of-comminution' },
  { id: 'gmg2021', label: 'GMG 2021', citation: 'Global Mining Guidelines Group (2021). Determining the Bond Efficiency of Industrial Grinding Circuits, GMG01-MP-2021 (revised 2021-12-15).', url: 'https://gmggroup.org/determining-the-bond-efficiency-of-industrial-grinding-circuits/' },
  { id: 'crusher2021', label: 'Duarte et al. 2021', citation: 'Duarte, R., Yamashita, A., da Silva, M., Cota, L. and Euzébio, T. (2021). Calibration and validation of a cone crusher model with industrial data. Minerals 11(11):1256 (the Andersen-Whiten form).', doi: '10.3390/min11111256', url: 'https://doi.org/10.3390/min11111256' },
  { id: 'crusher2024', label: 'Rocha et al. 2024', citation: 'Rocha, B., Campos, T., Silva, J. and Tavares, L. (2024). Fit-for-purpose model of HP500 cone crusher in size reduction of itabirite iron ore. Minerals 14(9):919.', doi: '10.3390/min14090919', url: 'https://doi.org/10.3390/min14090919' },
  { id: 'syscad-crusher', label: 'SysCAD Crusher 2', citation: 'SysCAD documentation, Crusher 2 model theory (Whiten classification and breakage options).', url: 'https://help.syscad.net/Crusher_2_Model_Theory' },
  { id: 'herbst1980', label: 'Herbst and Fuerstenau 1980', citation: 'Herbst, J.A. and Fuerstenau, D.W. (1980). Scale-up procedure for continuous grinding mill design using population balance models. International Journal of Mineral Processing 7(1):1-31.', doi: '10.1016/0301-7516(80)90034-4', url: 'https://doi.org/10.1016/0301-7516(80)90034-4' },
  { id: 'molycop', label: 'Moly-Cop Tools', citation: 'Moly-Cop Tools (Sepúlveda), BallSim_Direct and BallParam_Direct spreadsheets and documentation (vendor documentation, copy).', url: 'https://pdfcoffee.com/moly-cop-tools-1-3-pdf-free.html' },
  // classification
  { id: 'plitt1976', label: 'Plitt 1976', citation: 'Plitt, L.R. (1976). A mathematical model of the hydrocyclone classifier. CIM Bulletin 69(776):114-123; equations as documented verbatim by SysCAD.', url: 'https://help.syscad.net/index.php/Hydrocyclone' },
  // flotation
  { id: 'gorain1997', label: 'Gorain et al. 1997', citation: 'Gorain, B.K., Franzidis, J.-P. and Manlapig, E.V. (1997). Studies on impeller type, impeller speed and air flow rate in an industrial scale flotation cell. Part 4: Effect of bubble surface area flux on flotation performance. Minerals Engineering 10(4):367-379.', doi: '10.1016/S0892-6875(97)00014-9', url: 'https://doi.org/10.1016/S0892-6875(97)00014-9' },
  { id: 'gorain1999', label: 'Gorain et al. 1999', citation: 'Gorain, B.K., Franzidis, J.-P. and Manlapig, E.V. (1999). The empirical prediction of bubble surface area flux in mechanical flotation cells from cell design and operating data. Minerals Engineering 12(3):309-322.', doi: '10.1016/S0892-6875(99)00008-4', url: 'https://doi.org/10.1016/S0892-6875(99)00008-4' },
  { id: 'banks2012', label: 'Minerals 2:258', citation: 'An overview of optimizing strategies for flotation banks. Minerals 2(4):258 (banks of mechanical cells as perfect mixers in series).', url: 'https://www.mdpi.com/2075-163X/2/4/258' },
  { id: 'savassi1998', label: 'Savassi et al. 1998', citation: 'Savassi, O.N., Alexander, D.J., Franzidis, J.P. and Manlapig, E.V. (1998). An empirical model for entrainment in industrial flotation plants. Minerals Engineering 11(3):243-256.', doi: '10.1016/S0892-6875(98)00003-X', url: 'https://doi.org/10.1016/S0892-6875(98)00003-X' },
  { id: 'hoang2019', label: 'Hoang et al. 2019', citation: 'Hoang, D.H., Heitkam, S., Kupka, N., Hassanzadeh, A., Peuker, U.A. and Rudolph, M. (2019). Froth properties and entrainment in lab-scale flotation: a case of carbonaceous sedimentary phosphate ore. Chemical Engineering Research and Design 142:100-110.', doi: '10.1016/j.cherd.2018.11.036', url: 'https://doi.org/10.1016/j.cherd.2018.11.036' },
  { id: 'trahar1981', label: 'Trahar 1981', citation: 'Trahar, W.J. (1981). A rational interpretation of the role of particle size in flotation. International Journal of Mineral Processing 8(4):289-327.', doi: '10.1016/0301-7516(81)90019-3', url: 'https://doi.org/10.1016/0301-7516(81)90019-3' },
  { id: 'king1979', label: 'King 1979', citation: 'King, R.P. (1979). A model for the quantitative estimation of mineral liberation by grinding. International Journal of Mineral Processing 6:207-220.', doi: '10.1016/0301-7516(79)90037-1', url: 'https://doi.org/10.1016/0301-7516(79)90037-1' },
  { id: 'collector2022', label: 'Chalcopyrite/pyrite review 2022', citation: 'Froth flotation of chalcopyrite/pyrite ore: a critical review (2022). PMC9572913.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9572913/' },
  { id: 'collector2025', label: 'Nyarko et al. 2026', citation: 'Nyarko, D., Zanin, M., Tsatouhas, G., Seaman, D., Skinner, W. and Abaka-Wood, G. (2026). Flotation of a coarsely ground porphyry copper ore: insights into collector efficiency. Powder Technology 470:121986.', doi: '10.1016/j.powtec.2025.121986', url: 'https://doi.org/10.1016/j.powtec.2025.121986' },
  { id: 'polat2000', label: 'Polat and Chander 2000', citation: 'Polat, M. and Chander, S. (2000). First-order flotation kinetics models and methods for estimation of the true distribution of flotation rate constants. International Journal of Mineral Processing 58:145-166 (Kelsall, Klimpel and gamma forms).', doi: '10.1016/S0301-7516(99)00069-1', url: 'https://doi.org/10.1016/S0301-7516(99)00069-1' },
  { id: 'bu2017', label: 'Bu et al. 2017', citation: 'Bu, X., Xie, G., Peng, Y., Ge, L. and Ni, C. (2017). Kinetics of flotation. Order of process, rate constant distribution and ultimate recovery. Physicochemical Problems of Mineral Processing 53(1):342-365.', doi: '10.5277/ppmp170128', url: 'https://doi.org/10.5277/ppmp170128' },
  { id: 'vinnett2025', label: 'Vinnett and Waters 2025', citation: 'Vinnett, L. and Waters, K.E. (2025). The use of compressed exponentials for kinetic modelling of batch flotation. Minerals Engineering 226:109246.', doi: '10.1016/j.mineng.2025.109246', url: 'https://doi.org/10.1016/j.mineng.2025.109246' },
  { id: 'zanin2009', label: 'Zanin et al. 2009', citation: 'Zanin, M., Ametov, I., Grano, S., Zhou, L. and Skinner, W. (2009). A study of mechanisms affecting molybdenite recovery in a bulk copper/molybdenum flotation circuit. International Journal of Mineral Processing 93(3-4):256-266.', doi: '10.1016/j.minpro.2009.10.001', url: 'https://doi.org/10.1016/j.minpro.2009.10.001' },
  { id: 'nickel2024', label: 'Yin et al. 2024', citation: 'Yin, F. et al. (2024). Review on the challenges of magnesium removal in nickel sulfide ore flotation and advances in serpentinite depressor. Minerals 14(10):965.', doi: '10.3390/min14100965', url: 'https://doi.org/10.3390/min14100965' },
  { id: 'oxide2022', label: 'Feng et al. 2022', citation: 'Feng, Q., Yang, W., Wen, S., Wang, H., Zhao, W. and Han, G. (2022). Flotation of copper oxide minerals: a review. International Journal of Mining Science and Technology 32:1351-1364.', doi: '10.1016/j.ijmst.2022.09.011', url: 'https://doi.org/10.1016/j.ijmst.2022.09.011' },
  { id: 'porphyry-practice', label: 'Porphyry flotation practice', citation: 'Porphyry copper flotation practice summary (secondary source): cleaning to 25-50% Cu, recoveries usually 80-90%.', url: 'https://www.911metallurgist.com/blog/porphyry-copper-flotation/' },
  // gravity, magnetite, phosphate
  { id: 'laplante-staunton', label: 'Laplante and Staunton', citation: 'Laplante, A.R. and Staunton, W.P. Gravity recovery of gold, an overview of recent developments (AMIRA P420B).', url: 'https://training.gekkos.com/wp-content/uploads/2020/08/TechnicalPaper024GravityRecoveryOfGoldAnOverviewOfRecentDevelopments.pdf' },
  { id: 'laplante2005', label: 'Laplante and Gray 2005', citation: 'Laplante, A.R. and Gray, S. (2005). Advances in gravity gold technology. Developments in Mineral Processing 15:280-307.', doi: '10.1016/S0167-4528(05)15013-3', url: 'https://doi.org/10.1016/S0167-4528(05)15013-3' },
  { id: 'muthaphuli2014', label: 'Muthaphuli 2014', citation: 'Muthaphuli, P. (2014). Production of pelletizing concentrates from Zandrivierspoort magnetite/haematite ore by magnetic separation. Journal of the Southern African Institute of Mining and Metallurgy 114(7).', url: 'https://www.scielo.org.za/scielo.php?script=sci_arttext&pid=S2225-62532014000700006' },
  { id: 'phosphate2019', label: 'Ruan et al. 2019', citation: 'Ruan, Y., He, D. and Chi, R. (2019). Review on beneficiation techniques and reagents used for phosphate ores. Minerals 9(4):253.', doi: '10.3390/min9040253', url: 'https://doi.org/10.3390/min9040253' },
  // methods
  { id: 'marquardt1963', label: 'Marquardt 1963', citation: 'Marquardt, D.W. (1963). An algorithm for least-squares estimation of nonlinear parameters. Journal of the Society for Industrial and Applied Mathematics 11(2):431-441.', doi: '10.1137/0111030', url: 'https://doi.org/10.1137/0111030' },
  { id: 'powell1994', label: 'Powell 1994', citation: 'Powell, M.J.D. (1994). A direct search optimization method that models the objective and constraint functions by linear interpolation. In Advances in Optimization and Numerical Analysis, 51-67 (COBYLA).', doi: '10.1007/978-94-015-8330-5_4', url: 'https://doi.org/10.1007/978-94-015-8330-5_4' },
  { id: 'prima2023', label: 'PRIMA', citation: 'Zhang, Z., Ragonneau, T.M. and Schueller, J. (2023). PRIMA, version 0.5: reference implementation of Powell\'s derivative-free optimization methods, whose COBYLA SciPy uses.', doi: '10.5281/zenodo.8052654', url: 'https://doi.org/10.5281/zenodo.8052654' },
  { id: 'scipy2020', label: 'SciPy 1.0', citation: 'Virtanen, P. et al. (2020). SciPy 1.0: fundamental algorithms for scientific computing in Python. Nature Methods 17:261-272.', doi: '10.1038/s41592-019-0686-2', url: 'https://doi.org/10.1038/s41592-019-0686-2' },
  { id: 'saltelli2010', label: 'Saltelli et al. 2010', citation: 'Saltelli, A., Annoni, P., Azzini, I., Campolongo, F., Ratto, M. and Tarantola, S. (2010). Variance based sensitivity analysis of model output. Design and estimator for the total sensitivity index. Computer Physics Communications 181(2):259-270.', doi: '10.1016/j.cpc.2009.09.018', url: 'https://doi.org/10.1016/j.cpc.2009.09.018' },
  { id: 'salib2017', label: 'SALib', citation: 'Herman, J. and Usher, W. (2017). SALib: an open-source Python library for sensitivity analysis. Journal of Open Source Software 2(9):97.', doi: '10.21105/joss.00097', url: 'https://doi.org/10.21105/joss.00097' },
  { id: 'breiman2001', label: 'Breiman 2001', citation: 'Breiman, L. (2001). Random forests. Machine Learning 45:5-32.', doi: '10.1023/A:1010933404324', url: 'https://doi.org/10.1023/A:1010933404324' },
  { id: 'friedman2001', label: 'Friedman 2001', citation: 'Friedman, J.H. (2001). Greedy function approximation: a gradient boosting machine. Annals of Statistics 29(5):1189-1232.', doi: '10.1214/aos/1013203451', url: 'https://doi.org/10.1214/aos/1013203451' },
  { id: 'rasmussen2006', label: 'Rasmussen and Williams 2006', citation: 'Rasmussen, C.E. and Williams, C.K.I. (2006). Gaussian Processes for Machine Learning. MIT Press.', url: 'https://gaussianprocess.org/gpml/' },
  { id: 'sklearn2011', label: 'scikit-learn', citation: 'Pedregosa, F. et al. (2011). Scikit-learn: machine learning in Python. Journal of Machine Learning Research 12:2825-2830.', url: 'https://jmlr.org/papers/v12/pedregosa11a.html' },
  { id: 'adam2015', label: 'Kingma and Ba 2015', citation: 'Kingma, D.P. and Ba, J. (2015). Adam: a method for stochastic optimization. arXiv:1412.6980.', url: 'https://arxiv.org/abs/1412.6980' },
  { id: 'adamw2019', label: 'Loshchilov and Hutter 2019', citation: 'Loshchilov, I. and Hutter, F. (2019). Decoupled weight decay regularization. arXiv:1711.05101.', url: 'https://arxiv.org/abs/1711.05101' },
  { id: 'pytorch2019', label: 'Paszke et al. 2019', citation: 'Paszke, A., Gross, S. et al. (2019). PyTorch: an imperative style, high-performance deep learning library. NeurIPS 2019. arXiv:1912.01703.', url: 'https://arxiv.org/abs/1912.01703' },
  { id: 'onnx-web', label: 'ONNX Runtime Web', citation: 'ONNX Runtime Web: running exported models in the browser with WebAssembly.', url: 'https://onnxruntime.ai/docs/tutorials/web/' },
  { id: 'ears2009', label: 'EARS', citation: 'Mavin, A., Wilkinson, P., Harwood, A. and Novak, M. (2009). Easy approach to requirements syntax (EARS). 17th IEEE International Requirements Engineering Conference, 317-322.', doi: '10.1109/RE.2009.9', url: 'https://doi.org/10.1109/RE.2009.9' },
  // measured lanes
  { id: 'hzdr', label: 'HZDR RODARE 336', citation: 'HZDR RODARE, constructed-case particle mineralogy data, record 336 (CC BY 4.0).', doi: '10.14278/rodare.336', url: 'https://doi.org/10.14278/rodare.336' },
  { id: 'particle-paper', label: 'Pereira et al. 2021', citation: 'Pereira, L., Frenzel, M., Khodadadzadeh, M., Tolosana-Delgado, R. and Gutzmer, J. (2021). A self-adaptive particle-tracking method for minerals processing. Journal of Cleaner Production 279:123711.', doi: '10.1016/j.jclepro.2020.123711', url: 'https://doi.org/10.1016/j.jclepro.2020.123711' },
  { id: 'geomet', label: 'GeoMet v4', citation: 'Hoffimann, J. et al. GeoMet dataset, version 4: copper locked-cycle test recovery and assays by drill hole (CC BY 4.0). Zenodo 7051975.', doi: '10.5281/zenodo.7051975', url: 'https://zenodo.org/records/7051975' },
  { id: 'geomet-paper', label: 'Hoffimann et al. 2022', citation: 'Hoffimann, J., Augusto, J., Resende, L., Mathias, M., Mazzinghy, D., Bianchetti, M. et al. (2022). Modeling geospatial uncertainty of geometallurgical variables with Bayesian models and Hilbert-Kriging. Mathematical Geosciences 54(7):1227-1253.', doi: '10.1007/s11004-022-10013-1', url: 'https://doi.org/10.1007/s11004-022-10013-1' },
];

/** Spanish short labels where the English one is a description rather than a name. */
const LABEL_ES: Record<string, string> = {
  'porphyry-practice': 'Práctica de flotación de pórfidos',
  collector2022: 'Revisión calcopirita/pirita 2022',
};

/**
 * The citations in the interface language. The short label is interface text: in Spanish an author
 * pair is joined with y (e before a word that starts with the sound i) and a descriptive label is
 * translated. The bibliographic record, with its titles and venues, stays verbatim.
 */
export function localizeCitations(items: Citation[], lang: Lang): Citation[] {
  if (lang !== 'es') return items;
  return items.map(c => ({
    ...c,
    label: LABEL_ES[c.id] ?? c.label.replace(/ and (?=\S)/g, (match: string, at: number, whole: string) =>
      (/^(?:[IiÍí]|[Hh][IiÍí])(?![aeiouáéíóú])/.test(whole.slice(at + match.length)) ? ' e ' : ' y ')),
  }));
}
