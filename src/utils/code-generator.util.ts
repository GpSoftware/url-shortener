import { customAlphabet } from "nanoid";

export default function generateCode() {
  const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 10);
  return nanoid();
}