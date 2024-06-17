import jwt from "jsonwebtoken";
import config from "./config";
import { JwtPayload } from "../common/models";

export function generateToken(payload: JwtPayload, expiresIn: string = "1h"): string {
  return jwt.sign(payload, config.server.jwt_secret, { expiresIn });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    if (!token) return null;
    const tokenWithoutBearer = token.replace("Bearer ", "");
    return jwt.verify(tokenWithoutBearer, config.server.jwt_secret) as JwtPayload;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

export function refreshToken(token: string, expiresIn: string = "1h"): string | null {
  const payload = verifyToken(token);
  if (!payload) return null; // Invalid token
  return generateToken(payload, expiresIn);
}

export function updateTokenClaim(token: string, claim: string, value: any): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  payload[claim] = value;
  return generateToken(payload);
}
