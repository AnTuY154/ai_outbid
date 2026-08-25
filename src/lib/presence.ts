const PRESENCE_ID_KEY = "kinh_mat_presence_id";

export function getPresenceId() {
  const existing = window.sessionStorage.getItem(PRESENCE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.sessionStorage.setItem(PRESENCE_ID_KEY, id);
  return id;
}
