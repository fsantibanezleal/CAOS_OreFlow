/**
 * Room, in CSS pixels [top, right, bottom, left], that overlays cover on a full-bleed stage: the focus
 * route's label, HUD and actions float over the instrument (ADR-0070). An instrument keeps its canvas
 * full-bleed and draws its plot inside this inset, so nothing it shows sits under an overlay.
 */
import { createContext } from 'react';

export type Inset = [number, number, number, number];
export const OverlayInset = createContext<Inset>([0, 0, 0, 0]);
