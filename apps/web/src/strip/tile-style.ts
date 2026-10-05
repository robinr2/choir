import { type MotionValue, useTransform } from 'motion/react';
import type { LayoutMotion, SpaceMotion } from './layout-motion';
import { OVERVIEW_ZOOM } from './overview';
import type { Placement, Space } from './placements';

function useSpaceOrigin(motion: LayoutMotion, space: SpaceMotion) {
  const { width, height, zoom, step } = motion;
  const left = useTransform(() => (width.get() * (1 - zoom.get())) / 2);
  const top = useTransform(
    () =>
      (height.get() * (1 - zoom.get())) / 2 +
      (space.index.get() - motion.shown()) * step.get() * zoom.get(),
  );
  return { left, top };
}

function useZoomed(
  origin: MotionValue<number>,
  offset: () => number,
  zoom: MotionValue<number>,
) {
  return useTransform(() => origin.get() + offset() * zoom.get());
}

export function useTileStyle(motion: LayoutMotion, placement: Placement) {
  const tile = motion.tile(placement);
  const space = motion.space(placement.workspaceId);
  const { left, top } = useSpaceOrigin(motion, space);
  const { zoom } = motion;
  const x = useZoomed(left, () => tile.x.get() - space.viewX.get(), zoom);
  const y = useZoomed(top, () => tile.y.get(), zoom);
  return {
    frame: {
      x,
      y,
      width: tile.width,
      height: tile.height,
      scale: zoom,
      originX: 0,
      originY: 0,
    },
    content: { opacity: tile.opacity, scale: tile.scale },
  };
}

function useOverviewProgress(motion: LayoutMotion) {
  return useTransform(() => (1 - motion.zoom.get()) / (1 - OVERVIEW_ZOOM));
}

export function useBackdropStyle(motion: LayoutMotion) {
  return { opacity: useOverviewProgress(motion) };
}

export function useWorkspaceStyle(motion: LayoutMotion, space: Space) {
  const { left, top } = useSpaceOrigin(motion, motion.space(space.id, space));
  const opacity = useOverviewProgress(motion);
  return {
    x: left,
    y: top,
    width: motion.width,
    height: motion.height,
    scale: motion.zoom,
    originX: 0,
    originY: 0,
    opacity,
  };
}
