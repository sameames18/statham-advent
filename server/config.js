// Settings from the environment, shared by the Node server (server/index.js)
// and the Vercel function (api/index.js).

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

const MIN_SECRET = 16;

export function readConfig(env = process.env, argv = process.argv) {
  // Preview mode lets anyone pretend it's another date and open every door,
  // so it is off unless asked for: TIME_TRAVEL=1, or --preview on the
  // command line (which is how `npm run dev` turns it on).
  const timeTravel = env.TIME_TRAVEL === '1' || argv.includes('--preview');

  // The secret decides each year's draw. Without it anyone with the source
  // could work out the whole calendar, so a real December refuses to run
  // without one. Preview mode gives every film away already, so there a
  // stand-in is fine.
  let secret = env.CALENDAR_SECRET ?? '';
  if (!secret) {
    if (!timeTravel) {
      throw new ConfigError('CALENDAR_SECRET is not set. Set it to a long random string (for example the output of `openssl rand -hex 32`), and keep it for the whole season: changing it redraws the calendar.');
    }
    secret = 'preview';
  } else if (secret.length < MIN_SECRET) {
    throw new ConfigError(`CALENDAR_SECRET is too short to keep the calendar secret; use at least ${MIN_SECRET} random characters (for example \`openssl rand -hex 32\`).`);
  }

  // Mark the door cookies Secure (HTTPS only). Vercel always serves HTTPS,
  // so it is on there by default; elsewhere set SECURE_COOKIES=1 once a
  // proxy terminates HTTPS, and leave it off for plain-HTTP development.
  const secureCookies = env.SECURE_COOKIES !== undefined && env.SECURE_COOKIES !== ''
    ? env.SECURE_COOKIES !== '0'
    : !!env.VERCEL;

  return {
    port: Number(env.PORT || 4747),
    defaultTz: env.DEFAULT_TZ || 'America/Los_Angeles',
    timeTravel,
    secret,
    secureCookies,
  };
}
