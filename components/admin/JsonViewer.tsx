"use client"
import React from 'react'

export default function JsonViewer({ data }: { data: any }) {
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `course-package-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ fontFamily: 'monospace' }}>
      <div style={{ marginBottom: 8 }}>
        <button onClick={handleDownload} style={{ padding: '6px 10px' }}>Download JSON</button>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12, borderRadius: 6 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
