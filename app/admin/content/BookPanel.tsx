'use client'

import React, { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'

export interface BookRowData {
  id: string
  board: string
  grade: number
  subjectId: string
  subjectName: string
  language: string
  edition: string | null
  originalName: string
  fileSizeBytes: number
  pageCount: number | null
  parseStatus: string
  parseError: string | null
  parsedAt: string | null
  chapterCount: number
  topicCount: number
}

interface SubjectOption {
  id: string
  name: string
  grade: number
  boardSlug: string
}

interface BookPanelProps {
  books: BookRowData[]
  subjects: SubjectOption[]
}

function parseStatusIcon(status: string) {
  if (status === 'parsed') return <span className="text-[#1D9E75] font-bold">&#10003;</span>
  if (status === 'parsing') return <span className="animate-spin inline-block w-4 h-4 border-2 border-[#534AB7] border-t-transparent rounded-full" />
  if (status === 'failed') return <span className="text-[#E24B4A] font-bold">&#10007;</span>
  return <span className="text-gray-400">&#9679;</span>
}

export function BookPanel({ books, subjects }: BookPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    subjectId: '',
    language: 'en',
    edition: '',
  })

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setUploadError(null)

    const file = fileRef.current?.files?.[0]
    if (!file) { setUploadError('Please select a PDF file.'); return }
    if (!form.subjectId) { setUploadError('Please select a subject.'); return }
    if (!file.name.toLowerCase().endsWith('.pdf')) { setUploadError('Only PDF files are accepted.'); return }
    if (file.size > 50 * 1024 * 1024) { setUploadError('File too large (max 50MB).'); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('subjectId', form.subjectId)
    fd.append('language', form.language)
    if (form.edition.trim()) fd.append('edition', form.edition.trim())

    try {
      const res = await fetch('/api/admin/books/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      setShowModal(false)
      setForm({ subjectId: '', language: 'en', edition: '' })
      if (fileRef.current) fileRef.current.value = ''
      startTransition(() => router.refresh())
    } catch {
      setUploadError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(bookId: string) {
    if (!confirm('Delete this book? This cannot be undone.')) return
    const res = await fetch(`/api/admin/books?id=${bookId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Delete failed'); return }
    startTransition(() => router.refresh())
  }

  async function handleRetry(bookId: string) {
    const res = await fetch('/api/admin/books/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Retry failed'); return }
    startTransition(() => router.refresh())
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
          Textbook PDFs
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="min-h-[44px] min-w-[44px] px-3 py-2 text-[12px] font-medium bg-[#534AB7] text-white rounded-lg hover:bg-[#3f37a0] transition-colors"
        >
          + Upload
        </button>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Uploading a textbook PDF anchors all generated content to the actual NCERT text.
        Notes and questions will be grounded in the book text.
        Without a PDF, content is generated from AI memory (less accurate).
      </p>

      {books.length === 0 ? (
        <p className="text-[12px] text-gray-400 text-center py-4">No textbooks uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left border-b border-gray-100 dark:border-gray-800">
                <th className="pb-2 pr-3 font-medium text-gray-500">Board</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Gr.</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Subject</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Lang</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Status</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Pages</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Chapters</th>
                <th className="pb-2 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map(b => (
                <tr key={b.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 uppercase">{b.board}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{b.grade}</td>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{b.subjectName}</td>
                  <td className="py-2 pr-3 text-gray-500">{b.language}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1">
                      {parseStatusIcon(b.parseStatus)}
                      <span className={
                        b.parseStatus === 'parsed' ? 'text-[#1D9E75]' :
                        b.parseStatus === 'failed' ? 'text-[#E24B4A]' :
                        b.parseStatus === 'parsing' ? 'text-[#534AB7]' :
                        'text-gray-400'
                      }>
                        {b.parseStatus === 'parsing' ? 'Parsing...' :
                         b.parseStatus === 'parsed' ? 'Parsed' :
                         b.parseStatus === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </span>
                    {b.parseStatus === 'failed' && b.parseError && (
                      <p className="text-[10px] text-[#E24B4A] mt-0.5 max-w-[200px] truncate" title={b.parseError}>
                        {b.parseError}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{b.pageCount ?? '--'}</td>
                  <td className="py-2 pr-3 text-gray-500">
                    {b.parseStatus === 'parsed' ? `${b.chapterCount} ch / ${b.topicCount} top` : '--'}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {b.parseStatus === 'failed' && (
                        <button
                          onClick={() => handleRetry(b.id)}
                          className="min-h-[32px] px-2 text-[10px] text-[#534AB7] border border-[#534AB7] rounded hover:bg-[#EEEDFE] transition-colors"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="min-h-[32px] px-2 text-[10px] text-[#E24B4A] border border-[#E24B4A] rounded hover:bg-[#FCEBEB] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Upload Textbook PDF
            </h3>
            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Subject *
                </label>
                <select
                  required
                  value={form.subjectId}
                  onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                  className="w-full min-h-[44px] border border-gray-300 dark:border-gray-700 rounded-lg px-3 text-[12px] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.boardSlug.toUpperCase()} Gr.{s.grade} -- {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Language
                </label>
                <select
                  value={form.language}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full min-h-[44px] border border-gray-300 dark:border-gray-700 rounded-lg px-3 text-[12px] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Edition (optional, e.g. 2024-25)
                </label>
                <input
                  type="text"
                  value={form.edition}
                  onChange={e => setForm(f => ({ ...f, edition: e.target.value }))}
                  placeholder="2024-25"
                  className="w-full min-h-[44px] border border-gray-300 dark:border-gray-700 rounded-lg px-3 text-[12px] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  PDF File * (max 50MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  ref={fileRef}
                  required
                  className="w-full min-h-[44px] text-[12px] text-gray-700 dark:text-gray-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-[11px] file:bg-[#EEEDFE] file:text-[#534AB7] file:cursor-pointer"
                />
              </div>

              {uploadError && (
                <p className="text-[11px] text-[#E24B4A] bg-[#FCEBEB] rounded px-3 py-2">{uploadError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={uploading || isPending}
                  className="flex-1 min-h-[44px] bg-[#534AB7] text-white text-[12px] font-medium rounded-lg hover:bg-[#3f37a0] disabled:opacity-50 transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload & Parse'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setUploadError(null) }}
                  className="flex-1 min-h-[44px] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[12px] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
