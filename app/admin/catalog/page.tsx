"use client";
import React, { useState } from 'react';

export default function CatalogAdminPage() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState({ board: '', grade: '', subject: '', language: 'en' });
  const [parsing, setParsing] = useState(false);
  const [seedSummary, setSeedSummary] = useState<any | null>(null);

  async function upload() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/catalog/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: 'upload_failed', message: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function parsePdf() {
    if (!file) { setResult({ error: 'no_file', message: 'Select a PDF first' }); return; }
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('pdf', file);
      const res = await fetch('/api/admin/catalog/parse-pdf', { method: 'POST', body: form });
      const data = await res.json();
      setResult(data);
      if (Array.isArray(data.items)) {
        setText(data.items.map((i: any) => JSON.stringify(i)).join('\n'));
      }
    } catch (e: any) {
      setResult({ error: 'parse_failed', message: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Catalog Seeding</h1>
      <p className="text-sm text-muted-foreground mb-4">Paste JSON array or JSONL of catalog entries. Each entry requires contentId, title, subject, board, grade, language.</p>
      <div className="mb-4 border rounded p-3">
        <h2 className="text-sm font-semibold mb-2">Parse Chapter PDF (metadata only)</h2>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="mt-2 flex gap-2">
          <button className="px-4 py-2 bg-purple-600 text-white rounded" onClick={parsePdf} disabled={loading || !file}>{loading ? 'Parsing...' : 'Parse PDF'}</button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded"
            onClick={async () => {
              if (!text.trim()) {
                alert('No parsed items to seed');
                return;
              }
              try {
                const res = await fetch('/api/admin/catalog/seed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jsonl: text })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || 'Seeding failed');
                alert(`Seeded ${data?.inserted || data?.count || 'items'} from parsed content`);
                setSeedSummary(data);
              } catch (err: any) {
                alert(err?.message || 'Failed to seed');
              }
            }}
            disabled={loading}
          >Seed from parsed</button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">We only extract headings to build metadata (titles, tags). No textbook content is stored.</p>
      </div>

      {/* Image Parsing Section */}
      <section className="space-y-3">
        <h2 className="text-xl font-medium">Parse Image (OCR) to Metadata</h2>
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.append("file", f);
            fd.append("defaults", JSON.stringify(defaults));
            setParsing(true);
            try {
              const res = await fetch("/api/admin/catalog/parse-image", { method: "POST", body: fd });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error || "Failed to parse image");
              const items = (data.items || []).map((it: any) => ({
                title: it.title,
                board: it.board || defaults.board,
                grade: it.grade || defaults.grade,
                subject: it.subject || defaults.subject,
                language: it.language || defaults.language || "en",
                type: it.type || "chapter",
                order: it.order || 0,
                source: it.source || "image-ocr",
              }));
              const jsonl = items.map((x: any) => JSON.stringify(x)).join("\n");
              setText(jsonl);
              setResult({ parsed: items.length });
            } catch (err: any) {
              alert(err?.message || "Image parsing failed");
            } finally {
              setParsing(false);
            }
          }} />
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <input className="input input-bordered" placeholder="Board" value={defaults.board} onChange={(e) => setDefaults({ ...defaults, board: e.target.value })} />
            <input className="input input-bordered" placeholder="Grade" value={defaults.grade} onChange={(e) => setDefaults({ ...defaults, grade: e.target.value })} />
            <input className="input input-bordered" placeholder="Subject" value={defaults.subject} onChange={(e) => setDefaults({ ...defaults, subject: e.target.value })} />
            <input className="input input-bordered" placeholder="Language (en/hi)" value={defaults.language} onChange={(e) => setDefaults({ ...defaults, language: e.target.value })} />
          </div>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded"
            onClick={async () => {
              if (!text.trim()) {
                alert('No parsed items to seed');
                return;
              }
              try {
                const res = await fetch('/api/admin/catalog/seed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jsonl: text })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || 'Seeding failed');
                alert(`Seeded ${data?.inserted || data?.count || 'items'} from image OCR`);
                setSeedSummary(data);
              } catch (err: any) {
                alert(err?.message || 'Failed to seed from image');
              }
            }}
            disabled={parsing}
          >Seed from image</button>
        </div>

      {/* Seeding Summary */}
      {seedSummary && (
        <div className="mt-4 border rounded p-3">
          <h3 className="text-sm font-semibold mb-2">Seeding Summary</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Inserted</td>
                <td className="py-1">{seedSummary.inserted ?? seedSummary.count ?? 0}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Updated</td>
                <td className="py-1">{seedSummary.updated ?? 0}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Skipped/Duplicates</td>
                <td className="py-1">{seedSummary.skipped ?? seedSummary.duplicates ?? 0}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Errors</td>
                <td className="py-1">{seedSummary.errors ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
        <p className="text-sm text-muted">Uses OCR to extract headings from images (no content stored).</p>
      </section>
      <textarea className="w-full h-64 border rounded p-2 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"contentId":"cbse-6-math-ch1-1",...}] or JSONL per line' />
      <div className="mt-3 flex gap-2">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={upload} disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
        <button className="px-4 py-2 border rounded" onClick={() => { setText(''); setResult(null); }}>Clear</button>
      </div>
      {result && (
        <div className="mt-4">
          <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
