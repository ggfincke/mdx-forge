// src/internal/source-position.ts
// locate source points & rebase parsed positions to their original document

import type { Point, Position } from 'unist';

export interface SourceOrigin extends Point {
  offset: number;
}

export const SOURCE_START: SourceOrigin = Object.freeze({
  line: 1,
  column: 1,
  offset: 0,
});

export function bodyOriginForContent(
  source: string,
  content: string
): SourceOrigin {
  if (!source.endsWith(content)) {
    return SOURCE_START;
  }
  return pointAtOffset(source, source.length - content.length);
}

export function pointAtOffset(
  source: string,
  targetOffset: number
): SourceOrigin {
  const offset = Math.min(Math.max(0, targetOffset), source.length);
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index++) {
    if (source[index] === '\r') {
      line++;
      column = 1;
      if (index + 1 < offset && source[index + 1] === '\n') {
        index++;
      }
      continue;
    }
    if (source[index] === '\n') {
      line++;
      column = 1;
      continue;
    }
    column++;
  }
  return { line, column, offset };
}

export function pointAtLineColumn(
  source: string,
  targetLine: number,
  targetColumn: number
): SourceOrigin {
  let offset = 0;
  let line = 1;
  let column = 1;
  while (
    offset < source.length &&
    (line < targetLine || column < targetColumn)
  ) {
    const char = source[offset];
    if (char === '\r') {
      line++;
      column = 1;
      offset++;
      if (source[offset] === '\n') {
        offset++;
      }
      continue;
    }
    if (char === '\n') {
      line++;
      column = 1;
      offset++;
      continue;
    }
    column++;
    offset++;
  }
  return { line, column, offset };
}

export function rebasePosition(
  position: Position,
  origin: SourceOrigin
): Position {
  return {
    start: rebasePoint(position.start, origin),
    end: rebasePoint(position.end, origin),
  };
}

function rebasePoint(point: Point, origin: SourceOrigin): Point {
  return {
    line: point.line + origin.line - 1,
    column: point.line === 1 ? point.column + origin.column - 1 : point.column,
    ...(point.offset !== undefined
      ? { offset: point.offset + origin.offset }
      : {}),
  };
}
