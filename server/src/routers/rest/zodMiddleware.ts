import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";

const zodValidate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedObject = schema.parse(req.body);
    req.body = parsedObject;
    next(parsedObject);
  } catch (e) {
    res.json({ errors: (e as ZodError).issues });
  }
};

export default zodValidate;
