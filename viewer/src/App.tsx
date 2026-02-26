import { Routes, Route } from 'react-router-dom';
import BrowsePage from './pages/BrowsePage';
import RecipePage from './pages/RecipePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BrowsePage />} />
      <Route path="/recipe/:id" element={<RecipePage />} />
    </Routes>
  );
}
