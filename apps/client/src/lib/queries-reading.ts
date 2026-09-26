import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  AskDocumentResponse,
  ConceptResponse,
  DocumentListResponse,
  DocumentResponse,
  DocumentTextResponse,
  GenerateQuestionsResponse,
  KnowledgeGraphResponse,
  KnowledgeRelation,
  NoteListResponse,
  NoteResponse,
  ReadingProject,
  ReviewItemResponse,
  ReviewListResponse,
  ReviewQueueResponse,
  type CreateDocumentRequest,
  type CreateNoteRequest,
  type CreateReviewItemRequest,
  type KnowledgeConcept,
  type RelationKind,
  type ReviewRating,
} from "@lunara/schemas";
import { api, ApiError } from "./api";
import { apiBaseUrl, getTokenSync } from "./platform";
import { keys as baseKeys } from "./queries";

export const readingKeys = {
  documents: ["documents"] as const,
  document: (id: string) => ["document", id] as const,
  documentText: (id: string, offset: number) => ["document-text", id, offset] as const,
  notes: (documentId?: string) => ["notes", documentId ?? "all"] as const,
  graph: ["knowledge-graph"] as const,
  reviewQueue: ["review-queue"] as const,
  reviewItems: ["review-items"] as const,
};

export function useDocuments() {
  return useQuery({ queryKey: readingKeys.documents, queryFn: () => api("/api/v1/reading/documents", { schema: DocumentListResponse }) });
}
export function useDocument(id: string) {
  return useQuery({ queryKey: readingKeys.document(id), queryFn: () => api(`/api/v1/reading/documents/${id}`, { schema: DocumentResponse }) });
}
export function useDocumentText(id: string, offset: number, limit = 20_000) {
  return useQuery({
    queryKey: readingKeys.documentText(id, offset),
    queryFn: () => api(`/api/v1/reading/documents/${id}/text?offset=${offset}&limit=${limit}`, { schema: DocumentTextResponse }),
    placeholderData: (prev) => prev,
  });
}
export function useNotes(documentId?: string) {
  return useQuery({ queryKey: readingKeys.notes(documentId), queryFn: () => api(`/api/v1/reading/notes${documentId ? `?documentId=${documentId}` : ""}`, { schema: NoteListResponse }) });
}

export function useReadingActions(documentId?: string) {
  const qc = useQueryClient();
  const refreshDocs = () => void qc.invalidateQueries({ queryKey: readingKeys.documents });
  const refreshNotes = () => {
    void qc.invalidateQueries({ queryKey: readingKeys.notes(documentId) });
    void qc.invalidateQueries({ queryKey: readingKeys.notes() });
  };
  return {
    createDocument: useMutation({ mutationFn: (body: CreateDocumentRequest) => api("/api/v1/reading/documents", { method: "POST", body, schema: DocumentResponse }), onSuccess: refreshDocs }),
    uploadPdf: useMutation({
      mutationFn: async ({ file, title, projectId }: { file: File; title?: string; projectId?: string | null }) => {
        const form = new FormData();
        form.append("file", file);
        if (title) form.append("title", title);
        if (projectId) form.append("projectId", projectId);
        const headers: Record<string, string> = {};
        const token = getTokenSync();
        if (token) headers.authorization = `Bearer ${token}`;
        const res = await fetch(`${apiBaseUrl}/api/v1/reading/documents/upload`, { method: "POST", body: form, headers, credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new ApiError(data?.error?.code ?? "internal", data?.error?.message ?? `Upload failed (${res.status})`, res.status);
        return DocumentResponse.parse(data);
      },
      onSuccess: refreshDocs,
    }),
    updateDocument: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api(`/api/v1/reading/documents/${id}`, { method: "PATCH", body: patch, schema: DocumentResponse }),
      onSuccess: (data) => {
        qc.setQueryData(readingKeys.document(data.document.id), data);
        refreshDocs();
      },
    }),
    deleteDocument: useMutation({ mutationFn: (id: string) => api(`/api/v1/reading/documents/${id}`, { method: "DELETE" }), onSuccess: refreshDocs }),
    createProject: useMutation({ mutationFn: (body: { title: string; goal?: string }) => api("/api/v1/reading/projects", { method: "POST", body, schema: z.object({ project: ReadingProject }) }), onSuccess: refreshDocs }),
    createNote: useMutation({ mutationFn: (body: CreateNoteRequest) => api("/api/v1/reading/notes", { method: "POST", body, schema: NoteResponse }), onSuccess: refreshNotes }),
    deleteNote: useMutation({ mutationFn: (id: string) => api(`/api/v1/reading/notes/${id}`, { method: "DELETE" }), onSuccess: refreshNotes }),
    ask: useMutation({ mutationFn: (body: { question: string; range: { start: number; end: number } | null }) => api(`/api/v1/reading/documents/${documentId}/ask`, { method: "POST", body, schema: AskDocumentResponse }) }),
    generate: useMutation({ mutationFn: (range: { start: number; end: number } | null) => api(`/api/v1/reading/documents/${documentId}/generate`, { method: "POST", body: { range }, schema: GenerateQuestionsResponse }) }),
  };
}

export function useKnowledgeGraph() {
  return useQuery({ queryKey: readingKeys.graph, queryFn: () => api("/api/v1/knowledge/graph", { schema: KnowledgeGraphResponse }) });
}
export function useKnowledgeActions() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: readingKeys.graph });
  return {
    createConcept: useMutation({ mutationFn: (body: { name: string; kind: KnowledgeConcept["kind"]; summary?: string; documentId?: string | null; origin?: "user" | "ai_suggested" }) => api("/api/v1/knowledge/concepts", { method: "POST", body, schema: ConceptResponse }), onSuccess: refresh }),
    updateConcept: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api(`/api/v1/knowledge/concepts/${id}`, { method: "PATCH", body: patch, schema: ConceptResponse }), onSuccess: refresh }),
    mergeConcept: useMutation({ mutationFn: ({ id, intoId }: { id: string; intoId: string }) => api(`/api/v1/knowledge/concepts/${id}/merge`, { method: "POST", body: { intoId }, schema: ConceptResponse }), onSuccess: refresh }),
    deleteConcept: useMutation({ mutationFn: (id: string) => api(`/api/v1/knowledge/concepts/${id}`, { method: "DELETE" }), onSuccess: refresh }),
    createRelation: useMutation({ mutationFn: (body: { fromId: string; toId: string; kind: RelationKind; note?: string }) => api("/api/v1/knowledge/relations", { method: "POST", body, schema: z.object({ relation: KnowledgeRelation }) }), onSuccess: refresh }),
    deleteRelation: useMutation({ mutationFn: (id: string) => api(`/api/v1/knowledge/relations/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  };
}

export function useReviewQueue() {
  return useQuery({ queryKey: readingKeys.reviewQueue, queryFn: () => api("/api/v1/review/queue", { schema: ReviewQueueResponse }) });
}
export function useReviewItems() {
  return useQuery({ queryKey: readingKeys.reviewItems, queryFn: () => api("/api/v1/review/items", { schema: ReviewListResponse }) });
}
export function useReviewActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: readingKeys.reviewQueue });
    void qc.invalidateQueries({ queryKey: readingKeys.reviewItems });
    void qc.invalidateQueries({ queryKey: baseKeys.recommendations });
    void qc.invalidateQueries({ queryKey: baseKeys.me });
  };
  return {
    create: useMutation({ mutationFn: (body: CreateReviewItemRequest) => api("/api/v1/review/items", { method: "POST", body, schema: ReviewItemResponse }), onSuccess: refresh }),
    createBatch: useMutation({ mutationFn: (items: CreateReviewItemRequest[]) => api("/api/v1/review/items/batch", { method: "POST", body: { items }, schema: ReviewListResponse }), onSuccess: refresh }),
    grade: useMutation({ mutationFn: ({ id, rating, explanation }: { id: string; rating: ReviewRating; explanation: string | null }) => api(`/api/v1/review/items/${id}/grade`, { method: "POST", body: { rating, explanation }, schema: ReviewItemResponse }), onSuccess: refresh }),
    suspend: useMutation({ mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) => api(`/api/v1/review/items/${id}/suspend`, { method: "POST", body: { suspended }, schema: ReviewItemResponse }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => api(`/api/v1/review/items/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  };
}
