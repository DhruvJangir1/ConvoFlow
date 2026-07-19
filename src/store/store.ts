import { configureStore } from '@reduxjs/toolkit';
import userAuthReducer from './userAuthSlice';
import chatReducer from './chatSlice';

export const store = configureStore({
  reducer: {
    userAuth: userAuthReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
