// Fondasi rute (WEB-01, WEB-02, WEB-07): tiga halaman.
// Jangan tambahkan teks UI di sini; semua teks berasal dari ui/copy.id.ts.
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CekPage } from './pages/CekPage';
import { UnduhPage } from './pages/UnduhPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/cek" element={<CekPage />} />
      <Route path="/unduh" element={<UnduhPage />} />
    </Routes>
  );
}