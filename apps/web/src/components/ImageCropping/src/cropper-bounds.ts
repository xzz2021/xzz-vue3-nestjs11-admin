export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ClientRectLike {
  left: number
  top: number
  width: number
  height: number
}

export interface BoxEdges {
  left: number
  right: number
  top: number
  bottom: number
}

const EPS = 0.5

export function isRectInside(inner: CropRect, outer: CropRect, epsilon = EPS): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  )
}

export function clientRectToCanvasRect(rect: ClientRectLike, canvasRect: { left: number; top: number }): CropRect {
  return {
    x: rect.left - canvasRect.left,
    y: rect.top - canvasRect.top,
    width: rect.width,
    height: rect.height
  }
}

export function getCoverZoomDelta(
  image: { width: number; height: number },
  selection: { width: number; height: number }
): number {
  const scale = Math.max(
    selection.width / Math.max(image.width, Number.EPSILON),
    selection.height / Math.max(image.height, Number.EPSILON)
  )
  return scale > 1 ? scale - 1 : 0
}

export function getCoverMoveDelta(image: BoxEdges, selection: BoxEdges): { x: number; y: number } {
  const x =
    image.left > selection.left
      ? selection.left - image.left
      : image.right < selection.right
        ? selection.right - image.right
        : 0
  const y =
    image.top > selection.top
      ? selection.top - image.top
      : image.bottom < selection.bottom
        ? selection.bottom - image.bottom
        : 0
  return { x, y }
}
