import { NextFunction, Request, Response } from "express";

import { Schema, ValidationOption } from "../../../common/models";
import { validate } from "../utils";

const validateParams = (schema: Schema, options?: ValidationOption) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req.params, schema, options)) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }
    next();
  }
}

const validateQuery = (schema: Schema, options?: ValidationOption) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req.query, schema, options)) {
      return res.status(400).json({ error: "Invalid request query" });
    }
    next();
  }
}

const validateBody = (schema: Schema, options?: ValidationOption) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req.body, schema, options)) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    next();
  }
}

export { validateParams, validateQuery, validateBody };
