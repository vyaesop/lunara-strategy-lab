import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import { Button, ErrorNote, Input, Label } from "@/components/ui";

function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="bg-grid flex min-h-full items-center justify-center px-4 py-12">
      <div className="panel w-full max-w-md p-8">
        <Link to="/" className="text-[11px] uppercase tracking-[0.2em] text-text-faint">
          Lunara Strategy Lab
        </Link>
        <h1 className="mt-3 text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-sm text-text-muted">{footer}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) return setError(r.error.message ?? "Sign in failed");
    qc.clear();
    navigate("/app", { replace: true });
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to continue your training." footer={<>New here? <Link className="text-accent" to="/signup">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthFrame>
  );
}

export function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (r.error) return setError(r.error.message ?? "Sign up failed");
    qc.clear();
    navigate("/app/onboarding", { replace: true });
  };

  return (
    <AuthFrame title="Create your account" subtitle="A few minutes a day of deliberate reasoning practice." footer={<>Already have an account? <Link className="text-accent" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label hint="At least 8 characters">Password</Label>
          <Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthFrame>
  );
}
