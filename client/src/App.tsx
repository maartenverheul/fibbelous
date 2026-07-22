import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { TabProvider } from "./context/TabContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { PageView } from "./pages/PageView";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TrashPage } from "./pages/TrashPage";
import { useSavedWorkspaces } from "./hooks/useSavedWorkspaces";
import { shouldOpenWorkspaceManager } from "./lib/navigation";

function RootRedirect() {
  const location = useLocation();
  const { activeWorkspace } = useSavedWorkspaces();

  if (shouldOpenWorkspaceManager(location.state)) {
    return <LandingPage />;
  }

  if (activeWorkspace) {
    return <Navigate to={`/${activeWorkspace.slug}`} replace />;
  }

  return <LandingPage />;
}

function WorkspaceLayout() {
  return (
    <WorkspaceProvider>
      <TabProvider>
        <AppShell />
      </TabProvider>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/:slug" element={<WorkspaceLayout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="*" element={<PageView />} />
      </Route>
    </Routes>
  );
}
