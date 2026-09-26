import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  challengeAttempts,
  coachingSessions,
  councilSessions,
  customMissions,
  dailyBriefings,
  decisionRecords,
  gameSessions,
  investigationSessions,
  knowledgeConcepts,
  knowledgeRelations,
  missionSessions,
  negotiationSessions,
  profiles,
  readingDocuments,
  readingNotes,
  readingProjects,
  reviewItems,
  scenarioTrees,
  sessionMessages,
  simulationSessions,
  skillAssessments,
  strategicProjects,
} from "../db/schema";

/**
 * Everything the user owns, as one JSON document. Document text is included
 * (it is theirs); AI usage records are summarised, not dumped, because they
 * contain no user content and exist for cost accounting.
 */
export async function exportUserData(db: Db, userId: string) {
  const [
    profile, skills, sessions, messages, investigations, trees, simulations, councils,
    projectsR, documents, notes, concepts, relations, reviews, projects, decisions, briefings,
    negotiations, missionsCustom, missions, games, challenges,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    db.select().from(skillAssessments).where(eq(skillAssessments.userId, userId)),
    db.select().from(coachingSessions).where(eq(coachingSessions.userId, userId)),
    db.select().from(sessionMessages).where(eq(sessionMessages.userId, userId)),
    db.select().from(investigationSessions).where(eq(investigationSessions.userId, userId)),
    db.select().from(scenarioTrees).where(eq(scenarioTrees.userId, userId)),
    db.select().from(simulationSessions).where(eq(simulationSessions.userId, userId)),
    db.select().from(councilSessions).where(eq(councilSessions.userId, userId)),
    db.select().from(readingProjects).where(eq(readingProjects.userId, userId)),
    db.select().from(readingDocuments).where(eq(readingDocuments.userId, userId)),
    db.select().from(readingNotes).where(eq(readingNotes.userId, userId)),
    db.select().from(knowledgeConcepts).where(eq(knowledgeConcepts.userId, userId)),
    db.select().from(knowledgeRelations).where(eq(knowledgeRelations.userId, userId)),
    db.select().from(reviewItems).where(eq(reviewItems.userId, userId)),
    db.select().from(strategicProjects).where(eq(strategicProjects.userId, userId)),
    db.select().from(decisionRecords).where(eq(decisionRecords.userId, userId)),
    db.select().from(dailyBriefings).where(eq(dailyBriefings.userId, userId)),
    db.select().from(negotiationSessions).where(eq(negotiationSessions.userId, userId)),
    db.select().from(customMissions).where(eq(customMissions.userId, userId)),
    db.select().from(missionSessions).where(eq(missionSessions.userId, userId)),
    db.select().from(gameSessions).where(eq(gameSessions.userId, userId)),
    db.select().from(challengeAttempts).where(eq(challengeAttempts.userId, userId)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "lunara-strategy-lab/v1",
    profile: profile[0] ?? null,
    skills,
    coaching: { sessions, messages },
    investigations,
    scenarioTrees: trees,
    simulations,
    councils,
    reading: { projects: projectsR, documents, notes },
    knowledge: { concepts, relations },
    reviewItems: reviews,
    strategyLab: { projects, decisions, briefings },
    negotiations,
    missions: { custom: missionsCustom, sessions: missions },
    games,
    challenges,
  };
}
