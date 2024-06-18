import { verifyJwt } from "../security";
import { Request, Response, NextFunction } from "express";

const useAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = verifyJwt(req.headers.authorization as string);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req["user"] = user; // Attach user to the request object
    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    console.error("Error in authentication:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

export { useAuth }
