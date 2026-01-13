import exportCourseToPDF from '@/lib/exporters/pdf'

test('exportCourseToPDF returns non-empty buffer', async () => {
  const pkg = {
    title: 'Sample Course',
    modules: [
      { moduleId: 'm1', lessons: [{ lessonIndex: 1, id: 'l1', title: 'Intro', objectives: ['o1','o2'], explanation: { overview: 'Overview text', concepts: [{ title: 'C', explanation: 'Concept explanation' }] } }] }
    ]
  }

  const buf = await exportCourseToPDF(pkg as any)
  expect(Buffer.isBuffer(buf)).toBe(true)
  expect(buf.length).toBeGreaterThan(0)
})
