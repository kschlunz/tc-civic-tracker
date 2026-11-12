/** Load .env.local if it exists, so local runs pick up ANTHROPIC_API_KEY. */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./store";

const file = path.join(ROOT, ".env.local");
if (fs.existsSync(file)) process.loadEnvFile(file);
