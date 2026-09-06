/**
 * S-02 verification: are trip presence topics gated by trip membership?
 *
 * Run this against a Supabase BRANCH, not production. It proves two things that
 * a clean migration does not: that a member can still use presence, and that a
 * non-member is refused.
 *
 * Nothing is written to your database — the script signs in, joins a presence
 * topic, and reads presence state. It needs no service role key, and you should
 * not give it one: the service role bypasses RLS, which is the thing under test.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_PUBLISHABLE_KEY=<anon/publishable key> \
 *   TRIP_ID=<uuid of a trip MEMBER_EMAIL belongs to> \
 *   MEMBER_EMAIL=... MEMBER_PASSWORD=... \
 *   OUTSIDER_EMAIL=... OUTSIDER_PASSWORD=... \
 *   node scripts/verify-presence-authz.mjs
 *
 * Exit code 0 = both checks passed. 1 = something is wrong; read the output.
 */
import { createClient } from "@supabase/supabase-js";

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return v;
};

const SUPABASE_URL = need("SUPABASE_URL");
const KEY = need("SUPABASE_PUBLISHABLE_KEY");
const TRIP_ID = need("TRIP_ID");
const SUBSCRIBE_TIMEOUT_MS = 15_000;

const topic = `trip-presence:${TRIP_ID}`;

function client() {
  return createClient(SUPABASE_URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(label, emailVar, passwordVar) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: need(emailVar),
    password: need(passwordVar),
  });
  if (error) throw new Error(`${label}: sign-in failed — ${error.message}`);
  console.log(`  ${label} signed in as ${data.user?.email}`);
  return { supabase, userId: data.user.id };
}

/**
 * Join the presence topic as a private channel and report what happened.
 * Resolves { status, presence } rather than throwing, so the caller decides
 * whether a refusal is the pass or the fail.
 */
function joinPresence(supabase, userId) {
  return new Promise((resolve) => {
    const channel = supabase.channel(topic, {
      config: { private: true, presence: { key: userId } },
    });

    const finish = (status, presence) => {
      clearTimeout(timer);
      try {
        void supabase.removeChannel(channel);
      } catch {
        /* nothing useful to do on teardown */
      }
      resolve({ status, presence });
    };

    const timer = setTimeout(() => finish("TIMED_OUT", []), SUBSCRIBE_TIMEOUT_MS);

    channel.on("presence", { event: "sync" }, () => {
      // Presence sync only fires once the server has accepted us on the topic.
      const state = channel.presenceState();
      const list = Object.values(state).flat();
      if (list.length) finish("SUBSCRIBED", list);
    });

    channel.subscribe(async (status, err) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId, name: "authz-probe", editing: null });
        return; // wait for the presence sync above
      }
      if (status === "CHANNEL_ERROR" || status === "CLOSED") {
        finish(status === "CLOSED" ? "CLOSED" : "CHANNEL_ERROR", []);
      }
      if (err) console.log(`    (channel reported: ${err.message ?? err})`);
    });
  });
}

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (detail) console.log(`      ${detail}`);
};

console.log(`Topic under test: ${topic}\n`);

// 1. A trip member must still be able to use presence. If this fails, the
//    policies are too strict and the feature is broken for real users.
console.log("Check 1 — a trip member can join and be seen");
try {
  const member = await signIn("member", "MEMBER_EMAIL", "MEMBER_PASSWORD");
  const { status, presence } = await joinPresence(member.supabase, member.userId);
  record(
    "member can join presence",
    status === "SUBSCRIBED" && presence.length > 0,
    `status=${status}, presence entries=${presence.length}`,
  );
  await member.supabase.auth.signOut();
} catch (e) {
  record("member can join presence", false, e.message);
}

// 2. A signed-in NON-member must be refused, even holding the trip UUID.
//    That is the S-02 hole: before the fix this join succeeds.
console.log("\nCheck 2 — a non-member holding the trip UUID is refused");
try {
  const outsider = await signIn("outsider", "OUTSIDER_EMAIL", "OUTSIDER_PASSWORD");
  const { status, presence } = await joinPresence(outsider.supabase, outsider.userId);
  const refused = status !== "SUBSCRIBED";
  record(
    "non-member is refused",
    refused,
    refused
      ? `status=${status} (refused, as intended)`
      : `JOINED the topic and saw ${presence.length} presence entries — the topic is NOT gated`,
  );
  await outsider.supabase.auth.signOut();
} catch (e) {
  record("non-member is refused", false, e.message);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nS-02 is NOT verified. Do not merge the presence change to main.");
  process.exit(1);
}
console.log("\nS-02 verified: presence is gated by trip membership.");
process.exit(0);
