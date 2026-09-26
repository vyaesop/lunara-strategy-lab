import { describe, expect, it } from "vitest";
import { conceptDegrees, findDuplicateConcept, slugify, validateRelation } from "./concepts";

describe("concept dedup", () => {
  it("slugifies consistently", () => {
    expect(slugify("Bayes' Theorem")).toBe("bayes-theorem");
    expect(slugify("  Sunk-Cost & Fallacy ")).toBe("sunk-cost-and-fallacy");
    expect(slugify("Ünïcode")).toBe("unicode");
    expect(slugify("!!!")).toBe("concept");
  });

  it("matches by slug or alias", () => {
    const concepts = [{ id: "c1", slug: "base-rate", aliases: ["prior probability"] }];
    expect(findDuplicateConcept(concepts, "Base Rate")).toBe("c1");
    expect(findDuplicateConcept(concepts, "Prior Probability")).toBe("c1");
    expect(findDuplicateConcept(concepts, "Likelihood ratio")).toBeNull();
  });

  it("validates relations", () => {
    const rels = [{ fromId: "a", toId: "b", kind: "supports" as const }];
    expect(validateRelation(rels, "a", "a", "supports")).toMatch(/itself/);
    expect(validateRelation(rels, "a", "b", "supports")).toMatch(/already/);
    expect(validateRelation(rels, "a", "b", "contradicts")).toBeNull();
    expect(conceptDegrees([{ id: "a" }, { id: "b" }, { id: "c" }], rels).get("a")).toBe(1);
  });
});
