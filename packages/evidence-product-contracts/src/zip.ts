/**
 * Deterministic stored-entry ZIP writer.
 *
 * Entries are sorted by path, stored uncompressed and written with fixed
 * metadata: no modification time, no host clock and no compression-level
 * variation. Identical inputs therefore produce identical bytes, which is what
 * lets an export be content-addressed. It backs both the reviewed-assessment
 * bundle and the OOXML container behind DOCX output.
 */

export interface EvidenceZipEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

const encoder = new TextEncoder();

/** Export bytes are always LF and NFC so text is byte-stable across hosts. */
export function evidenceTextBytes(value: string): Uint8Array {
  return encoder.encode(value.replaceAll('\r\n', '\n').normalize('NFC'));
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

export function evidenceJoinBytes(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function evidenceZipStore(
  entries: readonly EvidenceZipEntry[],
): Uint8Array {
  const files = [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = evidenceTextBytes(file.path);
    const crc = crc32(file.bytes);
    const local = evidenceJoinBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0x0021),
      u32(crc),
      u32(file.bytes.length),
      u32(file.bytes.length),
      u16(name.length),
      u16(0),
      name,
      file.bytes,
    ]);
    localParts.push(local);
    centralParts.push(
      evidenceJoinBytes([
        u32(0x02014b50),
        u16(0x0314),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0x0021),
        u32(crc),
        u32(file.bytes.length),
        u32(file.bytes.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0x81a40000),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = evidenceJoinBytes(centralParts);
  return evidenceJoinBytes([
    ...localParts,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
}
