import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import {
  AppShell,
  applyTheme,
  CitationsProvider,
  readTheme,
  type ShellConfig,
} from "@fasl-work/caos-app-shell";
import "@fasl-work/caos-app-shell/styles.css";
import "./oreflow.css";
import "./rebuild.css";
import { ARCHITECTURE } from "./content/architecture";
import { CONTENT_CITATIONS } from "./content/citations";
import Workbench from "./workbench/Workbench";
import Introduction from "./pages/Introduction";
import Methodology from "./pages/Methodology";
import Implementation from "./pages/Implementation";
import Experiments from "./pages/Experiments";
import Benchmark from "./pages/Benchmark";
import { Pickaxe } from "lucide-react";

applyTheme(readTheme());
const config: ShellConfig = {
  product: { name: "OreFlow", mark: <Pickaxe size={18} /> },
  version: "0.02.000",
  fixed: true,
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
    attribution: false,
    license: { en: "Apache-2.0", es: "Apache-2.0" },
    provenance: {
      en: "Reproducible process models · local and replayable inference",
      es: "Modelos de proceso reproducibles · inferencia local y reproducible",
    },
  },
};

function Boundary({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="of-page" role="status">
          Loading / Cargando...
        </div>
      }
    >
      {children}
    </React.Suspense>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL === '/CAOS_OreFlow/' ? '/CAOS_OreFlow' : undefined}>
    <CitationsProvider items={CONTENT_CITATIONS}>
      <AppShell config={config}>
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
      </AppShell>
    </CitationsProvider>
  </BrowserRouter>,
);
