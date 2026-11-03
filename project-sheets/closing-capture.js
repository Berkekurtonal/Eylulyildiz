// Read-only transfer of the existing rendered ARCHÉ view. No camera, scene,
// renderer or journey DOM state is changed, and no replacement ARCHÉ is drawn.
export function createClosingCapture(source, snapshot) {
  const ctx = snapshot.getContext('2d', { willReadFrequently: true });
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const sample = probe.getContext('2d', { willReadFrequently: true });
  return () => {
    if (!source.width || !source.height) return false;
    // A cleared WebGL buffer is transparent. Keep the last valid closing frame.
    sample.clearRect(0, 0, 1, 1);
    sample.drawImage(source, 0, 0, 1, 1);
    if (sample.getImageData(0, 0, 1, 1).data[3] < 200) return false;
    const width = Math.min(2400, source.width);
    const height = Math.round(width * source.height / source.width);
    if (snapshot.width !== width || snapshot.height !== height) {
      snapshot.width = width; snapshot.height = height;
    }
    ctx.drawImage(source, 0, 0, width, height);
    return true;
  };
}

