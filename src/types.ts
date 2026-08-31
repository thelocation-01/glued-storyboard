export type Caption = {start: number; end: number; text: string};
export type GluedScene = {id: string; narration: string; duration: number; transition: string; motion: string; title: string; subtitle: string; imagePath: string; focalX: number; focalY: number; zoom: number};
export type GluedProject = {id: string; title: string; script: string; fps: number; width: number; height: number; scenes: GluedScene[]; captions: Caption[]; narrationPath?: string; narrationDuration?: number; aiNarration?: boolean; totalFrames?: number};
