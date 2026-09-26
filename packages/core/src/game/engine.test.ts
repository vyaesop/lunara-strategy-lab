import { describe, expect, it } from "vitest";
import type { GameTurnInput } from "@lunara/schemas";
import { deterministicGameMetrics, initialGameState, playMonth, reportsFor, rng } from "./engine";

const turn = (over: Partial<GameTurnInput> = {}): GameTurnInput => ({ buyUnits: 300, sellPrice: 100, marketing: 0, investWarehouse: false, crewPay: 1, rationale: "", ...over });

describe("game engine", () => {
  it("is deterministic for a seed", () => {
    const a = initialGameState(42);
    const b = initialGameState(42);
    expect(a).toEqual(b);
    const ra = playMonth(42, a, turn());
    const rb = playMonth(42, b, turn());
    expect(ra).toEqual(rb);
    expect(initialGameState(43).marketPrice === a.marketPrice && rng(1)() === rng(2)()).toBe(false);
  });

  it("rejects plans that exceed cash or capacity", () => {
    const s = initialGameState(7);
    expect(playMonth(7, s, turn({ buyUnits: 5000 })).ok).toBe(false);
    expect(playMonth(7, s, turn({ buyUnits: 1000 })).ok).toBe(false);
  });

  it("sells no more than inventory and tracks stockouts", () => {
    const s = initialGameState(7);
    const r = playMonth(7, s, turn({ buyUnits: 0, sellPrice: 60 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.sold).toBeLessThanOrEqual(300);
      expect(r.record.demand).toBeGreaterThan(r.record.sold);
      expect(r.state.reputation).toBeLessThan(s.reputation + 3);
    }
  });

  it("rival cuts prices after two months of undercutting", () => {
    let s = initialGameState(11);
    let cut = false;
    for (let i = 0; i < 3; i++) {
      const r = playMonth(11, s, turn({ buyUnits: 200, sellPrice: Math.round(s.rivalPrice * 0.8) }));
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
      if (r.record.event.kind === "rival_cut") cut = true;
    }
    expect(cut).toBe(true);
  });

  it("runs twelve months, ends, and produces quarterly reports and metrics", () => {
    let s = initialGameState(3);
    for (let m = 1; m <= 12; m++) {
      const r = playMonth(3, s, turn({ buyUnits: Math.min(400, s.capacity - s.inventory), sellPrice: Math.round(s.marketPrice * 1.05) }));
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(s.ended).toBe(true);
    expect(s.history).toHaveLength(12);
    expect(reportsFor(s)).toHaveLength(4);
    const m = deterministicGameMetrics(s);
    expect(m.finalValue).toBeGreaterThan(0);
    expect(playMonth(3, s, turn()).ok).toBe(false);
  });
});
