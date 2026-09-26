import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import {
  AppShell,
  applyTheme,
  CitationsProvider,
  readTheme,
  type ShellConfig,
} from "@fasl-work/caos-app-shell";
import "@fasl-work/caos-app-shell/styles.css";
import "./workbench/workbench.css";
import "./content/content.css";
import { ARCHITECTURE } from "./content/architecture";
import { CONTENT_CITATIONS } from "./content/citations";
import Workbench from "./workbench/Workbench";
import { Pickaxe } from "lucide-react";
import { APP_VERSION } from "./lib/version";
import { DocumentLanguage } from "./lib/DocumentLanguage";

// the workbench is the landing route; the focus route and the content pages load when first opened
const FocusWorkbench = React.lazy(() => import("./workbench/FocusWorkbench"));
const Introduction = React.lazy(() => import("./pages/Introduction"));
const Methodology = React.lazy(() => import("./pages/Methodology"));
const Implementation = React.lazy(() => import("./pages/Implementation"));
const Experiments = React.lazy(() => import("./pages/Experiments"));
const Benchmark = React.lazy(() => import("./pages/Benchmark"));

applyTheme(readTheme());
const config: ShellConfig = {
  product: { name: "OreFlow", mark: <Pickaxe size={18} /> },
  version: APP_VERSION,
  // only the workbench is a viewport-sized surface; the content pages keep the document scroll (ADR-0071)
  fixedRoutes: ["/"],
  architecture: ARCHITECTURE,
  routes: [
    { path: "/", en: "Workbench", es: "Laboratorio" },
    { path: "/introduction", en: "Introduction", es: "Introducción" },
    { path: "/methodology", en: "Methodology", es: "Metodología" },
    { path: "/implementation", en: "Implementation", es: "Implementación" },
    { path: "/experiments", en: "Experiments", es: "Experimentos" },
    { path: "/benchmark", en: "Benchmark", es: "Benchmark" },
  ],
  links: { github: "https://github.com/fsantibanezleal/CAOS_OreFlow" },
  footer: {
    attribution: {
      en: "Developed by Felipe Santibáñez-Leal",
      es: "Desarrollado por Felipe Santibáñez-Leal",
    },
    license: { en: "MIT", es: "MIT" },
    provenance: {
      en: "Particle reference: HZDR RODARE 336 (CC BY 4.0); authored circuits",
      es: "Referencia de partículas: HZDR RODARE 336 (CC BY 4.0); circuitos de autor",
    },
    disclaimer: {
      en: "Simulator only; not plant-calibrated",
      es: "Solo simulador; sin calibración de planta",
    },
  },
};

function Boundary({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="page-body" role="status">
          Loading / Cargando...
        </div>
      }
    >
      {children}
    </React.Suspense>
  );
}
function AppRoutes() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/focus/')) return <><DocumentLanguage /><Boundary><Routes><Route path="/focus/:caseId" element={<FocusWorkbench />} /></Routes></Boundary></>;
  return <AppShell config={config}>
        <DocumentLanguage />
        <Boundary>
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/introduction" element={<Introduction />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/implementation" element={<Implementation />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="*" element={<Workbench />} />
          </Routes>
        </Boundary>
      </AppShell>;
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL === '/CAOS_OreFlow/' ? '/CAOS_OreFlow' : undefined}>
    <CitationsProvider items={CONTENT_CITATIONS}>
      <AppRoutes />
    </CitationsProvider>
  </BrowserRouter>,
);
