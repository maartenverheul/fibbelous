import winston, { format } from "winston";

const consoleFormat = format.combine(
  format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  format.colorize(),
  format.splat(),
  format.printf((info) => {
    return `${info.timestamp} ${info.level} [${info.name ?? "?"}] ${info.message}`;
  })
);

const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

function getLogger(name: string) {
  return logger.child({ name });
}

export default getLogger;
