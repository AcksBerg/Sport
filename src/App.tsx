import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import {
  HomePage,
  ProfilePage,
  SportEditPage,
  SportPage,
  SportsPage,
} from "./pages";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="nutzer" element={<ProfilePage />} />
          <Route path="sportart" element={<SportsPage />} />
          <Route path="sportart/:slug" element={<SportPage />} />
          <Route path="sportart/:slug/edit" element={<SportEditPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
