import JsonViewer from '@/components/Admin/JsonViewer'

type Props = { params: { syllabusId: string; version: string } }

export default async function Page({ params }: Props) {
  const { syllabusId, version } = params
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/courses/${syllabusId}/${version}`, { cache: 'no-store' })
  if (!res.ok) return (<div style={{ padding: 24 }}><h1>Not found</h1></div>)
  const data = await res.json()

  return (
    <div style={{ padding: 24 }}>
      <h1>Course {syllabusId} — v{version}</h1>
      <JsonViewer data={data} />
    </div>
  )
}
