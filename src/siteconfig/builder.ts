import * as fs from "fs";
import * as util from "util";

import m from "@openfin/snog";
import throat from "throat";
const logger = m.make("siteconfig/builder");

class ConfigBuilder {
  public siteConfigsDir: string;
  constructor(siteConfigsDir: string) {
    this.siteConfigsDir = siteConfigsDir;
  }
  async loadConfigs(dir: string) {
    const files = await util.promisify(fs.readdir)(dir, { encoding: "utf-8" });
    const fileData = await throat(10)(() =>
      Promise.all(
        files.map(async f => {
          const contents = util.promisify(fs.readFile)(f, {
            encoding: "utf-8"
          });
          return { filename: f, contents };
        })
      )
    );
  }
}
