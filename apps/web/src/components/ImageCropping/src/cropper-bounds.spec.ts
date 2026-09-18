import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clientRectToCanvasRect, getCoverMoveDelta, getCoverZoomDelta, isRectInside } from './cropper-bounds.ts'

describe('cropper-bounds', () => {
  it('rejects a crop box larger than the image', () => {
    assert.equal(
      isRectInside({ x: 100, y: 60, width: 200, height: 200 }, { x: 80, y: 0, width: 160, height: 320 }),
      false
    )
  })

  it('accepts a crop box fully covered by the image', () => {
    assert.equal(
      isRectInside({ x: 112.5, y: 60, width: 200, height: 200 }, { x: 0, y: 0, width: 425, height: 320 }),
      true
    )
  })

  it('computes zoom-out that would shrink the image below the crop box', () => {
    assert.equal(getCoverZoomDelta({ width: 160, height: 320 }, { width: 200, height: 200 }), 0.25)
    assert.equal(getCoverZoomDelta({ width: 400, height: 400 }, { width: 200, height: 200 }), 0)
  })

  it('computes pan needed to keep the crop box inside the image', () => {
    assert.deepEqual(
      getCoverMoveDelta({ left: 120, right: 320, top: 40, bottom: 240 }, { left: 100, right: 300, top: 60, bottom: 260 }),
      { x: -20, y: 20 }
    )
  })

  it('maps a client rect onto the canvas coordinate space', () => {
    assert.deepEqual(
      clientRectToCanvasRect({ left: 150, top: 80, width: 200, height: 200 }, { left: 50, top: 20 }),
      { x: 100, y: 60, width: 200, height: 200 }
    )
  })
})
