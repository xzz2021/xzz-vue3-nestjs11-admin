import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DANGEROUS_FILENAME_RE, joinRelativeKey, normalizePrefix } from './dangerousFilename'

describe('dangerousFilename', () => {
  it('blocks dangerous extensions including double extensions', () => {
    assert.equal(DANGEROUS_FILENAME_RE.test('payload.exe'), true)
    assert.equal(DANGEROUS_FILENAME_RE.test('shell.php.jpg'), true)
    assert.equal(DANGEROUS_FILENAME_RE.test('report.docx'), false)
  })

  it('normalizes prefix and joins a dragged relative path', () => {
    assert.equal(normalizePrefix('docs/2026'), 'docs/2026/')
    assert.deepEqual(joinRelativeKey('docs/', 'nested/photo.png'), {
      prefix: 'docs/nested/',
      filename: 'photo.png',
      key: 'docs/nested/photo.png'
    })
  })

  it('rejects parent-directory segments', () => {
    assert.throws(() => normalizePrefix('docs/../secret'))
  })
})
