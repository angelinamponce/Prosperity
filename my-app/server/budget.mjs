// A global spending cap per UTC day: total chat messages and total tokens across all visitors.
// In memory, so a restart starts the day's count over (acceptable for a safety net).

export function createDailyBudget({ messageCap = 300, tokenCap = 1_500_000, now = () => Date.now(), log = console } = {}) {
  let day = null;
  let messages = 0;
  let tokens = 0;
  let tripped = false;

  const roll = () => {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      messages = 0;
      tokens = 0;
      tripped = false;
    }
  };

  const check = () => {
    roll();
    const over = messages >= messageCap || tokens >= tokenCap;
    if (over && !tripped) {
      tripped = true;
      log.warn?.(`[sprout] daily cap reached for ${day} (UTC): ${messages}/${messageCap} messages, ${tokens}/${tokenCap} tokens. Serving preview mode until midnight UTC.`);
    }
    return over;
  };

  return {
    /** True when today's cap is used up. */
    exhausted: check,
    /** Counts one chat message. Returns false (and counts nothing) when the cap is already used up. */
    takeMessage() {
      if (check()) return false;
      messages += 1;
      return true;
    },
    /** Adds the tokens a reply used (input, cache and output). */
    addTokens(n) {
      roll();
      tokens += Math.max(0, n || 0);
      check();
    },
    snapshot: () => (roll(), { day, messages, tokens, messageCap, tokenCap }),
  };
}
