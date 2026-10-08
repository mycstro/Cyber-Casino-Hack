/** Fits the complete board, including its frame, in portrait and landscape views. */
export function boardCameraDistance(rows: number, cols: number, aspect: number, fov: number) {
  const halfFov = Math.tan(fov * Math.PI / 360);
  return Math.max((cols * 1.15 + 0.8) / (2 * halfFov * aspect),
    (rows * 1.15 + 0.8) / (2 * halfFov)) * 1.1;
}
