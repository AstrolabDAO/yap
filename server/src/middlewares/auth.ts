import { NextFunction, Request, Response } from "express";
import { verifyAndRefreshJwt } from "../security";

import { User } from "../../../common/models";
import config from "../config";
import { isAdmin, isGovernor, isModerator } from "../io";

const isAdm = async (req: Request, res: Response, next: any) => {
  const user = res.locals.currentUser as User;
  if (!user || !await isAdmin(user.address)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const isMod = async (req: Request, res: Response, next: any) => {
  const user = res.locals.currentUser as User;
  if (!user || !await isModerator(user.address)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const isGov = async (req: Request, res: Response, next: any) => {
  const user = res.locals.currentUser as User;
  if (!user || !await isGovernor(user.address)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const useAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const prevJwt = req.headers.authorization!;
    const [jwt, payload] = verifyAndRefreshJwt(req.headers.authorization!, config.server.jwt_session_salt);
    if (jwt !== prevJwt) {
      res.setHeader("Authorization", `Bearer ${jwt}`);
    }
    res.locals = { ...res.locals, currentUser: payload };
    next();
  } catch (error) {
    console.error("Error in authentication:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

export { isAdm, isGov, isMod, useAuth };

