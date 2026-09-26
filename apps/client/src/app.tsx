import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "./components/error-boundary";
import { AppShell } from "./components/shell";
import { Spinner } from "./components/ui";
import { useMe } from "./lib/queries";
import { LandingPage } from "./pages/landing";
import { LoginPage, SignupPage } from "./pages/auth";
import { CommandCenterPage } from "./pages/command-center";

/** Route-level code splitting: each section loads on first visit. */
const load = <T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T): LazyExoticComponent<ComponentType> =>
  lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));

const OnboardingPage = load(() => import("./pages/onboarding"), "OnboardingPage");
const TrainPage = load(() => import("./pages/train"), "TrainPage");
const ExercisePage = load(() => import("./pages/train"), "ExercisePage");
const SessionPage = load(() => import("./pages/session"), "SessionPage");
const ProfilePage = load(() => import("./pages/profile"), "ProfilePage");
const SettingsPage = load(() => import("./pages/settings"), "SettingsPage");
const InferenceLabPage = load(() => import("./pages/inference"), "InferenceLabPage");
const InvestigationPage = load(() => import("./pages/inference"), "InvestigationPage");
const TreesPage = load(() => import("./pages/trees"), "TreesPage");
const TreeEditorPage = load(() => import("./pages/tree-editor"), "TreeEditorPage");
const SimulationsPage = load(() => import("./pages/simulations"), "SimulationsPage");
const SimulationPlayPage = load(() => import("./pages/simulations"), "SimulationPlayPage");
const WarRoomPage = load(() => import("./pages/war-room"), "WarRoomPage");
const CouncilPage = load(() => import("./pages/war-room"), "CouncilPage");
const LibraryPage = load(() => import("./pages/library"), "LibraryPage");
const ReaderPage = load(() => import("./pages/library"), "ReaderPage");
const KnowledgePage = load(() => import("./pages/knowledge"), "KnowledgePage");
const ReviewPage = load(() => import("./pages/review"), "ReviewPage");
const ProjectsPage = load(() => import("./pages/projects"), "ProjectsPage");
const ProjectPage = load(() => import("./pages/projects"), "ProjectPage");
const JournalPage = load(() => import("./pages/journal"), "JournalPage");
const BriefingPage = load(() => import("./pages/briefing"), "BriefingPage");
const NegotiationsPage = load(() => import("./pages/negotiation"), "NegotiationsPage");
const NegotiationPage = load(() => import("./pages/negotiation"), "NegotiationPage");
const MissionsPage = load(() => import("./pages/missions"), "MissionsPage");
const MissionPage = load(() => import("./pages/missions"), "MissionPage");
const GamesPage = load(() => import("./pages/game"), "GamesPage");
const GamePage = load(() => import("./pages/game"), "GamePage");
const ChallengesPage = load(() => import("./pages/challenge"), "ChallengesPage");
const ChallengeAttemptPage = load(() => import("./pages/challenge"), "ChallengeAttemptPage");
const AdminPage = load(() => import("./pages/admin"), "AdminPage");

function Fallback() {
  return (
    <div className="flex justify-center py-20">
      <Spinner />
    </div>
  );
}

/** Redirects to login when the API says we are unauthenticated. */
function Protected() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <Fallback />;
  if (me.isError) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** New accounts go through onboarding once; it stays skippable inside. */
function OnboardingGate() {
  const me = useMe();
  const location = useLocation();
  if (me.data && !me.data.profile.onboarding.completed && location.pathname !== "/app/onboarding") {
    return <Navigate to="/app/onboarding" replace />;
  }
  return <Outlet />;
}

/** Admin pages are hidden client-side for convenience; the API enforces the flag. */
function AdminGate() {
  const me = useMe();
  if (me.data && !me.data.profile.roles.admin) return <Navigate to="/app" replace />;
  return <Outlet />;
}

function Boundary() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fallback />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    path: "/app",
    element: <Protected />,
    children: [
      {
        element: <OnboardingGate />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                element: <Boundary />,
                children: [
                  { index: true, element: <CommandCenterPage /> },
                  { path: "onboarding", element: <OnboardingPage /> },
                  { path: "train", element: <TrainPage /> },
                  { path: "train/:exerciseId", element: <ExercisePage /> },
                  { path: "sessions/:sessionId", element: <SessionPage /> },
                  { path: "inference", element: <InferenceLabPage /> },
                  { path: "inference/:sessionId", element: <InvestigationPage /> },
                  { path: "trees", element: <TreesPage /> },
                  { path: "trees/:treeId", element: <TreeEditorPage /> },
                  { path: "simulations", element: <SimulationsPage /> },
                  { path: "simulations/:sessionId", element: <SimulationPlayPage /> },
                  { path: "war-room", element: <WarRoomPage /> },
                  { path: "war-room/:councilId", element: <CouncilPage /> },
                  { path: "library", element: <LibraryPage /> },
                  { path: "library/:documentId", element: <ReaderPage /> },
                  { path: "knowledge", element: <KnowledgePage /> },
                  { path: "review", element: <ReviewPage /> },
                  { path: "projects", element: <ProjectsPage /> },
                  { path: "projects/:projectId", element: <ProjectPage /> },
                  { path: "journal", element: <JournalPage /> },
                  { path: "briefing", element: <BriefingPage /> },
                  { path: "negotiations", element: <NegotiationsPage /> },
                  { path: "negotiations/:sessionId", element: <NegotiationPage /> },
                  { path: "missions", element: <MissionsPage /> },
                  { path: "missions/:sessionId", element: <MissionPage /> },
                  { path: "game", element: <GamesPage /> },
                  { path: "game/:gameId", element: <GamePage /> },
                  { path: "challenges", element: <ChallengesPage /> },
                  { path: "challenges/:attemptId", element: <ChallengeAttemptPage /> },
                  { path: "profile", element: <ProfilePage /> },
                  { path: "settings", element: <SettingsPage /> },
                  { element: <AdminGate />, children: [{ path: "admin", element: <AdminPage /> }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
