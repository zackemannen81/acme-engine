export interface SseFrame {
  readonly event: string;
  readonly data: string;
}

export function parseSseFrames(buffer: string): {
  readonly frames: readonly SseFrame[];
  readonly rest: string;
} {
  const frames: SseFrame[] = [];
  let rest = buffer;
  while (true) {
    const separator = rest.indexOf('\n\n');
    if (separator === -1) {
      break;
    }
    const raw = rest.slice(0, separator);
    rest = rest.slice(separator + 2);
    const frame = parseFrame(raw);
    if (frame !== undefined) {
      frames.push(frame);
    }
  }
  return { frames, rest };
}

function parseFrame(block: string): SseFrame | undefined {
  const normalized = block.replaceAll('\r\n', '\n');
  if (normalized.trim().length === 0) {
    return undefined;
  }
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of normalized.split('\n')) {
    if (line.startsWith(':') || line.length === 0) {
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return undefined;
  }
  return { event, data: dataLines.join('\n') };
}
