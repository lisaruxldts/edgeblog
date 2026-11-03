// 从文件头读出图片的像素宽高（上传时读一次存进 media 表），用来给 <img> 补 width/height，避免加载时版面跳动（CLS）。
// 支持 PNG / GIF / JPEG（含 EXIF 旋转）/ WebP / AVIF；SVG 没有固定像素尺寸，和读不出来、文件损坏的一样返回 null

export interface ImageSize {
	width: number;
	height: number;
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

const ascii = (b: Uint8Array, start: number, length: number): string => String.fromCharCode(...b.subarray(start, start + length));

const size = (width: number, height: number): ImageSize | null => (width > 0 && height > 0 ? { width, height } : null);

export function imageSize(buf: ArrayBuffer): ImageSize | null {
	const b = new Uint8Array(buf);
	const v = new DataView(buf);
	try {
		if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return size(v.getUint32(16), v.getUint32(20));
		if (b.length >= 10 && ascii(b, 0, 3) === "GIF") return size(v.getUint16(6, true), v.getUint16(8, true));
		if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return jpegSize(b, v);
		if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return webpSize(b, v);
		if (b.length >= 12 && ascii(b, 4, 4) === "ftyp") return ispeSize(b, v);
	} catch {
		// 截断或损坏的文件：越界读取会抛 RangeError
	}
	return null;
}

function jpegSize(b: Uint8Array, v: DataView): ImageSize | null {
	let orientation = 1;
	let i = 2;
	while (i + 9 < b.length) {
		if (b[i] !== 0xff) return null;
		const marker = b[i + 1];
		if (marker === 0xff) {
			i++; // 段前的填充字节
			continue;
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
			i += 2; // 不带长度的标记
			continue;
		}
		if (marker === 0xd9 || marker === 0xda) return null; // 到了图像数据还没见到 SOF
		const length = v.getUint16(i + 2);
		if (marker === 0xe1 && ascii(b, i + 4, 6) === "Exif\0\0") orientation = exifOrientation(v, i + 10) ?? orientation;
		if (SOF_MARKERS.has(marker)) {
			const height = v.getUint16(i + 5);
			const width = v.getUint16(i + 7);
			// EXIF 方向 5–8 带 90° 旋转，浏览器按旋转后的样子显示，宽高要对调
			return orientation >= 5 && orientation <= 8 ? size(height, width) : size(width, height);
		}
		i += 2 + length;
	}
	return null;
}

// 在 IFD0 里找 Orientation（0x0112）；tiff 是 TIFF 头的起始位置
function exifOrientation(v: DataView, tiff: number): number | null {
	try {
		const little = v.getUint16(tiff) === 0x4949; // "II"
		const ifd = tiff + v.getUint32(tiff + 4, little);
		const count = v.getUint16(ifd, little);
		for (let k = 0; k < count; k++) {
			const entry = ifd + 2 + k * 12;
			if (v.getUint16(entry, little) === 0x0112) return v.getUint16(entry + 8, little);
		}
	} catch {
		// EXIF 损坏不影响读尺寸
	}
	return null;
}

function webpSize(b: Uint8Array, v: DataView): ImageSize | null {
	switch (ascii(b, 12, 4)) {
		case "VP8X": // 扩展格式：画布宽高减 1，各 24 位
			return size(1 + (v.getUint32(24, true) & 0xffffff), 1 + (v.getUint32(26, true) >>> 8));
		case "VP8 ": // 有损
			return size(v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff);
		case "VP8L": {
			// 无损：签名 0x2f 之后 14 位宽减 1、14 位高减 1
			const bits = v.getUint32(21, true);
			return size(1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff));
		}
	}
	return null;
}

// AVIF / HEIF：找 meta 里的 ispe（image spatial extents）盒子，常见编码器都把它放在文件头部
function ispeSize(b: Uint8Array, v: DataView): ImageSize | null {
	const end = Math.min(b.length - 16, 64 * 1024);
	for (let i = 8; i < end; i++) {
		if (b[i] === 0x69 && b[i + 1] === 0x73 && b[i + 2] === 0x70 && b[i + 3] === 0x65) return size(v.getUint32(i + 8), v.getUint32(i + 12));
	}
	return null;
}
