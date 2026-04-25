// plugins/render/src/viewports.ts
// named viewport presets & resolver for matrix screenshots

export const VIEWPORT_PRESET_NAMES = [
  'mobile',
  'tablet',
  'desktop',
  'wide',
] as const;

export type ViewportPreset = (typeof VIEWPORT_PRESET_NAMES)[number];

export const VIEWPORT_PRESETS: Record<
  ViewportPreset,
  { width: number; height: number }
> = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

export interface ResolvedViewport {
  preset?: ViewportPreset;
  width: number;
  height: number;
}

export const DEFAULT_VIEWPORT: ResolvedViewport = {
  width: 1024,
  height: 768,
};

export function resolveViewport(
  input: ViewportPreset | { width?: number; height?: number } | undefined
): ResolvedViewport {
  if (input === undefined) {
    return { ...DEFAULT_VIEWPORT };
  }
  if (typeof input === 'string') {
    return { preset: input, ...VIEWPORT_PRESETS[input] };
  }
  return {
    width: input.width ?? DEFAULT_VIEWPORT.width,
    height: input.height ?? DEFAULT_VIEWPORT.height,
  };
}

export function viewportLabelFragment(v: ResolvedViewport): string {
  const base = v.preset ?? 'custom';
  return `${base}-${v.width}x${v.height}`;
}
