import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Caption, GluedProject, GluedScene} from './types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const motionTransform = (motion: string, progress: number, zoom = 1) => {
  const eased = Easing.inOut(Easing.cubic)(progress);
  const base = 1.055 * zoom;
  const end = 1.125 * zoom;
  switch (motion) {
    case 'slow-zoom-out':
      return `translate3d(0, 0, 0) scale(${interpolate(eased, [0, 1], [end, base])})`;
    case 'pan-left':
      return `translate3d(${interpolate(eased, [0, 1], [2.8, -2.8])}%, 0, 0) scale(${1.095 * zoom})`;
    case 'pan-right':
      return `translate3d(${interpolate(eased, [0, 1], [-2.8, 2.8])}%, 0, 0) scale(${1.095 * zoom})`;
    case 'drift-up':
      return `translate3d(0, ${interpolate(eased, [0, 1], [2.2, -2.2])}%, 0) scale(${1.085 * zoom})`;
    default:
      return `translate3d(0, 0, 0) scale(${interpolate(eased, [0, 1], [base, end])})`;
  }
};

const Scene: React.FC<{scene: GluedScene; sceneFrames: number; fadeFrames: number}> = ({scene, sceneFrames, fadeFrames}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, sceneFrames - 1)], [0, 1], clamp);
  const titleOpacity = interpolate(frame, [8, 20, Math.min(sceneFrames - 30, 118), Math.min(sceneFrames - 10, 140)], [0, 1, 1, 0], clamp);
  const opacity = fadeFrames > 0 ? interpolate(frame, [0, fadeFrames], [0, 1], clamp) : 1;
  return (
    <AbsoluteFill style={{backgroundColor: '#07100d', opacity, overflow: 'hidden'}}>
      {scene.imagePath ? <Img src={staticFile(scene.imagePath)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${scene.focalX}% ${scene.focalY}%`, transform: motionTransform(scene.motion, progress, scene.zoom), willChange: 'transform'}} /> : null}
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(3,9,7,.82) 0%, rgba(3,9,7,.35) 45%, rgba(3,9,7,.08) 72%), linear-gradient(0deg, rgba(3,9,7,.66), transparent 42%)'}} />
      <div style={{position: 'absolute', left: 86, top: 84, width: 900, opacity: titleOpacity, color: 'white'}}>
        <div style={{fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: 5, color: '#a8ffce', marginBottom: 18}}>GLUED ORIGINAL</div>
        <div style={{fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 68, lineHeight: 1.02, textShadow: '0 3px 24px rgba(0,0,0,.55)'}}>{scene.title}</div>
        {scene.subtitle ? <div style={{fontFamily: 'Arial, sans-serif', fontWeight: 500, fontSize: 30, lineHeight: 1.25, marginTop: 18, color: '#e7eee9'}}>{scene.subtitle}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const CaptionCard: React.FC<{caption?: Caption}> = ({caption}) => caption ? (
  <div style={{position: 'absolute', left: '50%', bottom: 58, transform: 'translateX(-50%)', width: 'auto', maxWidth: 1220, padding: '11px 22px 13px', borderRadius: 14, background: 'rgba(2,7,5,.84)', boxShadow: '0 8px 35px rgba(0,0,0,.38)', color: '#fff', fontFamily: 'Arial, sans-serif', fontWeight: 650, fontSize: 34, lineHeight: 1.22, textAlign: 'center', textShadow: '0 2px 5px #000'}}>{caption.text}</div>
) : null;

export const GluedVideo: React.FC<GluedProject> = (project) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  let cursor = 0;
  const segments = project.scenes.map((scene, index) => {
    const sceneFrames = Math.max(1, Math.round(scene.duration * fps));
    const fadeFrames = index > 0 && scene.transition !== 'cut' ? Math.min(14, Math.floor(sceneFrames / 4)) : 0;
    const from = Math.max(0, cursor - fadeFrames);
    const durationInFrames = sceneFrames + fadeFrames;
    cursor += sceneFrames;
    return {scene, from, durationInFrames, sceneFrames, fadeFrames, index};
  });
  const time = frame / fps;
  const activeCaption = project.captions.find((caption) => time >= caption.start && time < caption.end);
  return (
    <AbsoluteFill style={{backgroundColor: '#020806'}}>
      {segments.map(({scene, from, durationInFrames, sceneFrames, fadeFrames, index}) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} premountFor={fps} style={{zIndex: index}}>
          <Scene scene={scene} sceneFrames={sceneFrames} fadeFrames={fadeFrames} />
        </Sequence>
      ))}
      {project.narrationPath ? <Sequence from={Math.round(fps * 0.12)}><Audio src={staticFile(project.narrationPath)} volume={0.98} /></Sequence> : null}
      <AbsoluteFill style={{zIndex: 100, pointerEvents: 'none'}}>
        <CaptionCard caption={activeCaption} />
        {project.aiNarration && frame < fps * 5 ? <div style={{position: 'absolute', right: 40, top: 35, color: '#d8e7df', fontFamily: 'Arial, sans-serif', fontSize: 18, letterSpacing: 1.5, padding: '9px 13px', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, background: 'rgba(0,0,0,.38)'}}>AI-GENERATED NARRATION</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
