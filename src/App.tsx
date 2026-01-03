import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { JournalPage } from '@/pages/JournalPage';
import { PrivacyPolicy } from '@/pages/PrivacyPolicy';
import { TermsOfService } from '@/pages/TermsOfService';

function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/app" element={<JournalPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
        </Routes>
    );
}

export default App;
