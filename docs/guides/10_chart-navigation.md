# Chart navigation and linked response inspection

OreFlow charts inspect the data already displayed. Navigation never invokes a new simulation or changes an operating input. Response sweeps still run in the existing Web Worker when **Compute / Calcular** is requested.

## Numeric line charts

- Drag horizontally to brush-zoom the x axis.
- Hold **Shift** while dragging to pan the zoomed window; the data follows the pointer. **Shift+Left/Right** moves the window by 20% of its current span.
- **Left/Right** without Shift keeps the existing sample cursor. The existing view readout reports its values.
- **Escape**, a double-click, or **Reset zoom / Restablecer zoom** restores the original displayed x domain, including histogram half bins and the chart's original padding.
- Open **Navigation / Navegación** beside **Data table / Tabla de datos** for the gesture instructions in the interface language. The native disclosure is keyboard-operated and opens over the chart; it does not reserve a permanent instruction row in every instrument. The focused chart references the complete instructions and its accessible data table.

Pan is horizontal, stays within the original displayed numeric domain, and preserves the visible span. On logarithmic x axes it preserves the visible ratio by translating in log space. Y scales, annotations, legend toggles and inset ownership are unchanged. Categorical charts keep their existing cursor and legend behavior and have no pan/brush navigation.

## Response heatmap

Open **Inspect / Inspeccionar** above the heatmap for the scale and viewport controls. This disclosure expands over the chart so secondary controls do not spend its height.

Choose two inputs and a metric, then **Compute / Calcular**. All heatmap values and linked slices come from that sweep's existing `z[j][i]` grid. Current-state and optimizer markers and constraint contours stay in their original source coordinates as the viewport changes.

| Control | English / Spanish behavior |
| --- | --- |
| Colour scale / Escala de color | **Robust range / Rango robusto** retains the existing automatic lower-tail clipping: for more than nine finite cells, use the 10th-percentile sample as the minimum only when that tail spans more than 25% of the full range. **Full range / Rango completo** restores the actual minimum and maximum, with no new sweep. |
| Drag action / Acción al arrastrar | **Select region / Seleccionar región** brushes an inclusive rectangle of grid cells. A click or touch selects one cell. **Pan view / Desplazar vista** moves an already zoomed viewport with mouse or touch. Alt+drag also pans. |
| Zoom to selection / Ampliar selección | Shows the selected cells, retaining their physical axis coordinates and units. |
| + / − | **Zoom in / Acercar**, **Zoom out / Alejar** change the number of visible cells around the cursor or viewport center, within the original grid. |
| Reset inspection / Restablecer inspección | Clears selection, linked slice and cursor, restores the entire grid and the robust colour mode. Escape and double-click do the same. |

The focused heatmap also accepts **arrows** for the cursor, **Enter/Space** to select that cell, **Shift+arrows** to extend a region from its anchor, **Alt+arrows** to pan, and **+ / −** to zoom. Keyboard cursor motion reveals an offscreen cell by moving the viewport. Pan and zoom never step outside the original grid. A one-cell/constant axis remains valid.

Selection persists after pointer leave. A dashed boundary identifies the region; a ring identifies the endpoint cell that supplies the linked slice. Contours and markers remain clipped to the numeric viewport, and the full original grid remains available as an accessible table.

## Linked row or column

Once a selection is complete, **Linked slice / Corte vinculado** shows a real line chart and source coordinate with its unit. Choose **Row (x) / Fila (x)** to plot the selected endpoint's y row against x, or **Column (y) / Columna (y)** to plot its x column against y.

A single-cell selection plots its entire row or column to give context. A rectangle crops the slice to that rectangle along the varying axis. It never averages rows, interpolates new process values, or takes another cell's fixed coordinate. Single-sample slices use a point marker. Rejected/unavailable cells remain null gaps, including in the slice data table and readout. An entirely null slice states that it has no accepted states and does not draw a fabricated line.

New grid data resets heatmap inspection. Changing the case, operating state, sweep axes or metric invalidates stale selection; changing axes cancels an in-flight sweep. New computations use the existing sweep lifecycle. Empty/all-null grids state that there are no accepted sweep values and disable meaningful scale/selection/zoom controls. Constant finite colour ranges use the viridis midpoint.

## Verification

From `frontend/`:

```powershell
npm run typecheck
npx vitest run src/components/charts/navigation.test.ts
$env:OF_BASE='http://127.0.0.1:4914'
$env:OF_CHART_EVIDENCE='C:/temp/oreflow-chart-interactions'
node chart-interactions-gate.mjs
```

Evidence storage uses explicit `OF_CHART_EVIDENCE` first, otherwise `CAOS_TEMP_ROOT/oreflow-chart-interactions`, otherwise `OF_CHART_TASK_ROOT/oreflow-chart-interactions` for a configured external task root. With none configured the gate stops before browser launch. Product-repository and system-temp destinations are rejected; there is no implicit system-temp or repository fallback.

For a focused rerun, `OF_CHART_SCENARIO` can match a scenario tag; leave it unset for the complete gate. Phone Focus keeps its controls, heatmap and linked slice in a product scroller between the existing label/actions and HUD overlays. The heatmap height follows that visible scroller (with legible bounded dimensions), so lower source cells can actually be touched rather than remaining clipped below the HUD. The full chart width and existing font sizes are preserved.

The gate launches Playwright against the real UI and actual worker grid. It checks pointer/keyboard line pan, including log axes; source-exact slices; reversible scale/viewport/selection; invalidation; and desktop/phone, normal/Focus, EN/ES, light/dark combinations. It saves screenshots to the evidence directory and prints a final check count. The default base is port 4914; a bounded dev server can be supplied through `OF_BASE`. A local interaction pass is scoped evidence; main owns final integrated release, full shell/browser matrix, pipeline and deployment validation.
