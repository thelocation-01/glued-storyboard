import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Caption, EditorialOverlay, EditorialStyle, GluedProject, GluedScene} from './types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const sans = 'Inter, Arial, sans-serif';
const serif = 'Georgia, Times New Roman, serif';

const enter = (frame: number, start = 8, duration = 18) => {
  const progress = interpolate(frame, [start, start + duration], [0, 1], clamp);
  return Easing.out(Easing.cubic)(progress);
};

const imageMotion = (motion: string, progress: number, zoom = 1, style: EditorialStyle = 'documentary') => {
  const eased = Easing.inOut(Easing.cubic)(progress);
  const intensity = style === 'kinetic' ? 1.28 : style === 'minimal' ? 0.62 : 1;
  const base = 1.045 * zoom;
  const end = (1.045 + 0.065 * intensity) * zoom;
  if (motion === 'slow-zoom-out') return `translate3d(0,0,0) scale(${interpolate(eased, [0, 1], [end, base])})`;
  if (motion === 'pan-left') return `translate3d(${interpolate(eased, [0, 1], [2.6 * intensity, -2.6 * intensity])}%,0,0) scale(${(1.082 + 0.018 * intensity) * zoom})`;
  if (motion === 'pan-right') return `translate3d(${interpolate(eased, [0, 1], [-2.6 * intensity, 2.6 * intensity])}%,0,0) scale(${(1.082 + 0.018 * intensity) * zoom})`;
  if (motion === 'drift-up') return `translate3d(0,${interpolate(eased, [0, 1], [2 * intensity, -2 * intensity])}%,0) scale(${(1.075 + 0.012 * intensity) * zoom})`;
  return `translate3d(0,0,0) scale(${interpolate(eased, [0, 1], [base, end])})`;
};

const FallbackArtwork: React.FC<{accent: string; frame: number}> = ({accent, frame}) => {
  const drift = interpolate(frame, [0, 240], [-60, 80], clamp);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(135deg,#07110e 0%,#10251e 54%,#06100d 100%)'}}>
      <div style={{position: 'absolute', width: 680, height: 680, borderRadius: '50%', left: -150 + drift, top: -210, background: accent, filter: 'blur(110px)', opacity: 0.16}} />
      <div style={{position: 'absolute', width: 560, height: 560, borderRadius: '50%', right: -170 - drift * 0.25, bottom: -220, background: '#6c63ff', filter: 'blur(120px)', opacity: 0.13}} />
      <AbsoluteFill style={{opacity: 0.12, backgroundImage: 'linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.16) 1px,transparent 1px)', backgroundSize: '82px 82px'}} />
    </AbsoluteFill>
  );
};

const EditorialCard: React.FC<{overlay?: EditorialOverlay; accent: string; frame: number; sceneFrames: number; sceneTitle: string}> = ({overlay, accent, frame, sceneFrames, sceneTitle}) => {
  const {fps} = useVideoConfig();
  const type = overlay?.type || 'minimal';
  const progress = enter(frame, 16, 20);
  const exitStart = Math.max(42, Math.min(sceneFrames - 20, Math.round(fps * 7.5)));
  const exit = interpolate(frame, [exitStart, Math.min(sceneFrames - 1, exitStart + 15)], [1, 0], clamp);
  const opacity = progress * exit;
  const translateY = interpolate(progress, [0, 1], [32, 0]);
  const common: React.CSSProperties = {position: 'absolute', opacity, transform: `translate3d(0,${translateY}px,0)`, color: 'white', fontFamily: sans};

  if (type === 'stat') return (
    <div style={{...common, right: 88, top: 212, width: 520, padding: '32px 34px 34px', border: '1px solid rgba(255,255,255,.24)', borderRadius: 24, background: 'linear-gradient(145deg,rgba(5,13,10,.92),rgba(5,13,10,.76))', boxShadow: '0 28px 80px rgba(0,0,0,.4)'}}>
      <div style={{fontSize: 18, fontWeight: 800, letterSpacing: 4, color: accent}}>{overlay?.label}</div>
      <div style={{fontSize: 88, lineHeight: 1, fontWeight: 900, marginTop: 18, letterSpacing: -4}}>{overlay?.value}</div>
      <div style={{width: 86, height: 5, borderRadius: 9, background: accent, margin: '24px 0 19px'}} />
      <div style={{fontSize: 25, lineHeight: 1.3, color: '#ecf3ef'}}>{overlay?.detail}</div>
    </div>
  );

  if (type === 'question') return (
    <div style={{...common, left: 86, top: 242, width: 940}}>
      <div style={{display: 'inline-flex', padding: '9px 14px', borderRadius: 999, color: '#07110e', background: accent, fontSize: 17, fontWeight: 900, letterSpacing: 3}}>{overlay?.label}</div>
      <div style={{fontFamily: serif, fontSize: 66, lineHeight: 1.08, fontWeight: 700, marginTop: 22, textShadow: '0 4px 30px rgba(0,0,0,.66)'}}>{overlay?.value}</div>
      <div style={{fontSize: 18, fontWeight: 800, letterSpacing: 6, marginTop: 25, color: accent}}>{overlay?.detail}</div>
    </div>
  );

  if (type === 'chapter') return (
    <div style={{...common, left: 88, top: 224, width: 920}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <div style={{fontSize: 21, fontWeight: 900, letterSpacing: 5, color: accent}}>{overlay?.label}</div>
        <div style={{height: 2, width: 110, background: accent}} />
        <div style={{fontSize: 17, fontWeight: 700, letterSpacing: 4, color: '#dce7e1'}}>{overlay?.detail}</div>
      </div>
      <div style={{fontFamily: serif, fontSize: 78, lineHeight: 1.02, fontWeight: 700, marginTop: 26, textShadow: '0 4px 34px rgba(0,0,0,.64)'}}>{overlay?.value || sceneTitle}</div>
    </div>
  );

  if (type === 'contrast') return (
    <div style={{...common, left: 88, top: 250, display: 'flex', gap: 27, width: 890}}>
      <div style={{width: 7, minHeight: 224, borderRadius: 9, background: accent}} />
      <div>
        <div style={{fontSize: 17, fontWeight: 900, letterSpacing: 5, color: accent}}>{overlay?.label}</div>
        <div style={{fontSize: 72, lineHeight: 1, fontWeight: 900, marginTop: 17}}>{overlay?.value}</div>
        <div style={{fontSize: 27, lineHeight: 1.32, marginTop: 18, color: '#edf3f0', maxWidth: 760}}>{overlay?.detail}</div>
      </div>
    </div>
  );

  if (type === 'keyword') return (
    <div style={{...common, left: 88, top: 300, width: 800}}>
      <div style={{fontSize: 17, fontWeight: 900, letterSpacing: 5, color: accent}}>{overlay?.label}</div>
      <div style={{fontSize: 78, lineHeight: 1, fontWeight: 900, marginTop: 15, letterSpacing: -2}}>{overlay?.value}</div>
      <div style={{fontSize: 25, lineHeight: 1.3, marginTop: 18, maxWidth: 720, color: '#e7efeb'}}>{overlay?.detail}</div>
    </div>
  );

  const quietOpacity = interpolate(frame, [8, 20, 82, 105], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 88, top: 86, maxWidth: 820, opacity: quietOpacity, color: 'white'}}>
      <div style={{fontFamily: sans, fontSize: 18, fontWeight: 900, letterSpacing: 5, color: accent}}>GLUED ORIGINAL</div>
      <div style={{fontFamily: serif, fontSize: 56, lineHeight: 1.05, fontWeight: 700, marginTop: 15, textShadow: '0 4px 26px rgba(0,0,0,.66)'}}>{sceneTitle}</div>
    </div>
  );
};

const Scene: React.FC<{scene: GluedScene; sceneFrames: number; fadeFrames: number; accent: string; style: EditorialStyle}> = ({scene, sceneFrames, fadeFrames, accent, style}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, sceneFrames - 1)], [0, 1], clamp);
  const opacity = fadeFrames > 0 ? interpolate(frame, [0, fadeFrames], [0, 1], clamp) : 1;
  const foregroundScale = style === 'kinetic' ? 0.91 : 0.94;
  return (
    <AbsoluteFill style={{backgroundColor: '#07100d', opacity, overflow: 'hidden'}}>
      {scene.imagePath ? (
        <>
          <AbsoluteFill style={{background: `radial-gradient(circle at 72% 16%, ${accent}24 0, transparent 34%), linear-gradient(135deg,#0a1712,#020806)`}} />
          <div style={{position: 'absolute', inset: style === 'minimal' ? 0 : 46, overflow: 'hidden', borderRadius: style === 'minimal' ? 0 : 22, boxShadow: style === 'minimal' ? 'none' : '0 28px 90px rgba(0,0,0,.42)'}}>
            <Img src={staticFile(scene.imagePath)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${scene.focalX}% ${scene.focalY}%`, transform: imageMotion(scene.motion, progress, scene.zoom * foregroundScale, style), willChange: 'transform'}} />
          </div>
        </>
      ) : <FallbackArtwork accent={accent} frame={frame} />}
      <AbsoluteFill style={{background: 'linear-gradient(90deg,rgba(2,8,6,.76) 0%,rgba(2,8,6,.28) 52%,rgba(2,8,6,.08) 76%),linear-gradient(0deg,rgba(2,8,6,.76),transparent 45%)'}} />
      {style === 'kinetic' ? <AbsoluteFill style={{opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,.28) 1px,transparent 1px)', backgroundSize: '100% 54px'}} /> : null}
      <EditorialCard overlay={scene.editorial} accent={accent} frame={frame} sceneFrames={sceneFrames} sceneTitle={scene.title} />
    </AbsoluteFill>
  );
};

const CaptionCard: React.FC<{caption?: Caption; time: number; accent: string}> = ({caption, time, accent}) => {
  if (!caption) return null;
  const words = caption.text.trim().split(/\s+/);
  const captionProgress = Math.max(0, Math.min(0.999, (time - caption.start) / Math.max(0.12, caption.end - caption.start)));
  const activeWord = Math.floor(captionProgress * words.length);
  return (
    <div style={{position: 'absolute', left: '50%', bottom: 68, transform: 'translateX(-50%)', width: 'fit-content', maxWidth: 1260, padding: '12px 23px 14px', borderRadius: 14, background: 'rgba(2,7,5,.86)', boxShadow: '0 8px 35px rgba(0,0,0,.4)', color: '#fff', fontFamily: sans, fontWeight: 720, fontSize: 33, lineHeight: 1.22, textAlign: 'center', textShadow: '0 2px 5px #000'}}>
      {words.map((word, index) => <React.Fragment key={`${word}-${index}`}><span style={{color: index === activeWord ? accent : '#fff'}}>{word}</span>{index < words.length - 1 ? ' ' : ''}</React.Fragment>)}
    </div>
  );
};

export const GluedVideo: React.FC<GluedProject> = (project) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const accent = project.accentColor || '#66f0c1';
  const style: EditorialStyle = project.editorialStyle || 'documentary';
  let cursor = 0;
  const segments = project.scenes.map((scene, index) => {
    const sceneFrames = Math.max(1, Math.round(scene.duration * fps));
    const fadeFrames = index > 0 && scene.transition !== 'cut' ? Math.min(14, Math.floor(sceneFrames / 4)) : 0;
    const from = Math.max(0, cursor - fadeFrames);
    const segmentDuration = sceneFrames + fadeFrames;
    const startFrame = cursor;
    cursor += sceneFrames;
    return {scene, from, segmentDuration, sceneFrames, fadeFrames, startFrame, index};
  });
  const time = frame / fps;
  const activeCaption = project.captions.find((caption) => time >= caption.start && time < caption.end);
  const activeSceneIndex = Math.max(0, segments.findIndex((segment, index) => frame >= segment.startFrame && frame < (segments[index + 1]?.startFrame ?? Number.POSITIVE_INFINITY)));
  const overallProgress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: '#020806'}}>
      {segments.map(({scene, from, segmentDuration, sceneFrames, fadeFrames, index}) => (
        <Sequence key={scene.id} from={from} durationInFrames={segmentDuration} premountFor={fps} style={{zIndex: index}}>
          <Scene scene={scene} sceneFrames={sceneFrames} fadeFrames={fadeFrames} accent={accent} style={style} />
        </Sequence>
      ))}
      {project.narrationPath ? <Sequence from={Math.round(fps * 0.12)}><Audio src={staticFile(project.narrationPath)} volume={0.98} /></Sequence> : null}
      <AbsoluteFill style={{zIndex: 100, pointerEvents: 'none'}}>
        <div style={{position: 'absolute', top: 42, right: 56, color: '#e8f1ec', fontFamily: sans, fontSize: 17, fontWeight: 800, letterSpacing: 3, padding: '10px 14px', border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, background: 'rgba(2,7,5,.52)'}}>SCENE {String(activeSceneIndex + 1).padStart(2, '0')} / {String(project.scenes.length).padStart(2, '0')}</div>
        <CaptionCard caption={activeCaption} time={time} accent={accent} />
        {project.showProgress !== false ? <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: 'rgba(255,255,255,.13)'}}><div style={{height: '100%', width: `${overallProgress * 100}%`, background: accent, boxShadow: `0 0 18px ${accent}`}} /></div> : null}
        {project.aiNarration && frame < fps * 5 ? <div style={{position: 'absolute', right: 56, top: 98, color: '#d8e7df', fontFamily: sans, fontSize: 15, letterSpacing: 1.5, padding: '8px 12px', border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, background: 'rgba(0,0,0,.38)'}}>AI-GENERATED NARRATION</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
