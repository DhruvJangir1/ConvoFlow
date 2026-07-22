import {ClerkProvider} from "@clerk/react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store/store";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebSocketProvider } from "./context/WebSocketContext.tsx";

const queryClient = new QueryClient()

const root = document.getElementById('root');

if (root){
createRoot(root).render(
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <AuthProvider>
            <WebSocketProvider>
              <App />
            </WebSocketProvider>
          </AuthProvider>
        </Provider>
    </QueryClientProvider>
    </ClerkProvider>
);
}
