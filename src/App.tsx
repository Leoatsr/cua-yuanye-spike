import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PhaserGame } from './game/PhaserGame';
import { DialogueBox } from './components/DialogueBox';
import { HUD } from './components/HUD';
import { TitleScreen } from './components/TitleScreen';
import { QuestPanel } from './components/QuestPanel';
import { TitleList } from './components/TitleList';
import { WorldMap } from './components/WorldMap';
import { QuestLog } from './components/QuestLog';
import { MailBox } from './components/MailBox';
import { MailBadge } from './components/MailBadge';
import { CVDisplay } from './components/CVDisplay';
import { ReviewProcessor } from './components/ReviewProcessor';
import { ReviewPanel } from './components/ReviewPanel';
import { ReviewBadge } from './components/ReviewBadge';
import { ReviewSeeder } from './components/ReviewSeeder';
import { AppealProcessor } from './components/AppealProcessor';
import { AuthBadge } from './components/AuthBadge';
import { RoadmapPanel } from './components/RoadmapPanel';
import { AppealDeskPanel } from './components/AppealDeskPanel';
import { CreateProposalPanel } from './components/CreateProposalPanel';
import { ProposalListPanel } from './components/ProposalListPanel';
import { HomeWallPanel } from './components/HomeWallPanel';
import { MeritBoardPanel } from './components/MeritBoardPanel';
import { LevelBadge } from './components/LevelBadge';
import { LevelUpAnimation } from './components/LevelUpAnimation';
import { FaceCustomizer } from './components/FaceCustomizer';
import { ProfilePanel } from './components/ProfilePanel';
import { ProfilePanelKeyListener } from './components/ProfilePanelKeyListener';
import { ProfileLink } from './components/ProfileLink';
// PERF-1: lazy load /u/[username] route - first-time players don't need it
const PublicProfilePage = lazy(() =>
  import('./components/PublicProfilePage').then((m) => ({
    default: m.PublicProfilePage,
  }))
);
import { OnlineRoster } from './components/OnlineRoster';
import { ChatPanel } from './components/ChatPanel';
import { ChatPanelKeyListener } from './components/ChatPanelKeyListener';
import { PlayerInteractPrompt } from './components/PlayerInteractPrompt';
import { PlayerInteractMenu } from './components/PlayerInteractMenu';
import { PlayerInteractKeyListener } from './components/PlayerInteractKeyListener';
import { QuestHistoryPanel } from './components/QuestHistoryPanel';
import { QuestHistoryKeyListener } from './components/QuestHistoryKeyListener';
import { NotificationToast } from './components/NotificationToast';
import { NotificationPanel } from './components/NotificationPanel';
import { NotificationKeyListener } from './components/NotificationKeyListener';
import { NotificationBadge } from './components/NotificationBadge';
import { FriendsPanel } from './components/FriendsPanel';
import { FriendsKeyListener } from './components/FriendsKeyListener';
import { EmotePanel } from './components/EmotePanel';
import { EmoteOverlay } from './components/EmoteOverlay';
import { DashboardPanel } from './components/DashboardPanel';
import { DashboardKeyListener } from './components/DashboardKeyListener';
import { AnnouncementButton } from './components/AnnouncementButton';
import { HelpButton } from './components/HelpButton';
import { TutorialOverlay } from './components/TutorialOverlay';
import { tutorialManager } from './lib/tutorialStore';
import { TimeOverlay } from './components/TimeOverlay';
import { TimeHUD } from './components/TimeHUD';
import { TimeSettingsButton } from './components/TimeSettingsButton';
import { timeSettings } from './lib/timeStore';
import { NpcGreetingToast } from './components/NpcGreetingToast';
import { SolarTermBanner } from './components/SolarTermBanner';
import { startSolarTermNotifier } from './lib/solarTermNotifier';
import { presence } from './lib/realtimePresence';
import { startErrorReporter } from './lib/errorReporter';
import { sessionTracker } from './lib/sessionTracker';
import { friendsPresence } from './lib/friendsPresence';
import { emoteManager } from './lib/emoteManager';
import { chatManager } from './lib/chatStore';
import { bots } from './lib/fakeBot';
import { fetchMyProfile } from './lib/profileStore';
import { fetchUserFace, getFaceLocal } from './lib/faceStore';
import { ensureProfile } from './lib/profileStore';
import { EventBus } from './game/EventBus';
import { SentryErrorBoundary } from './lib/sentry';
import { startUserTracker } from './lib/userTracker';
import { LandingPage } from './pages/Landing';
import { ManualPage, CodexPage, MapsPage } from './pages/ComingSoon';
import { GameViewPreview } from './pages/GameViewPreview';
import { NewGameAppHUD } from './pages/NewGameAppHUD';
import { NewChatPanel } from './components/NewChatPanel';
import { NewMailBox } from './components/NewMailBox';
import { NewFriendsPanel } from './components/NewFriendsPanel';
import { NewAnnouncementPanel } from './components/NewAnnouncementPanel';
import { NewQuestLog } from './components/NewQuestLog';
import { PanelToggleBridge } from './components/PanelToggleBridge';

/** Fallback shown if the React UI subtree crashes. Phaser keeps running. */
function CrashFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
        background: 'rgba(166, 70, 52, 0.95)',
        color: '#fff',
        padding: '20px 24px',
        borderRadius: 6,
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
        fontSize: 13,
        lineHeight: 1.6,
        maxWidth: 600,
        margin: '0 auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ UI 崩溃</div>
      <div style={{ marginBottom: 12, opacity: 0.9 }}>
        {error instanceof Error ? error.message : '未知错误'}
      </div>
      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 12 }}>
        游戏画面仍在运行。错误已自动上报给开发者。
      </div>
      <button
        onClick={resetError}
        style={{
          padding: '6px 14px',
          fontSize: 12,
          background: 'rgba(255, 255, 255, 0.2)',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        重置 UI
      </button>
    </div>
  );
}

function MainGameApp() {
  const [gameStarted, setGameStarted] = useState(false);

  // Start tracking the logged-in user for Sentry context
  useEffect(() => {
    startUserTracker();
    // J2-B: 启动错误埋点（捕获 window.error + unhandledrejection）
    startErrorReporter();
    // F6.0: pull face from cloud on app start (writes to localStorage)
    void fetchUserFace();
    // F4.0: ensure profile exists (one-time GitHub sync on first call)
    void ensureProfile();

    // G1.0: initialize realtime presence (after profile/face ready)
    let cancelled = false;
    const initMultiplayer = async () => {
      const profile = await fetchMyProfile();
      if (cancelled) return;
      if (!profile) return;
      const face = getFaceLocal();
      await presence.initialize({
        user_id: profile.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        face,
      });
      if (cancelled) return;
      // G2-A: subscribe world chat channel + load history
      await chatManager.subscribeWorld();
      if (cancelled) return;
      // G5-B: start friends presence tracking
      void friendsPresence.start();
      // G6: start emote chat listener
      emoteManager.start();
      // J2-C: start session tracking (heartbeat every 30s)
      void sessionTracker.start();
      // Pub 2a: load tutorial state + auto start if first time
      tutorialManager.load();
      tutorialManager.autoStartIfNeeded();
      // Pack S1: load time settings
      timeSettings.load();
      // Pack S2-A: start solar term notifier
      startSolarTermNotifier();
      // Spawn 5 fake bots (auto, only in Main scene for G1.0)
      // Skip if already spawned (idempotent for StrictMode double-mount)
      if (bots.bots.size === 0) {
        bots.spawn(5, 'Main');
      }
    };
    void initMultiplayer();

    return () => {
      cancelled = true;
      // Don't despawn bots on unmount — they're singleton
      // (App.tsx unmounts on full page navigation, which clears all state anyway)
    };
  }, []);

  const handleStart = () => {
    setGameStarted(true);
    EventBus.emit('start-bgm');
  };

  return (
    <>
      <PhaserGame />
      <NewGameAppHUD visible={gameStarted} />

      <SentryErrorBoundary
        fallback={({ error, resetError }) => (
          <CrashFallback error={error} resetError={resetError} />
        )}
      >
        {gameStarted && (
          <>
            <AuthBadge />
            <QuestPanel />
            <TitleList />
            <DialogueBox />
            <WorldMap />
            <NewQuestLog />
            <NewMailBox />
            <MailBadge />
            <ReviewBadge />
            <ReviewPanel />
            <RoadmapPanel />
            <AppealDeskPanel />
            <CreateProposalPanel />
            <ProposalListPanel />
            <HomeWallPanel />
            <MeritBoardPanel />
            <LevelUpAnimation />
            <FaceCustomizer />
            <ProfilePanel />
            <ProfilePanelKeyListener />
            <ProfileLink />
            <OnlineRoster />
            <NewChatPanel />
          <NewAnnouncementPanel />
            <ChatPanelKeyListener />
            <PlayerInteractPrompt />
            <PlayerInteractMenu />
            <PlayerInteractKeyListener />
            <QuestHistoryPanel />
            <QuestHistoryKeyListener />
            <NotificationToast />
            <NotificationPanel />
            <NotificationKeyListener />
            <NotificationBadge />
            <NewFriendsPanel />
            <FriendsKeyListener />
            <EmotePanel />
            <EmoteOverlay />
            <DashboardPanel />
            <DashboardKeyListener />
            <AnnouncementButton />
            <HelpButton />
            <TutorialOverlay />
            <TimeOverlay />
            <TimeSettingsButton />
            <NpcGreetingToast />
            <SolarTermBanner />
            {/* Headless components */}
            <ReviewProcessor />
            <ReviewSeeder />
            <AppealProcessor />
          </>
        )}

        {!gameStarted && <TitleScreen onStart={handleStart} />}
      </SentryErrorBoundary>
    </>
  );
}

// PERF-1: minimal loading fallback for lazy-loaded routes
// Inline styles only — no external CSS to ensure it shows instantly
function ProfileLoadingFallback() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0e12',
        color: '#a8a08e',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        fontSize: 13,
        letterSpacing: '0.08em',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '2px solid rgba(184, 137, 58, 0.2)',
          borderTopColor: '#e0b060',
          borderRadius: '50%',
          animation: 'profileLoad 0.8s linear infinite',
          marginBottom: 16,
        }}
      />
      <div>载入主页…</div>
      <style>{`
        @keyframes profileLoad {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<MainGameApp />} />
        <Route path="/play-new" element={<GameViewPreview />} />
        <Route path="/manual" element={<ManualPage />} />
        <Route path="/codex" element={<CodexPage />} />
        <Route path="/maps" element={<MapsPage />} />
        <Route
          path="/u/:username"
          element={
            <Suspense fallback={<ProfileLoadingFallback />}>
              <PublicProfilePage />
            </Suspense>
          }
        />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
