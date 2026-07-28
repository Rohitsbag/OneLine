import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';

// Lazy load pages for performance optimization
export const loadAuthPage = () => import('@/pages/AuthPage');
export const loadJournalPage = () => import('@/pages/JournalPage');

const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => loadAuthPage().then(m => ({ default: m.AuthPage })));
const JournalPage = lazy(() => loadJournalPage().then(m => ({ default: m.JournalPage })));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('@/pages/TermsOfService').then(m => ({ default: m.TermsOfService })));

// Minimalist loading placeholder
const PageLoader = () => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
    </div>
);

// Route wrapper to redirect authenticated users to the journal app
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    const { userId, isLoading } = useAuth();
    if (isLoading) return <PageLoader />;
    if (userId) {
        return <Navigate to="/app" replace />;
    }
    return <>{children}</>;
};

// Protected route wrapper to redirect guests/unauthenticated users to auth
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { userId, isLoading } = useAuth();
    if (isLoading) return <PageLoader />;
    if (!userId) {
        return <Navigate to="/auth" replace />;
    }
    return <>{children}</>;
};

function App() {
    return (
        <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
                    <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
                    <Route
                        path="/app"
                        element={<ProtectedRoute><JournalPage /></ProtectedRoute>}
                    />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
}

export default App;

