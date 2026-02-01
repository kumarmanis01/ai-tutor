"use client";

import React, { useEffect, useState } from "react";
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function AdminContentCentralPage() {
  const [filters, setFilters] = useState({ board: '', class: '', language: '', subject: '', type: 'all' });
  const query = new URLSearchParams(filters as any).toString();
  const { data, error, mutate } = useSWR(`/api/admin/content-central?${query}`, () => fetcher(`/api/admin/content-central?${query}`), { refreshInterval: 0 });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDetail, setPreviewDetail] = useState<any | null>(null);

  const openPreview = async (type: string, id: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewDetail(null);
    setPreviewOpen(true);
    try {
      const res = await fetch(`/api/admin/content-approval/${type}/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load preview: ${res.status}`);
      const d = await res.json();
      setPreviewDetail(d);
    } catch (err: any) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => { mutate(); }, [filters, mutate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Content Central</h1>
          <div className="flex gap-2">
            <select value={filters.type} onChange={(e) => setFilters(f => ({...f, type: e.target.value}))} className="px-3 py-2 border rounded">
              <option value="all">All</option>
              <option value="syllabus">Syllabus</option>
              <option value="chapter">Chapter</option>
              <option value="topic">Topic</option>
              <option value="note">Note</option>
              <option value="test">Test</option>
            </select>
            <input placeholder="Board" value={filters.board} onChange={(e)=>setFilters(f=>({...f, board:e.target.value}))} className="px-3 py-2 border rounded" />
            <input placeholder="Class" value={filters.class} onChange={(e)=>setFilters(f=>({...f, class:e.target.value}))} className="px-3 py-2 border rounded" />
            <input placeholder="Language" value={filters.language} onChange={(e)=>setFilters(f=>({...f, language:e.target.value}))} className="px-3 py-2 border rounded" />
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded">Failed to load content</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded p-4">
              <h2 className="font-semibold mb-3">Items</h2>
              {!data && <div>Loading...</div>}
              {data?.items?.length === 0 && <div className="text-sm text-gray-500">No items</div>}
              {data?.items?.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => openPreview(item.type, item.id)}
                  className="w-full text-left p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.type} • {item.metadata?.subjectName || item.metadata?.subject || item.details?.subject}</div>
                    </div>
                    <div className="text-sm text-gray-400">{new Date(item.createdAt || item.metadata?.createdAt || item.updatedAt || Date.now()).toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-white dark:bg-gray-800 rounded p-4">
              <h2 className="font-semibold mb-3">Summary</h2>
              {!data && <div>Loading...</div>}
              {data?.summary && (
                <ul className="text-sm text-gray-700">
                  <li>Total: {data.summary.total}</li>
                  <li>Syllabus: {data.summary.syllabus}</li>
                  <li>Chapters: {data.summary.chapters}</li>
                  <li>Topics: {data.summary.topics}</li>
                  <li>Notes: {data.summary.notes}</li>
                  <li>Tests: {data.summary.tests}</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPreviewOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold">Preview</h3>
              <button className="p-2" onClick={() => setPreviewOpen(false)}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading && <div className="text-center py-8">Loading preview...</div>}
              {previewError && <div className="bg-red-50 text-red-700 p-4 rounded">{previewError}</div>}
              {!previewLoading && !previewError && previewDetail && (
                <div>
                  <div className="mb-4">
                    <div className="text-lg font-semibold">{previewDetail.title || previewDetail.label || 'Preview'}</div>
                    <div className="text-sm text-gray-500">
                      {previewDetail.type || ''}
                      {(previewDetail.metadata?.subjectName || previewDetail.metadata?.subject || previewDetail.details?.subject) &&
                        ` • ${previewDetail.metadata?.subjectName || previewDetail.metadata?.subject || previewDetail.details?.subject}`}
                    </div>
                    {previewDetail.metadata?.status && (
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${previewDetail.metadata.status === 'approved' ? 'bg-green-100 text-green-800' : previewDetail.metadata.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                        {previewDetail.metadata.status}
                      </span>
                    )}
                  </div>

                  {/* Metadata info for all types */}
                  {previewDetail.metadata && (
                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {previewDetail.metadata.chapterName && <div><span className="font-medium">Chapter:</span> {previewDetail.metadata.chapterName}</div>}
                      {previewDetail.metadata.topicName && <div><span className="font-medium">Topic:</span> {previewDetail.metadata.topicName}</div>}
                      {previewDetail.metadata.order != null && <div><span className="font-medium">Order:</span> {previewDetail.metadata.order}</div>}
                      {previewDetail.metadata.language && <div><span className="font-medium">Language:</span> {previewDetail.metadata.language}</div>}
                      {previewDetail.metadata.difficulty && <div><span className="font-medium">Difficulty:</span> {previewDetail.metadata.difficulty}</div>}
                      {previewDetail.metadata.version != null && <div><span className="font-medium">Version:</span> {previewDetail.metadata.version}</div>}
                    </div>
                  )}

                  {/* Topic: show notes and tests lists */}
                  {previewDetail.type === 'topic' && previewDetail.metadata && (
                    <div className="space-y-4">
                      <div className="flex gap-4 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded">
                          <span className="font-semibold text-blue-700 dark:text-blue-300">{previewDetail.metadata.noteCount ?? 0}</span> Notes
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded">
                          <span className="font-semibold text-purple-700 dark:text-purple-300">{previewDetail.metadata.testCount ?? 0}</span> Tests
                        </div>
                      </div>
                      {previewDetail.metadata.notes?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Notes</h4>
                          <ul className="space-y-1">
                            {previewDetail.metadata.notes.map((n: any) => (
                              <li key={n.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex justify-between">
                                <span>{n.language} (v{n.version})</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${n.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{n.status}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {previewDetail.metadata.tests?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Tests</h4>
                          <ul className="space-y-1">
                            {previewDetail.metadata.tests.map((t: any) => (
                              <li key={t.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex justify-between">
                                <span>{t.difficulty} • {t.language}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${t.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chapter: show topics list */}
                  {previewDetail.type === 'chapter' && previewDetail.topics?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Topics ({previewDetail.metadata?.topicCount ?? previewDetail.topics.length})</h4>
                      <ul className="space-y-1">
                        {previewDetail.topics.map((t: any) => (
                          <li key={t.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            {t.order}. {t.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Syllabus: show chapters list */}
                  {previewDetail.type === 'syllabus' && previewDetail.chapters?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Chapters ({previewDetail.metadata?.chapterCount ?? previewDetail.chapters.length})</h4>
                      <ul className="space-y-1">
                        {previewDetail.chapters.map((c: any) => (
                          <li key={c.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            {c.order}. {c.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Note: render contentJson sections */}
                  {previewDetail.contentJson ? (
                    typeof previewDetail.contentJson === 'string' ? (
                      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewDetail.contentJson }} />
                    ) : previewDetail.contentJson.sections ? (
                      <div className="space-y-4">
                        {previewDetail.contentJson.sections.map((s: any, i: number) => (
                          <div key={i}>
                            <h4 className="font-semibold text-base mb-1">{s.heading}</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{s.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="text-sm bg-white dark:bg-gray-900 p-4 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(previewDetail.contentJson, null, 2)}</pre>
                    )
                  ) : previewDetail.content ? (
                    <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{previewDetail.content}</div>
                  ) : null}

                  {/* Tests/questions */}
                  {previewDetail.questions && Array.isArray(previewDetail.questions) && (
                    <div className="space-y-4 mt-6">
                      {previewDetail.questions.map((q: any, idx: number) => (
                        <div key={q.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-semibold text-sm">{idx+1}</span>
                            <div className="flex-1">
                              <p className="font-medium mb-2">{q.question}</p>
                              {q.options && typeof q.options === 'object' && !Array.isArray(q.options) ? (
                                Object.entries(q.options).map(([key, val]: [string, any]) => (
                                  <div key={key} className={`p-2 rounded border mb-1 ${q.answer?.correct === key ? 'bg-green-50 border-green-300' : 'bg-white dark:bg-gray-900 border-gray-200'}`}>
                                    <span className="font-medium mr-2">{key}.</span>{String(val)}
                                  </div>
                                ))
                              ) : q.options && Array.isArray(q.options) ? (
                                q.options.map((opt: string, i: number) => (
                                  <div key={i} className={`p-2 rounded border mb-1 ${Array.isArray(q.answer) ? (q.answer.includes(opt) ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200') : (q.answer === opt ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200')}`}>
                                    <span className="font-medium mr-2">{String.fromCharCode(65+i)}.</span>{opt}
                                  </div>
                                ))
                              ) : null}
                              {q.answer?.explanation && (
                                <div className="mt-2 text-sm text-gray-500 italic">{q.answer.explanation}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
