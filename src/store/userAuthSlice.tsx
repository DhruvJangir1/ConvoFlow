import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  user_name: string;
  email: string;
  created_at: string;
  image_url: string | null;
  is_verified: boolean;
  last_login: string | null;
}

interface UserAuthState {
  user: User | null;
  isConnected: boolean;
  unreadNotifCount: number;
}

const initialState: UserAuthState = {
  user: null,
  isConnected: false,
  unreadNotifCount: 0,
};

const userAuthSlice = createSlice({
  name: 'userAuth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
    },
    setUnreadNotifCount(state, action: PayloadAction<number>) {
      state.unreadNotifCount = action.payload;
    },
    incrementUnreadNotif(state) {
      state.unreadNotifCount += 1;
    },
    resetUnreadNotif(state) {
      state.unreadNotifCount = 0;
    },
  },
});

export const { setUser, setConnected, setUnreadNotifCount, incrementUnreadNotif, resetUnreadNotif } = userAuthSlice.actions;
export default userAuthSlice.reducer;
