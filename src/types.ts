export type Caption = {start: number; end: number; text: string};
export type EditorialStyle = 'minimal' | 'documentary' | 'kinetic';
export type OverlayDensity = 'low' | 'balanced' | 'high';
export type EditorialOverlayType = 'minimal' | 'chapter' | 'stat' | 'question' | 'contrast' | 'keyword';
export type EditorialOverlay = {type: EditorialOverlayType; label: string; value: string; detail: string; keyword: string};
export type GluedScene = {id: string; narration: string; duration: number; transition: string; motion: string; title: string; subtitle: string; imagePath: string; focalX: number; focalY: number; zoom: number; editorial?: EditorialOverlay};
export type GluedProject = {id: string; title: string; script: string; fps: number; width: number; height: number; scenes: GluedScene[]; captions: Caption[]; narrationPath?: string; narrationDuration?: number; aiNarration?: boolean; totalFrames?: number; editorialStyle?: EditorialStyle; overlayDensity?: OverlayDensity; accentColor?: string; showProgress?: boolean};
