import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignIn } from "@clerk/react";
import { dark } from "@clerk/themes";
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

function SignInPage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface-base">
      <SignIn
        routing="path"
        path="/auth"
        forceRedirectUrl="/home"
        signUpUrl="/auth"
        appearance={{
          theme: dark,
          variables: {
            colorPrimary: "#FFFFFF",
            colorPrimaryForeground: "#000000",
            colorDanger: "#EF4444",
            colorSuccess: "#22C543",
            colorWarning: "#F36B16",
            colorNeutral: "#FFFFFF",
            colorForeground: "#FFFFFF",
            colorBackground: "#000000",
            colorInput: "#26262B",
            colorInputForeground: "#FFFFFF",
            colorRing: "color-mix(in srgb, #ffffff 15%, transparent)",
            colorShimmer: "#FFFFFF",
            colorModalBackdrop: "#000000",
            borderRadius: "0.375rem",
            spacing: "1rem",
          },
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<SignInPage />} />
        <Route path="/auth/*" element={<SignInPage />} />
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
