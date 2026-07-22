import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import Home from "./pages/Home";
import ChatView from "./pages/ChatView";
import ProfileView from "./pages/ProfileView";
import NotificationsPage from "./pages/NotificationsPage";
import LandingPage from "./pages/LandingPage";
import WelcomePage from "./pages/WelcomePage";
import NotFoundPage from "./pages/NotFoundPage";
import AnonymousChat from "./pages/AnonymousChats/AnonymousChat";
import Communities from "./pages/Communities";
import ProtectedRoute from "./components/ProtectedRoute";
import VerificationPage from "./auth/VerificationPage";
import LoginForm from "./auth/LoginForm";
import SignUpForm from "./auth/SignUpForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<SignUpForm />} />
        <Route path="/verification" element={<VerificationPage />} />
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
