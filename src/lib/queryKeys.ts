export const chatKeys = {
  all: ['chats'],
  lists: () => [...chatKeys.all, 'list'],
  list: (filters?: Record<string, string>) => [...chatKeys.lists(), filters],
  details: () => [...chatKeys.all, 'detail'] ,
  detail: (chatId: string) => [...chatKeys.details(), chatId],
  messages: (chatId: string) => ['chats', chatId, 'messages'],
};

export const anonChatKeys = {
  all: ['anonymousChats'] ,
  lists: () => [...anonChatKeys.all, 'list'],
  list: (filters?: Record<string, string>) => [...anonChatKeys.lists(), filters],
  details: () => [...anonChatKeys.all, 'detail'] ,
  detail: (roomId: string) => [...anonChatKeys.details(), roomId] ,
  messages: (roomId: string) => ['anonymousChats', roomId, 'messages'] ,
};

export const notifKeys = {
  all: ['notifications'] ,
  lists: () => [...notifKeys.all, 'list'] ,
  list: (filters?: Record<string, string>) => [...notifKeys.lists(), filters] ,
};
