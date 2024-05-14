import { Router } from "express";
import pagesRouter from "./pages";
import bodyParser from "body-parser";

const router = Router();

router.use(bodyParser.json());

router.use("/pages", pagesRouter);

router.get("/", (req, res) => {
  res.send("running");
});

export default router;
