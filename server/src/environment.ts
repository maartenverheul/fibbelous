import dotenv from "dotenv";
dotenv.config();

const environment = {
  repository: process.env.GIT_REPOSTORY!,
  username: process.env.GIT_USERNAME,
  password: process.env.GIT_PASSWORD,
  dev: process.env.NODE_ENV != "production",
};

if (!environment.repository) throw new Error("GIT_REPO evironment variable is missing.");

export default environment;
