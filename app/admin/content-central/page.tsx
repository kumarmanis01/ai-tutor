"use client";

import React, { useEffect, useState } from "react";
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function AdminContentCentralPage() {
  const [filters, setFilters] = useState({ board: '', class: '', language: '', subject: '', type: 'all' });
  const query = new URLSearchParams(filters as any).toString();
  const { data, error, mutate } = useSWR(`/api/admin/content-central?${query}`, () => fetcher(`/api/admin/content-central?${query}`), { refreshInterval: 0 });

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
                <div key={item.id} className="p-3 border-b last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.type} • {item.metadata?.subjectName || item.details?.subject}</div>
                    </div>
                    <div className="text-sm text-gray-400">{new Date(item.createdAt || item.metadata?.createdAt || item.updatedAt || Date.now()).toLocaleString()}</div>
                  </div>
                </div>
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
    </div>
  );
}
