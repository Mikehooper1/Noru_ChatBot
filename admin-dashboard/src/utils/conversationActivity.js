const ACTIVE_MS = 15 * 60 * 1000;

export function toMillis(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getActivityStatus(conversation, now = Date.now()) {
  if (conversation?.status === 'resolved') {
    return 'inactive';
  }
  const lastAt = toMillis(conversation?.lastMessageAt || conversation?.updatedAt);
  if (!lastAt) return 'inactive';
  return now - lastAt <= ACTIVE_MS ? 'active' : 'inactive';
}

export function formatLastSeen(conversation, now = Date.now()) {
  const lastAt = toMillis(conversation?.lastMessageAt || conversation?.updatedAt);
  if (!lastAt) return 'No activity';
  const diffMin = Math.floor((now - lastAt) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
