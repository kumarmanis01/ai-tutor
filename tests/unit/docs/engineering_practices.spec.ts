import fs from 'fs'
import path from 'path'

describe('docs/ENGINEERING_PRACTICES.md header', () => {
  it('exists and contains a header', () => {
    const p = path.join(__dirname, '../../../docs/ENGINEERING_PRACTICES.md')
    const txt = fs.readFileSync(p, 'utf8')
    expect(txt).toContain('FILE OBJECTIVE')
  })
})
