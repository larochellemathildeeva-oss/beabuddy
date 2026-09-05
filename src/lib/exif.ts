export type ExifInfo = {
  lat?: number;
  lon?: number;
  takenAt?: string;
};

/**
 * Minimal JPEG EXIF reader: pulls GPS coordinates and the original capture
 * date straight out of the file in the browser. Returns an empty object when
 * the photo carries no EXIF (PNG, HEIC re-encodes, stripped uploads).
 */
export async function readExif(file: File): Promise<ExifInfo> {
  try {
    const buffer = await file.slice(0, 512 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};

    let offset = 2;
    let tiffStart = -1;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
        const app1 = offset + 4;
        if (
          view.getUint32(app1) === 0x45786966 &&
          view.getUint16(app1 + 4) === 0x0000
        ) {
          tiffStart = app1 + 6;
        }
        break;
      }
      if (marker === 0xda) break;
      offset += 2 + size;
    }
    if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return {};

    const le = view.getUint16(tiffStart) === 0x4949;
    const u16 = (p: number) => view.getUint16(p, le);
    const u32 = (p: number) => view.getUint32(p, le);
    if (u16(tiffStart + 2) !== 0x002a) return {};

    const readEntries = (dirStart: number) => {
      const entries: Record<number, { type: number; count: number; valueAt: number }> = {};
      if (dirStart + 2 > view.byteLength) return entries;
      const count = u16(dirStart);
      for (let i = 0; i < count; i++) {
        const entry = dirStart + 2 + i * 12;
        if (entry + 12 > view.byteLength) break;
        const tag = u16(entry);
        const type = u16(entry + 2);
        const num = u32(entry + 4);
        const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
        const bytes = (sizes[type] ?? 1) * num;
        const valueAt = bytes > 4 ? tiffStart + u32(entry + 8) : entry + 8;
        entries[tag] = { type, count: num, valueAt };
      }
      return entries;
    };

    const readAscii = (e: { count: number; valueAt: number }) => {
      let out = "";
      for (let i = 0; i < e.count - 1; i++) {
        const c = view.getUint8(e.valueAt + i);
        if (!c) break;
        out += String.fromCharCode(c);
      }
      return out;
    };

    const readRationals = (e: { count: number; valueAt: number }) => {
      const out: number[] = [];
      for (let i = 0; i < e.count; i++) {
        const p = e.valueAt + i * 8;
        if (p + 8 > view.byteLength) break;
        const denom = u32(p + 4);
        out.push(denom === 0 ? 0 : u32(p) / denom);
      }
      return out;
    };

    const ifd0 = readEntries(tiffStart + u32(tiffStart + 4));
    const result: ExifInfo = {};

    const exifPointer = ifd0[0x8769];
    if (exifPointer) {
      const exifIfd = readEntries(tiffStart + u32(exifPointer.valueAt));
      const dateEntry = exifIfd[0x9003] ?? exifIfd[0x9004];
      if (dateEntry) {
        // "2024:06:14 08:31:02"
        const raw = readAscii(dateEntry);
        const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (m) {
          const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
          const d = new Date(iso);
          if (!Number.isNaN(d.getTime())) result.takenAt = d.toISOString();
        }
      }
    }

    const gpsPointer = ifd0[0x8825];
    if (gpsPointer) {
      const gps = readEntries(tiffStart + u32(gpsPointer.valueAt));
      const toDeg = (parts: number[]) =>
        (parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
      const latEntry = gps[0x0002];
      const lonEntry = gps[0x0004];
      if (latEntry && lonEntry) {
        const latRef = gps[0x0001] ? readAscii(gps[0x0001]) : "N";
        const lonRef = gps[0x0003] ? readAscii(gps[0x0003]) : "E";
        const lat = toDeg(readRationals(latEntry)) * (latRef.startsWith("S") ? -1 : 1);
        const lon = toDeg(readRationals(lonEntry)) * (lonRef.startsWith("W") ? -1 : 1);
        if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
          result.lat = lat;
          result.lon = lon;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}
