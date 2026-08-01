import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import Home from "./pages/Home";
import ChatView from "./pages/ChatView";
import ProfileView from "./pages/ProfileView";
import NotificationsPage from "./pages/NotificationsPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import AnonymousChat from "./pages/AnonymousChats/AnonymousChat";
import Communities from "./pages/Communities";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginForm from "./auth/LoginForm";
import SSOCallbackPage from "./auth/SSOCallbackPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<LoginForm />} />
        <Route path="/sso-callback" element={<SSOCallbackPage />} />
        <Route
          element={
            <ProtectedRoute>
              <RootLayout />
            </ProtectedRoute>
          }
        >
          <Route path="home" element={<Home />} />
          <Route path="communities" element={<Communities />} />
          <Route path="chat/:chatId" element={<ChatView />} />
          <Route path="anonymous/:id" element={<AnonymousChat />} />
          <Route path="profile" element={<ProfileView />} />
          <Route path="notification" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
