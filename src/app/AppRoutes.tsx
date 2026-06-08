import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "@/features/home";
import { ProfilePage } from "@/features/profile";
import { SportEditPage, SportPage, SportsPage } from "@/features/sports";
import { Layout } from "@/shared/components/Layout";

export function AppRoutes() {
  return (
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
  );
}
