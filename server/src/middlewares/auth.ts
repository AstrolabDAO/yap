import { NextFunction, Request, Response } from "express";
import { verifyAndRefreshJwt } from "../security";

import { User } from "../../../common/models";
import config from "../config";
import { getUser, isAdmin, isGovernor, isModerator } from "../io";

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

const useAuth = async (req: Request, res: Response, next: NextFunction, require=false) => {
  try {
    const [jwt, payload] = verifyAndRefreshJwt(req.headers.authorization!, config.server.jwt_session_salt);
    if (jwt) {
      if (!res.locals.currentUser) {
        res.locals.currentUser = await getUser(payload.address); // stateless => get session user from jwt everytime
      }
      if (jwt !== req.headers.authorization) {
        res.setHeader("Authorization", `Bearer ${jwt}`);
        console.log(`Refreshed JWT for ${payload.address}`);
      }
    } else if (require) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.error("Error in authentication:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  await useAuth(req, res, next, true);
}

export { isAdm, isGov, isMod, useAuth, requireAuth };

