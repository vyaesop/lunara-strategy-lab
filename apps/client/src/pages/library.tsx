import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpen, FileText, Link2, Mic, MicOff, Trash2, Upload } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { GeneratedQuestions, ReadingDocument } from "@lunara/schemas";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea, cx } from "@/components/ui";
import { dictationSupported, startDictation, type Dictation } from "@/lib/dictation";
import { useDocument, useDocumentText, useDocuments, useKnowledgeActions, useNotes, useReadingActions, useReviewActions } from "@/lib/queries-reading";

const KIND_ICON: Record<ReadingDocument["kind"], typeof FileText> = { note: FileText, text: FileText, markdown: FileText, pdf: BookOpen, excerpt: FileText, link: Link2 };
const PAGE = 20_000;

export function LibraryPage() {
  const docs = useDocuments();
  const actions = useReadingActions();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"text" | "pdf" | "link">("text");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "pdf") {
      if (!file) return;
      const r = await actions.uploadPdf.mutateAsync({ file, title: title || undefined });
      navigate(`/app/library/${r.document.id}`);
      return;
    }
    const r = await actions.createDocument.mutateAsync({
      kind: mode === "link" ? "link" : /^#|\n#|\*\*|\n- /.test(content) ? "markdown" : "text",
      title,
      author,
      content,
      sourceUrl: mode === "link" ? url : null,
      projectId: null,
      tags: [],
    });
    navigate(`/app/library/${r.document.id}`);
  };

  return (
    <div>
      <PageTitle eyebrow="Library" title="Reading" subtitle="Your notes, excerpts and documents. Text stays private; AI sees only the passage you point it at, and only on providers you approved." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Add material">
          <div className="mb-3 flex gap-1">
            {(["text", "pdf", "link"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cx("rounded-lg px-3 py-1.5 text-sm", mode === m ? "bg-accent-soft text-accent font-medium" : "text-text-muted")}>
                {m === "text" ? "Text / notes" : m === "pdf" ? "PDF" : "Link + excerpt"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Title{mode === "pdf" ? " (optional)" : ""}</Label>
              <Input required={mode !== "pdf"} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={280} />
            </div>
            {mode === "pdf" ? (
              <div>
                <Label hint="Text is extracted and stored; the file itself is not kept. Scanned PDFs without a text layer are not supported yet.">PDF file</Label>
                <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </div>
            ) : (
              <>
                {mode === "link" ? (
                  <div>
                    <Label hint="The page is not fetched; paste the excerpt you are allowed to use">URL</Label>
                    <Input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
                  </div>
                ) : null}
                <div>
                  <Label>Author (optional)</Label>
                  <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <Label hint="Plain text or Markdown">{mode === "link" ? "Excerpt" : "Content"}</Label>
                  <Textarea rows={8} required value={content} onChange={(e) => setContent(e.target.value)} />
                </div>
              </>
            )}
            <ErrorNote error={actions.createDocument.error ?? actions.uploadPdf.error} />
            <Button type="submit" loading={actions.createDocument.isPending || actions.uploadPdf.isPending}>
              <Upload className="h-4 w-4" /> Add to library
            </Button>
          </form>
        </Card>
        <Card className="lg:col-span-2" title="Documents">
          {docs.isPending ? (
            <Spinner />
          ) : docs.data && docs.data.documents.length ? (
            <ul className="divide-y divide-border">
              {docs.data.documents.map((d) => {
                const Icon = KIND_ICON[d.kind];
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <Link to={`/app/library/${d.id}`} className="min-w-0 flex-1 hover:text-accent">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4 text-accent" /> <span className="truncate">{d.title}</span>
                      </div>
                      <div className="text-xs text-text-faint">
                        {d.kind}{d.author ? ` · ${d.author}` : ""} · {d.pageCount ? `${d.pageCount} pages` : `${Math.round(d.length / 1000)}k chars`} · {Math.round(d.progress * 100)}% read{d.aiAllowed ? "" : " · AI off"}
                      </div>
                    </Link>
                    <button aria-label="Delete document" className="text-text-faint hover:text-danger" onClick={() => confirm(`Delete "${d.title}" and its notes?`) && actions.deleteDocument.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nothing here yet" body="Paste notes, a chapter, or upload a PDF you are allowed to use." />
          )}
        </Card>
      </div>
    </div>
  );
}

export function ReaderPage() {
  const { documentId = "" } = useParams();
  const doc = useDocument(documentId);
  const [offset, setOffset] = useState(0);
  const text = useDocumentText(documentId, offset, PAGE);
  const notes = useNotes(documentId);
  const actions = useReadingActions(documentId);
  const knowledge = useKnowledgeActions();
  const review = useReviewActions();
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; passage: { start: number; end: number } } | null>(null);
  const [generated, setGenerated] = useState<GeneratedQuestions | null>(null);
  const [noteText, setNoteText] = useState("");
  const [dictating, setDictating] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const dictation = useRef<Dictation | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => dictation.current?.stop(), []);

  if (doc.isPending || text.isPending) return <Spinner />;
  if (doc.isError) return <ErrorNote error={doc.error} />;
  const d = doc.data.document;
  const t = text.data!;
  const pageOf = (off: number) => (t.pageStarts.length ? t.pageStarts.filter((p) => p <= off).length : null);

  const captureSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current || !textRef.current.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(textRef.current);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = offset + pre.toString().length;
    const chosen = sel.toString();
    setSelection({ start, end: start + chosen.length, text: chosen });
  };

  const saveExcerpt = () => {
    if (!selection) return;
    const page = pageOf(selection.start);
    actions.createNote.mutate({ documentId, kind: "excerpt", content: selection.text.slice(0, 20_000), range: { start: selection.start, end: selection.end }, locator: page ? `p. ${page}` : null, origin: "typed" });
  };

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const r = await actions.ask.mutateAsync({ question, range: selection ? { start: selection.start, end: selection.end } : null });
    setAnswer(r);
  };

  const toggleDictation = () => {
    if (dictating) {
      dictation.current?.stop();
      return;
    }
    setDictError(null);
    const base = noteText;
    dictation.current = startDictation({
      onText: (finalText, interim) => setNoteText(`${base}${base && finalText ? " " : ""}${finalText}${interim ? ` ${interim}` : ""}`),
      onError: (m) => setDictError(m),
      onEnd: () => setDictating(false),
    });
    setDictating(dictation.current !== null);
    if (!dictation.current) setDictError("Dictation is not available in this browser; type your note instead.");
  };

  const saveGenerated = async () => {
    if (!generated) return;
    await review.createBatch.mutateAsync(
      generated.comprehension.map((q) => ({ kind: "concept" as const, prompt: q.prompt, answer: q.answer, objective: `From "${d.title}"`, source: { type: "document" as const, refId: d.id, label: d.title } })),
    );
    for (const c of generated.concepts) await knowledge.createConcept.mutateAsync({ name: c.name, kind: c.kind, summary: c.summary, documentId: d.id, origin: "ai_suggested" });
    setGenerated(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link to="/app/library" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">
              Library
            </Link>
            <h1 className="text-2xl">{d.title}</h1>
            <div className="text-xs text-text-faint">{d.author}{d.pageCount ? ` · ${d.pageCount} pages` : ""}{d.sourceUrl ? ` · ${d.sourceUrl}` : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-text-muted">
              <input type="checkbox" checked={d.aiAllowed} onChange={(e) => actions.updateDocument.mutate({ id: d.id, patch: { aiAllowed: e.target.checked } })} className="accent-[var(--accent)]" /> AI allowed
            </label>
            <Badge>{Math.round(d.progress * 100)}% read</Badge>
          </div>
        </div>
        <Card className="p-0">
          <div ref={textRef} data-lenis-prevent data-testid="reader-text" onMouseUp={captureSelection} onTouchEnd={captureSelection} className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap p-5 font-serif text-[15px] leading-7">
            {t.text}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3 text-xs text-text-muted">
            <div>
              {t.total > 0 ? `${Math.round(((offset + t.text.length) / t.total) * 100)}% of text` : "empty"}{pageOf(offset) ? ` · page ${pageOf(offset)}` : ""}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={offset + PAGE >= t.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
              <Button size="sm" variant="secondary" onClick={() => actions.updateDocument.mutate({ id: d.id, patch: { progress: Math.min(1, (offset + t.text.length) / Math.max(1, t.total)) } })}>Mark progress here</Button>
            </div>
          </div>
        </Card>
        {selection ? (
          <Card className="mt-3" title="Selection">
            <p className="line-clamp-3 text-sm text-text-muted">{selection.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={saveExcerpt} loading={actions.createNote.isPending}>Save excerpt</Button>
              <Button size="sm" variant="secondary" disabled={!d.aiAllowed} onClick={async () => setGenerated((await actions.generate.mutateAsync({ start: selection.start, end: selection.end })).generated)} loading={actions.generate.isPending}>Generate questions</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>Clear</Button>
            </div>
            <ErrorNote error={actions.generate.error} />
          </Card>
        ) : null}
        {generated ? (
          <Card className="mt-3" title="Generated from the passage">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Comprehension</div>
            <ul className="mt-1 list-disc pl-5 text-sm">{generated.comprehension.map((q) => <li key={q.prompt}><span className="font-medium">{q.prompt}</span> <span className="text-text-muted">— {q.answer}</span></li>)}</ul>
            {generated.application.length ? (
              <>
                <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Application exercises</div>
                <ul className="mt-1 list-disc pl-5 text-sm">{generated.application.map((q) => <li key={q.prompt}>{q.prompt} <span className="text-text-faint">({q.mode.replace(/_/g, " ")})</span></li>)}</ul>
              </>
            ) : null}
            {generated.concepts.length ? (
              <>
                <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Concepts (saved as suggestions until you confirm them)</div>
                <div className="mt-1 flex flex-wrap gap-1">{generated.concepts.map((c) => <Badge key={c.name} tone="info">{c.name}</Badge>)}</div>
              </>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={saveGenerated} loading={review.createBatch.isPending || knowledge.createConcept.isPending}>Save questions to review and concepts to graph</Button>
              <Button size="sm" variant="ghost" onClick={() => setGenerated(null)}>Discard</Button>
            </div>
          </Card>
        ) : null}
        <Card className="mt-3" title="Ask about this document">
          <form onSubmit={ask} className="flex gap-2">
            <Input required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={selection ? "Ask about the selection" : "Ask; the best-matching passage is used"} disabled={!d.aiAllowed} />
            <Button type="submit" disabled={!d.aiAllowed} loading={actions.ask.isPending}>Ask</Button>
          </form>
          <ErrorNote error={actions.ask.error} />
          {answer ? (
            <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">
              <p className="whitespace-pre-wrap">{answer.answer}</p>
              <div className="mt-1 text-xs text-text-faint">Grounded in characters {answer.passage.start}–{answer.passage.end}{pageOf(answer.passage.start) ? ` (around page ${pageOf(answer.passage.start)})` : ""}. Only that passage was sent.</div>
            </div>
          ) : null}
        </Card>
      </div>

      <aside className="space-y-4">
        <Card title="New note">
          <Textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Reflection, question, or a note in your own words" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => { if (noteText.trim()) { actions.createNote.mutate({ documentId, kind: "reflection", content: noteText.trim(), origin: dictating ? "dictated" : "typed" }); setNoteText(""); } }} loading={actions.createNote.isPending}>Save note</Button>
            <Button size="sm" variant={dictating ? "danger" : "secondary"} onClick={toggleDictation} title={dictationSupported() ? "Dictate with the browser's speech recognition" : "Dictation not supported here"}>
              {dictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {dictating ? "Stop" : "Dictate"}
            </Button>
          </div>
          {dictError ? <p className="mt-1 text-xs text-warning">{dictError}</p> : null}
          <ErrorNote error={actions.createNote.error} />
        </Card>
        <Card title="Notes and excerpts">
          {notes.data && notes.data.notes.length ? (
            <ul className="space-y-2">
              {notes.data.notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-border p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={n.kind === "excerpt" ? "info" : "neutral"}>{n.kind}</Badge>
                      {n.locator ? <Badge>{n.locator}</Badge> : null}
                      {n.origin === "dictated" ? <Badge>dictated</Badge> : null}
                    </div>
                    <button aria-label="Delete note" className="text-text-faint hover:text-danger" onClick={() => actions.deleteNote.mutate(n.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className={cx("mt-1 whitespace-pre-wrap", n.kind === "excerpt" && "font-serif italic")}>{n.content}</p>
                  {n.range ? (
                    <button className="mt-1 text-xs text-accent" onClick={() => setOffset(Math.floor(n.range!.start / PAGE) * PAGE)}>
                      Go to text
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No notes yet" body="Select text to save an excerpt, or write a reflection." />
          )}
        </Card>
      </aside>
    </div>
  );
}
