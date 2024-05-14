import { pageMetaSchema, pageSchema } from "@/models";
import { pageService } from "@/services/PageService";
import { Router } from "express";
import { ZodError, z } from "zod";
import zodValidate from "./zodMiddleware";

const pagesRouter = Router();

pagesRouter.get("/", (req, res) => {
  const data = pageService.getAll();
  return res.json(data);
});

pagesRouter.use(zodValidate(pageSchema)).post("/", (req, res) => {
  pageService.create(req.body);
  res.json(req.body);
});
pagesRouter.get("/:id", (req, res) => {
  const target = pageService.find(req.params.id);
  if (!target) return res.status(404).end();
  return res.json(target);
});
pagesRouter.put("/:id", (req, res) => {
  res.send("Update page " + req.params.id);
  // pageService.update(req.params.id);
});
pagesRouter.delete("/:id", (req, res) => {
  res.send("Delete page " + req.params.id);
  pageService.delete(req.params.id);
});

export default pagesRouter;
