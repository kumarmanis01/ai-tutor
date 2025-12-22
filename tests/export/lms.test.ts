import { exportCourseToLMS } from '../../lib/exporters/lms'

describe('LMS exporter', () => {
  it('creates a zip with index, lessons and manifest', () => {
    const pkg = {
      title: 'Test Course',
      modules: [
        { title: 'M1', lessons: [ { title: 'L1', objectives: ['o1'], explanation: { overview: 'ov1', concepts: [{ title: 'c1', explanation: 'ce1' }] } }, { title: 'L2' } ] }
      ]
    }
    const buf = exportCourseToLMS(pkg)
    expect(buf).toBeInstanceOf(Buffer)
    const s = buf.toString('utf8')
    expect(s).toContain('index.html')
    expect(s).toContain('lessons/lesson-01.html')
    expect(s).toContain('manifest.json')
    // manifest should contain course title
    expect(s).toContain('Test Course')
  })
})
