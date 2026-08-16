import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MainPage } from './components/pages/MainPage';
import { AboutUs } from './components/pages/AboutUs';
import { PrivacyPolicy } from './components/pages/PrivacyPolicy';
import { TermsAndConditions } from './components/pages/TermsAndConditions';
import { ContactUs } from './components/pages/ContactUs';
import { useLogAnalytics } from './hooks/useLogAnalytics';

export default function App() {
  const { state, processFile, reset } = useLogAnalytics();

  return (
    <div className="d-flex flex-column h-100 bg-dark text-white" style={{ background: '#0d1117' }}>
      <Navbar state={state} onReset={reset} />
      <Routes>
        <Route path="/" element={<MainPage key={state.fileName ?? ''} state={state} processFile={processFile} reset={reset} />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/contact" element={<ContactUs />} />
      </Routes>
    </div>
  );
}
