import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";
import { Config } from "../../common/models";

const configPath = path.join(__dirname, "..", "config.yml");
const configFile = fs.readFileSync(configPath, "utf8");
const config = yaml.load(configFile) as Config;

export default config;
