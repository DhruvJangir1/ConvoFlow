import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Chat } from '../types/chat';

interface ChatState {
  chats: Chat[];
  onlineUsers: Record<string, string[]>;
}

const initialState: ChatState = {
  chats: [],
  onlineUsers: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChats(state, action: PayloadAction<Chat[]>) {
      state.chats = action.payload;
    },
    addChat(state, action: PayloadAction<Chat>) {
      state.chats = [action.payload, ...state.chats.filter(c => c.id !== action.payload.id)];
    },
    setOnlineUsers(state, action: PayloadAction<{ chatId: string; userIds: string[] }>) {
      state.onlineUsers[action.payload.chatId] = action.payload.userIds;
    },
    addOnlineUser(state, action: PayloadAction<{ chatId: string; userId: string }>) {
      const { chatId, userId } = action.payload;
      if (!state.onlineUsers[chatId]) {
        state.onlineUsers[chatId] = [];
      }
      if (!state.onlineUsers[chatId].includes(userId)){
        state.onlineUsers[chatId].push(userId);
      }
    },
    removeOnlineUser(state, action: PayloadAction<{ chatId: string; userId: string }>) {
      const { chatId, userId } = action.payload;
      if (state.onlineUsers[chatId])
        state.onlineUsers[chatId] = state.onlineUsers[chatId].filter(id => id !== userId);
    },
  },
});

export const { setChats, addChat, setOnlineUsers, addOnlineUser, removeOnlineUser } = chatSlice.actions;
export default chatSlice.reducer;
