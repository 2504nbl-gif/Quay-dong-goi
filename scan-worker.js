// Bộ đọc mã ZXing chạy ở luồng riêng, để việc đọc mã không làm giật video đang quay.
importScripts('vendor/zxing.min.js');
const Z = self.ZXing;
let reader = null, qr = null;
const oc = new OffscreenCanvas(1, 1), octx = oc.getContext('2d', {willReadFrequently: true});

function setup(acceptQR) {
  const hints = new Map();
  const fm = [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_93, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODABAR];
  if (acceptQR) fm.push(Z.BarcodeFormat.QR_CODE);
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, fm);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  qr = acceptQR;
}

self.onmessage = e => {
  const {id, bmp, rot, acceptQR} = e.data;
  let text = null;
  try {
    if (!reader || qr !== acceptQR) setup(acceptQR);
    const w = bmp.width, h = bmp.height;
    if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }
    octx.drawImage(bmp, 0, 0);
    bmp.close();
    const px = octx.getImageData(0, 0, w, h).data;
    // Gói điểm ảnh dạng 0xRRGGBB cho ZXing (bản này đọc sai nếu đưa sẵn ảnh xám); nếu rot thì xoay 90° (tem đặt dọc)
    const ow = rot ? h : w, oh = rot ? w : h, rgb = new Int32Array(ow * oh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        rgb[rot ? x * ow + (h - 1 - y) : y * w + x] = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      }
    }
    const src = new Z.RGBLuminanceSource(rgb, ow, oh);
    text = reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(src))).getText().trim();
  } catch (err) {
    text = null;
  } finally {
    try { reader && reader.reset(); } catch (_) {}
  }
  self.postMessage({id, text});
};
