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

    <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <AuthProvider>
            <WebSocketProvider>
              <App />      
            </WebSocketProvider>
            </AuthProvider>
        </Provider>
    </QueryClientProvider>
);
}