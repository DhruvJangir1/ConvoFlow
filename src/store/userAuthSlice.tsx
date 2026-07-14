import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  user_name: string;
  email: string;
  created_at: string;
  image_url: string | null;
  is_verified: boolean;
  last_login: string | null;
  user_tag: string;
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
    updateUserProfileImage(state, action: PayloadAction<string>) {
      if (state.user) {
        state.user.image_url = action.payload;
        console.log("[userAuthSlice] updateUserProfileImage called, updated user image_url:", state.user.image_url);
      }
      else{
        console.log("[userAuthSlice] updateUserProfileImage called but user is null");
      }
    },
  },
});

export const { setUser, setConnected, setUnreadNotifCount, incrementUnreadNotif, resetUnreadNotif, updateUserProfileImage } = userAuthSlice.actions;
export default userAuthSlice.reducer;
