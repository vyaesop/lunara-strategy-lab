import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { CoachingIntensity, SessionLengthPreference } from "@lunara/schemas";
import { Button, Card, ErrorNote, Label, PageTitle, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { apiBaseUrl, applyTheme, getTokenSync, isNative, type Theme } from "@/lib/platform";

async function downloadExport() {
  const headers: Record<string, string> = {};
  const token = getTokenSync();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBaseUrl}/api/v1/me/export`, { headers, credentials: "include" });
  if (!res.ok) return alert("Export failed; please try again.");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lunara-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
import { useMe, useUpdatePreferences } from "@/lib/queries";

export function SettingsPage() {
  const me = useMe();
  const update = useUpdatePreferences();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const prefs = me.data?.profile.preferences;
  if (!prefs) return null;

  const setTheme = (t: Theme) => {
    applyTheme(t);
    update.mutate({ theme: t });
  };

  const deleteAccount = async () => {
    if (!confirm("Delete your account and all sessions, notes and progress? This cannot be undone.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api("/api/v1/me", { method: "DELETE" });
      await signOut();
      qc.clear();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err);
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Settings" title="Preferences" />
      <div className="space-y-4">
        <Card title="Appearance">
          <Label>Theme</Label>
          <Segmented value={prefs.theme} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={(v) => setTheme(v as Theme)} />
        </Card>
        <Card title="Coaching">
          <Label>Intensity</Label>
          <Segmented value={prefs.coachingIntensity} options={[["gentle", "Gentle"], ["balanced", "Balanced"], ["demanding", "Demanding"]]} onChange={(v) => update.mutate({ coachingIntensity: v as CoachingIntensity })} />
          <div className="mt-4">
            <Label>Session length</Label>
            <Segmented value={prefs.sessionLength} options={[["short", "Short"], ["standard", "Standard"], ["deep", "Deep"]]} onChange={(v) => update.mutate({ sessionLength: v as SessionLengthPreference })} />
          </div>
        </Card>
        <Card title="Notifications">
          <label className="flex items-center justify-between gap-3 py-1 text-sm">
            <span>Daily briefing reminder {isNative ? "" : "(mobile app)"}</span>
            <input type="checkbox" checked={prefs.notifications.dailyBriefing} onChange={(e) => update.mutate({ notifications: { ...prefs.notifications, dailyBriefing: e.target.checked } })} className="h-4 w-4 accent-[var(--accent)]" />
          </label>
          <label className="flex items-center justify-between gap-3 py-1 text-sm">
            <span>Review reminders</span>
            <input type="checkbox" checked={prefs.notifications.reviewReminders} onChange={(e) => update.mutate({ notifications: { ...prefs.notifications, reviewReminders: e.target.checked } })} className="h-4 w-4 accent-[var(--accent)]" />
          </label>
          <p className="mt-2 text-xs text-text-faint">Preferences are saved now; scheduled reminders ship with the daily-briefing milestone.</p>
        </Card>
        <ErrorNote error={update.error} />
        <Card title="Your data">
          <p className="text-sm text-text-muted">Download everything you own as one JSON file: sessions, notes, documents, trees, decisions and more. AI usage records contain no content and are summarised in the admin view only.</p>
          <a href={`${apiBaseUrl}/api/v1/me/export`} className="mt-3 inline-block" onClick={(e) => { e.preventDefault(); void downloadExport(); }}>
            <Button variant="secondary">Export my data (JSON)</Button>
          </a>
          <p className="mt-2 text-xs text-text-faint">Which providers receive your content is listed in the repository's AI provider notes; only providers marked as approved for private content ever see documents, projects or council briefs.</p>
        </Card>
        <Card title="Account">
          <p className="text-sm text-text-muted">{me.data?.profile.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={async () => { await signOut(); qc.clear(); navigate("/", { replace: true }); }}>
              Sign out
            </Button>
            <Button variant="danger" onClick={deleteAccount} loading={deleting}>
              Delete account and data
            </Button>
          </div>
          <div className="mt-2">
            <ErrorNote error={deleteError} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cx("rounded-md px-3 py-1.5 text-sm", value === v ? "bg-accent-soft text-accent font-medium" : "text-text-muted hover:text-text")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
