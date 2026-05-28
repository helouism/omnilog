import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MainPage } from './components/pages/MainPage';
import { AboutUs } from './components/pages/AboutUs';
import { PrivacyPolicy } from './components/pages/PrivacyPolicy';
import { TermsAndConditions } from './components/pages/TermsAndConditions';
import { BlogList } from './components/pages/BlogList';
import { BlogPost } from './components/pages/BlogPost';
import { useLogAnalytics } from './hooks/useLogAnalytics';

export default function App() {
  const { state, processFile, reset } = useLogAnalytics();

  return (
    <div className="d-flex flex-column h-100 bg-dark text-white" style={{ background: '#0d1117' }}>
      <Navbar state={state} onReset={reset} />
      <Routes>
        <Route path="/" element={<MainPage state={state} processFile={processFile} reset={reset} />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
      </Routes>
    </div>
  );
}
