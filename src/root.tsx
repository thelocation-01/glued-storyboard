import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {GluedVideo} from './video';
import type {GluedProject} from './types';

const fixture: GluedProject = {
  id: 'fixture', title: 'Glued Storyboard', script: '', fps: 30, width: 1920, height: 1080,
  scenes: [{id: 'fixture-scene', narration: '', duration: 5, transition: 'cut', motion: 'slow-zoom-in', title: 'GLUED STORYBOARD', subtitle: 'Production renderer', imagePath: '', focalX: 50, focalY: 50, zoom: 1}],
  captions: [], totalFrames: 150,
};

const calculateMetadata: CalculateMetadataFunction<GluedProject> = ({props}) => ({
  durationInFrames: Math.max(1, props.totalFrames ?? Math.round(props.scenes.reduce((sum, scene) => sum + scene.duration, 0) * props.fps)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

export const RemotionRoot: React.FC = () => (
  <Composition id="GluedStoryboard" component={GluedVideo} durationInFrames={fixture.totalFrames!} fps={fixture.fps} width={fixture.width} height={fixture.height} defaultProps={fixture} calculateMetadata={calculateMetadata} />
);
