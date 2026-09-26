import { GAME_MONTHS, type GameEvent, type GameMonthRecord, type GameReport, type GameState, type GameTurnInput } from "@lunara/schemas";

/**
 * Meridian Trading Company: a deterministic 12-month trading simulation.
 * All randomness comes from a seeded generator so a run can be replayed and
 * tested. Rules are simple and documented; AI never touches state.
 */

/** mulberry32: small, fast, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RULES = {
  startCash: 100_000,
  startCapacity: 800,
  startPrice: 100,
  buySpread: 0.6, // buy price = market * spread
  baseDemand: 420,
  elasticity: 1.6,
  warehouseCost: 40_000,
  warehouseAdds: 600,
  fixedCosts: 6_000,
  crewCost: [3_000, 5_000, 8_000] as const,
  marketingEffect: 0.00004, // demand multiplier per currency unit, capped
  marketingCap: 0.6,
  holdingCostPerUnit: 2,
  reputationDecay: 1,
};

export function initialGameState(seed: number): GameState {
  const r = rng(seed);
  const marketPrice = Math.round(RULES.startPrice * (0.95 + r() * 0.1));
  return {
    month: 1,
    cash: RULES.startCash,
    inventory: 300,
    capacity: RULES.startCapacity,
    reputation: 50,
    morale: 60,
    marketPrice,
    rivalPrice: Math.round(marketPrice * 1.05),
    undercutStreak: 0,
    history: [],
    ended: false,
  };
}

/** Deterministic stream position: month N uses draws N*7..N*7+6 of the seed stream. */
function monthRandom(seed: number, month: number): () => number {
  const r = rng(seed ^ (month * 0x9e3779b1));
  return r;
}

export function buyPriceFor(state: GameState): number {
  return Math.round(state.marketPrice * RULES.buySpread);
}

function drawEvent(r: () => number, month: number): GameEvent {
  const x = r();
  if (x < 0.1) return { month, kind: "storm", text: "A storm at sea; part of the stock in transit is lost." };
  if (x < 0.18) return { month, kind: "port_fee", text: "The port authority levies a special fee this month." };
  if (x < 0.28) return { month, kind: "demand_surge", text: "A festival season lifts demand." };
  if (x < 0.34) return { month, kind: "crew_unrest", text: "The crew grumble about pay; work slows." };
  return { month, kind: "none", text: "A quiet month." };
}

export function moraleBand(morale: number): "low" | "mid" | "high" {
  return morale < 34 ? "low" : morale < 67 ? "mid" : "high";
}

export type TurnResult = { ok: true; state: GameState; record: GameMonthRecord } | { ok: false; reason: string };

export function playMonth(seed: number, state: GameState, input: GameTurnInput): TurnResult {
  if (state.ended) return { ok: false, reason: "The game is over." };
  const r = monthRandom(seed, state.month);
  const buyPrice = buyPriceFor(state);
  const purchaseCost = input.buyUnits * buyPrice;
  const warehouseCost = input.investWarehouse ? RULES.warehouseCost : 0;
  const crewCost = RULES.crewCost[input.crewPay] ?? RULES.crewCost[1];
  const upfront = purchaseCost + warehouseCost + input.marketing + crewCost + RULES.fixedCosts;
  if (upfront > state.cash) return { ok: false, reason: `That plan costs ${Math.round(upfront).toLocaleString()} but you have ${Math.round(state.cash).toLocaleString()}.` };
  const capacity = state.capacity + (input.investWarehouse ? RULES.warehouseAdds : 0);
  if (state.inventory + input.buyUnits > capacity) return { ok: false, reason: `Warehouse capacity is ${capacity} units; you would hold ${state.inventory + input.buyUnits}.` };

  // Event
  const event = drawEvent(r, state.month);
  let inventory = state.inventory + input.buyUnits;
  let extraCost = 0;
  let demandMult = 1;
  let morale = state.morale + (input.crewPay - 1) * 8 - 2;
  if (event.kind === "storm") inventory = Math.floor(inventory * 0.9);
  if (event.kind === "port_fee") extraCost += 6_000;
  if (event.kind === "demand_surge") demandMult *= 1.35;
  if (event.kind === "crew_unrest") morale -= 12;
  morale = Math.max(0, Math.min(100, morale));
  const moraleMult = 0.85 + (morale / 100) * 0.3; // 0.85..1.15 throughput

  // Demand
  const priceRatio = state.rivalPrice / Math.max(1, input.sellPrice);
  const marketing = Math.min(RULES.marketingCap, input.marketing * RULES.marketingEffect);
  const repMult = 1 + (state.reputation - 50) / 200;
  const demand = Math.max(0, Math.round(RULES.baseDemand * Math.pow(priceRatio, RULES.elasticity) * (1 + marketing) * repMult * demandMult * moraleMult * (0.9 + r() * 0.2)));
  const sold = Math.min(inventory, demand);
  const revenue = sold * input.sellPrice;
  const stockout = demand > inventory;
  const holding = (inventory - sold) * RULES.holdingCostPerUnit;
  const costs = upfront + extraCost + holding;
  const cash = state.cash - costs + revenue;

  // Reputation: service (no stockout) and fair price raise it; stockouts and gouging lower it.
  let reputation = state.reputation - RULES.reputationDecay;
  if (!stockout && sold > 0) reputation += 3;
  if (stockout) reputation -= 4;
  if (input.sellPrice > state.marketPrice * 1.3) reputation -= 3;
  if (input.sellPrice < state.marketPrice * 0.9) reputation += 1;
  reputation = Math.max(0, Math.min(100, reputation));

  // Rival: undercut for two months → they cut 8%; otherwise drift toward market.
  const undercut = input.sellPrice < state.rivalPrice * 0.9;
  const undercutStreak = undercut ? state.undercutStreak + 1 : 0;
  let rivalPrice = state.rivalPrice;
  let rivalEvent: GameEvent | null = null;
  if (undercutStreak >= 2) {
    rivalPrice = Math.round(rivalPrice * 0.92);
    rivalEvent = { month: state.month, kind: "rival_cut", text: "Your rival cuts prices in response to being undercut." };
  } else rivalPrice = Math.round(rivalPrice + (state.marketPrice * 1.05 - rivalPrice) * 0.3);

  // Market random walk
  const marketPrice = Math.max(40, Math.round(state.marketPrice * (0.94 + r() * 0.12)));

  const record: GameMonthRecord = {
    month: state.month,
    input,
    buyPrice,
    marketPrice: state.marketPrice,
    rivalPrice: state.rivalPrice,
    demand,
    sold,
    revenue,
    costs: Math.round(costs),
    cashAfter: Math.round(cash),
    inventoryAfter: inventory - sold,
    reputationAfter: reputation,
    event: rivalEvent ?? event,
  };
  const month = state.month + 1;
  const ended = month > GAME_MONTHS || cash < 0;
  return {
    ok: true,
    state: { month: Math.min(month, GAME_MONTHS + 1), cash: Math.round(cash), inventory: inventory - sold, capacity, reputation, morale, marketPrice, rivalPrice, undercutStreak, history: [...state.history, record], ended },
    record,
  };
}

/** Quarterly report for the player, computed from history. */
export function reportsFor(state: GameState): GameReport[] {
  const out: GameReport[] = [];
  for (let q = 3; q <= state.history.length; q += 3) {
    const slice = state.history.slice(q - 3, q);
    const profit = slice.reduce((a, m) => a + m.revenue - m.costs, 0);
    const margins = slice.filter((m) => m.sold > 0).map((m) => (m.input.sellPrice - m.buyPrice) / m.input.sellPrice);
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    const stockoutMonths = slice.filter((m) => m.demand > m.sold).length;
    const reputationChange = (slice.at(-1)?.reputationAfter ?? 0) - (state.history[q - 4]?.reputationAfter ?? 50);
    out.push({
      throughMonth: q,
      profit: Math.round(profit),
      avgMargin: Math.round(avgMargin * 100) / 100,
      stockoutMonths,
      reputationChange: Math.round(reputationChange),
      note: stockoutMonths >= 2 ? "Repeated stockouts: demand outran stock." : avgMargin < 0.15 ? "Thin margins: price or buying discipline." : "Steady quarter.",
    });
  }
  return out;
}

export function finalValue(state: GameState): number {
  return Math.round(state.cash + state.inventory * state.marketPrice * 0.8);
}

export function deterministicGameMetrics(state: GameState) {
  const h = state.history;
  const profit = h.reduce((a, m) => a + m.revenue - m.costs, 0);
  const margins = h.filter((m) => m.sold > 0).map((m) => (m.input.sellPrice - m.buyPrice) / m.input.sellPrice);
  return {
    finalCash: state.cash,
    finalValue: finalValue(state),
    profit: Math.round(profit),
    avgMargin: margins.length ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 100) / 100 : 0,
    stockoutMonths: h.filter((m) => m.demand > m.sold).length,
    reputationEnd: state.reputation,
    moraleEnd: state.morale,
    eventsSurvived: h.filter((m) => m.event.kind !== "none").length,
  };
}
