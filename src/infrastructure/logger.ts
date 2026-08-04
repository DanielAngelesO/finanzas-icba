import pino from "pino";

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: {
    asObject: true,
    write: {
      info: (record) => console.info(record),
      warn: (record) => console.warn(record),
      error: (record) => console.error(record),
      debug: (record) => console.debug(record),
    },
  },
  redact: {
    paths: ["token", "accessToken", "authorization", "headers.authorization"],
    censor: "[REDACTED]",
  },
});
