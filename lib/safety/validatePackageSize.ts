export function validatePackageSize(coursePackage: any, maxBytes = 5_000_000) {
  try {
    const jsonStr = JSON.stringify(coursePackage ?? {})
    const size = Buffer.byteLength(jsonStr, 'utf8')
    return { ok: size <= maxBytes, size, max: maxBytes }
  } catch {
    return { ok: false, size: 0, max: maxBytes }
  }
}

export default validatePackageSize
