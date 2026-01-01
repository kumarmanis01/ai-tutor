import Link from 'next/link'

type Props = { params: { syllabusId: string } }

export default async function Page({ params }: Props) {
  const { syllabusId } = params
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/courses/${syllabusId}`, { cache: 'no-store' })
  if (!res.ok) {
    return (<div style={{ padding: 24 }}><h1>Not found</h1></div>)
  }
  const data = await res.json()

  return (
    <div style={{ padding: 24 }}>
      <h1>Versions for {syllabusId}</h1>
      <ul>
        {Array.isArray(data.versions) && data.versions.map((v: any) => (
          <li key={v} style={{ marginBottom: 8 }}>
            Version {v} {' '}
            <Link href={`/admin/courses/${syllabusId}/${v}`}>View JSON</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
