import { useLiveConversations } from './useLiveConversations';

export function useConversations(businessId, status) {
  const { conversations, loading } = useLiveConversations(businessId, status || null);
  return { conversations, loading };
}
