import winston from "winston";

const formatter = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ level, message, service, timestamp }) => {
    return `${timestamp} ${level.toUpperCase()} [${service}] ${message}`;
  })
);

const logger = winston.createLogger({
  level: "info",
  // format: winston.format.json(),
  format: formatter,
  transports: [
    // new winston.transports.File({ filename: "error.log", level: "error" }),
    // new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({ level: "debug" }),
  ],
});

export function getLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}
