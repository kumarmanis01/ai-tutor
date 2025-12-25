"use client"
import React, { useState, useCallback } from 'react'

function isObject(v: any) {
  return v !== null && typeof v === 'object'
}

function shortPreview(v: any) {
  if (Array.isArray(v)) return `[Array(${v.length})]`
  if (isObject(v)) return '{...}'
  if (typeof v === 'string') return `"${v.length > 80 ? v.slice(0, 80) + '…' : v}"`
  return String(v)
}

function JsonNode({ value, name, path, expandedByDefault }: { value: any; name?: string; path: string; expandedByDefault: boolean }) {
  const [open, setOpen] = useState(expandedByDefault)
  const toggle = useCallback(() => setOpen((s) => !s), [])

  if (Array.isArray(value)) {
    return (
      <div className="text-sm font-mono">
        <div className="flex items-center gap-2">
          <button aria-label={`toggle ${path}`} onClick={toggle} className="text-xs text-gray-600">{open ? '▾' : '▸'}</button>
          {name && <span className="text-gray-700">{name}: </span>}
          <span className="text-gray-500">{shortPreview(value)}</span>
        </div>
        {open && (
          <div className="pl-4">
            {value.map((v, i) => (
              <JsonNode key={i} value={v} name={String(i)} path={`${path}.${i}`} expandedByDefault={false} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (isObject(value)) {
    const keys = Object.keys(value)
    return (
      <div className="text-sm font-mono">
        <div className="flex items-center gap-2">
          <button aria-label={`toggle ${path}`} onClick={toggle} className="text-xs text-gray-600">{open ? '▾' : '▸'}</button>
          {name && <span className="text-gray-700">{name}: </span>}
          <span className="text-gray-500">{shortPreview(value)}</span>
        </div>
        {open && (
          <div className="pl-4">
            {keys.map((k) => (
              <JsonNode key={k} value={(value as any)[k]} name={k} path={`${path}.${k}`} expandedByDefault={false} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-sm font-mono">
      <div>
        {name && <span className="text-gray-700">{name}: </span>}
        <span className="text-gray-800">{typeof value === 'string' ? `"${value}"` : String(value)}</span>
      </div>
    </div>
  )
}

export default function ReadOnlyJsonViewer({ data, collapsedByDefault = true }: { data: any; collapsedByDefault?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }, [data])

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <div className="bg-white dark:bg-gray-900 border rounded p-3">
      <div className="flex gap-2 items-center mb-2">
        <button onClick={handleCopy} className="px-2 py-1 text-xs bg-gray-100 rounded">{copied ? 'Copied' : 'Copy'}</button>
        <button onClick={handleDownload} className="px-2 py-1 text-xs bg-gray-100 rounded">Download</button>
        <div className="text-xs text-gray-500">(read-only)</div>
      </div>
      <div className="overflow-auto max-h-96">
        <JsonNode value={data} path="$" expandedByDefault={!collapsedByDefault} />
      </div>
    </div>
  )
}
