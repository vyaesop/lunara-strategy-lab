import { useState, type FormEvent } from "react";
import { ArrowRight, Ship } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { GAME_MONTHS } from "@lunara/schemas";
import { RULES } from "@lunara/core";
import { ScoreBar } from "@/components/assessment";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea } from "@/components/ui";
import { useGame, useGameActions, useGames } from "@/lib/queries-game";

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function GamesPage() {
  const games = useGames();
  const actions = useGameActions();
  const navigate = useNavigate();
  return (
    <div>
      <PageTitle eyebrow="Management game" title="Meridian Trading Company" subtitle="Twelve months. Buy stock, set prices, watch a rival, survive storms. Rules are deterministic and documented; luck is seeded and recorded." action={<Button onClick={async () => navigate(`/app/game/${(await actions.create.mutateAsync()).session.id}`)} loading={actions.create.isPending}><Ship className="h-4 w-4" /> New year</Button>} />
      <Card title="Your runs">
        {games.isPending ? <Spinner /> : games.data && games.data.sessions.length ? (
          <ul className="divide-y divide-border text-sm">
            {games.data.sessions.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                <Link to={`/app/game/${g.id}`} className="hover:text-accent">Started {new Date(g.startedAt).toLocaleDateString()} · month {Math.min(g.month, GAME_MONTHS)} · cash {money(g.cash)}</Link>
                <span className="flex items-center gap-2">{g.finalValue !== null ? <Badge tone="success">value {money(g.finalValue)}</Badge> : null}<Badge tone={g.status === "active" ? "accent" : "neutral"}>{g.status}</Badge></span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No runs yet" body="Start a year. Your results are compared only with your own earlier runs." />}
      </Card>
      <Card className="mt-4" title="How it works">
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
          <li>Each month you buy units at a market-linked price, set your sell price, spend on marketing, choose crew pay and optionally expand the warehouse.</li>
          <li>Demand falls as your price rises relative to the rival's and rises with reputation, marketing and crew morale. You only see morale as a band.</li>
          <li>Undercut the rival by more than 10% for two months and they cut prices. Stockouts and gouging cost reputation.</li>
          <li>Storms, port fees, festivals and crew unrest happen at random from a recorded seed. Quarterly reports summarise the year.</li>
        </ul>
      </Card>
    </div>
  );
}

export function GamePage() {
  const { gameId = "" } = useParams();
  const q = useGame(gameId);
  const actions = useGameActions(gameId);
  const [f, setF] = useState({ buyUnits: 400, sellPrice: 105, marketing: 0, investWarehouse: false, crewPay: 1, rationale: "" });
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const { session, buyPrice, reports, lastMonth } = q.data;
  const s = session.state;
  const active = session.status === "active";
  const upfront = f.buyUnits * buyPrice + (f.investWarehouse ? RULES.warehouseCost : 0) + f.marketing + (RULES.crewCost[f.crewPay] ?? RULES.crewCost[1]) + RULES.fixedCosts;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    actions.turn.mutate({ ...f, crewPay: f.crewPay as 0 | 1 | 2 });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/app/game" className="text-xs uppercase tracking-[0.18em] text-text-faint hover:text-text">Management game</Link>
          <h1 className="text-2xl">{active ? `Month ${s.month} of ${GAME_MONTHS}` : "Year complete"}</h1>
        </div>
        <div className="flex gap-2"><Badge tone={active ? "accent" : "neutral"}>{session.status}</Badge>{active ? <Button size="sm" variant="ghost" onClick={() => confirm("Abandon this year?") && actions.abandon.mutate()}>Abandon</Button> : null}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {lastMonth ? (
            <Card title={`Month ${lastMonth.month} results`}>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div><span className="text-text-faint">Demand / sold</span><div className="font-mono">{lastMonth.demand} / {lastMonth.sold}{lastMonth.demand > lastMonth.sold ? <Badge tone="warning">stockout</Badge> : null}</div></div>
                <div><span className="text-text-faint">Revenue − costs</span><div className="font-mono">{money(lastMonth.revenue)} − {money(lastMonth.costs)}</div></div>
                <div><span className="text-text-faint">Event</span><div>{lastMonth.event.text}</div></div>
              </div>
            </Card>
          ) : null}
          {active ? (
            <Card title="This month's plan">
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <div><Label hint={`Buy price ${buyPrice} · capacity left ${s.capacity - s.inventory}`}>Buy units</Label><Input type="number" min={0} max={5000} value={f.buyUnits} onChange={(e) => setF({ ...f, buyUnits: Number(e.target.value) })} /></div>
                <div><Label hint={`Market ${s.marketPrice} · rival ${s.rivalPrice}`}>Sell price</Label><Input type="number" min={1} max={500} value={f.sellPrice} onChange={(e) => setF({ ...f, sellPrice: Number(e.target.value) })} /></div>
                <div><Label hint="Boosts demand this month, with diminishing returns">Marketing</Label><Input type="number" min={0} max={50000} step={500} value={f.marketing} onChange={(e) => setF({ ...f, marketing: Number(e.target.value) })} /></div>
                <div>
                  <Label hint="Austerity hurts morale over time; generosity costs cash">Crew pay</Label>
                  <select value={f.crewPay} onChange={(e) => setF({ ...f, crewPay: Number(e.target.value) })} className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"><option value={0}>Austerity ({RULES.crewCost[0].toLocaleString()})</option><option value={1}>Normal ({RULES.crewCost[1].toLocaleString()})</option><option value={2}>Generous ({RULES.crewCost[2].toLocaleString()})</option></select>
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.investWarehouse} onChange={(e) => setF({ ...f, investWarehouse: e.target.checked })} className="accent-[var(--accent)]" /> Expand warehouse (+{RULES.warehouseAdds} capacity, {RULES.warehouseCost.toLocaleString()} one-off)</label>
                <div className="sm:col-span-2"><Label hint="Recorded and used in the debrief">Rationale</Label><Textarea rows={2} value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} maxLength={2000} /></div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <Button type="submit" loading={actions.turn.isPending} disabled={upfront > s.cash}>End month <ArrowRight className="h-4 w-4" /></Button>
                  <span className={upfront > s.cash ? "text-sm text-danger" : "text-sm text-text-faint"}>Upfront cost {money(upfront)} of {money(s.cash)} cash (includes {RULES.fixedCosts.toLocaleString()} fixed costs)</span>
                </div>
                <div className="sm:col-span-2"><ErrorNote error={actions.turn.error} /></div>
              </form>
            </Card>
          ) : (
            <Card title="Debrief">
              {session.evaluation ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="success">Final value {money(session.evaluation.finalValue)}</Badge>
                    <Badge>Profit {money(session.evaluation.profit)}</Badge>
                    <Badge>Margin {Math.round(session.evaluation.avgMargin * 100)}%</Badge>
                    <Badge>{session.evaluation.stockoutMonths} stockout months</Badge>
                    <Badge tone="info">Your rank {session.evaluation.personalRank} of {session.evaluation.personalRuns} own runs</Badge>
                    <Badge tone="accent">Reasoning {Math.round(session.evaluation.overallScore * 100)}</Badge>
                  </div>
                  <ul className="space-y-1">{session.evaluation.criteria.map((c) => <li key={c.criterionId} className="rounded-lg border border-border p-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{c.criterionId}</span><ScoreBar value={c.score} /></div><p className="text-xs text-text-muted">{c.evidence}</p></li>)}</ul>
                  <p className="whitespace-pre-wrap text-sm">{session.evaluation.debrief}</p>
                </div>
              ) : (
                <div><p className="text-sm text-text-muted">The year is over. Generate the debrief to score your reasoning and compare with your own earlier runs.</p><Button className="mt-2" onClick={() => actions.evaluate.mutate()} loading={actions.evaluate.isPending}>Generate debrief</Button><ErrorNote error={actions.evaluate.error} /></div>
              )}
            </Card>
          )}
          {reports.length ? (
            <Card title="Quarterly reports">
              <ul className="space-y-1 text-sm">{reports.map((r) => <li key={r.throughMonth} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"><span>Q{r.throughMonth / 3}: profit {money(r.profit)}, margin {Math.round(r.avgMargin * 100)}%, {r.stockoutMonths} stockouts, reputation {r.reputationChange >= 0 ? "+" : ""}{r.reputationChange}</span><span className="text-text-faint">{r.note}</span></li>)}</ul>
            </Card>
          ) : null}
          {s.history.length ? (
            <Card title="Ledger">
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-text-faint"><th>M</th><th>Buy</th><th>Price</th><th>Rival</th><th>Sold/Dem</th><th>Cash</th><th>Rep</th><th>Event</th></tr></thead><tbody>{s.history.map((m) => <tr key={m.month} className="border-t border-border"><td>{m.month}</td><td>{m.input.buyUnits}@{m.buyPrice}</td><td>{m.input.sellPrice}</td><td>{m.rivalPrice}</td><td>{m.sold}/{m.demand}</td><td>{money(m.cashAfter)}</td><td>{Math.round(m.reputationAfter)}</td><td>{m.event.kind}</td></tr>)}</tbody></table></div>
            </Card>
          ) : null}
        </div>
        <aside>
          <Card title="Position">
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>Cash</span><span className="font-mono">{money(s.cash)}</span></li>
              <li className="flex justify-between"><span>Inventory</span><span className="font-mono">{s.inventory} / {s.capacity}</span></li>
              <li className="flex justify-between"><span>Reputation</span><span className="font-mono">{Math.round(s.reputation)}</span></li>
              <li className="flex justify-between"><span>Crew morale</span><Badge tone={s.moraleBand === "high" ? "success" : s.moraleBand === "mid" ? "warning" : "danger"}>{s.moraleBand}</Badge></li>
              <li className="flex justify-between"><span>Market price</span><span className="font-mono">{s.marketPrice}</span></li>
              <li className="flex justify-between"><span>Rival price</span><span className="font-mono">{s.rivalPrice}</span></li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
