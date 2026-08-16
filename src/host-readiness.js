/**
 * Parse a readiness marker across arbitrary stream chunk boundaries while
 * preserving the original Host output and bounding unmatched memory.
 */
export function createHostReadinessParser({
  pattern,
  writeOutput,
  onReady,
  maxBufferLength = 4096,
}) {
  let buffer = ''
  let ready = false

  return {
    push(chunk) {
      const text = chunk.toString()
      writeOutput(text)
      if (ready) return
      buffer += text
      pattern.lastIndex = 0
      const match = pattern.exec(buffer)
      if (match) {
        ready = true
        buffer = ''
        onReady(match[1])
        return
      }
      if (buffer.length > maxBufferLength) buffer = buffer.slice(-maxBufferLength)
    },
    bufferedLength() {
      return buffer.length
    },
  }
}
