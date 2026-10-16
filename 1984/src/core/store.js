// localStorage that never throws: private windows, blocked site data and
// sandboxed frames make the accessor fail, and the game must still run.
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* not saved */ } },
};
