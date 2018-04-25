import * as fs from "fs";
import * as util from "util";

import logger from "@openfin/snog";
import * as pMap from "p-map";
import { basename, resolve } from "path";

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);

export interface SiteConfig {
  // The following are expected to be jquery/querySelector style strings
  title: string[];
  body: string[];
  author: string[];
  date: string[];
  strip: string[];
  stripIDOrClass: string[];
  stripImageSrc: string[];
  nativeAdClue: string[];
  httpHeaders: Map<string, string>;
  stringReplacer: Map<string, string>;

  /*
  Notes from: https://github.com/j0k3r/graby/blob/master/src/SiteConfig/SiteConfig.php
  Autodetect title/body if xpath expressions fail to produce results.
   Note that this applies to title and body separately, ie.
     * if we get a body match but no title match, this option will determine whether we autodetect title
     * if neither match, this determines whether we autodetect title and body.

   Also note that this only applies when there is at least one xpath expression in title or body, ie.
     * if title and body are both empty (no xpath expressions), this option has no effect (both title and body will be auto-detected)
     * if there's an xpath expression for title and none for body, 
       body will be auto-detected and this option will determine whether 
       we auto-detect title if the xpath expression for it fails to produce results.

   Usage scenario: you want to extract something specific from a set of URLs, 
   e.g. a table, and if the table is not found, you want to ignore the entry completely. 
   Auto-detection is unlikely to succeed here, so you construct your patterns and set this option to false. 
   Another scenario may be a site where auto-detection has proven to fail (or worse, picked up the wrong content).
   bool or null if undeclared
  */
  autodetectOnfailure: boolean;
  requiresLogin: boolean;
  notLoggedIn: string;
  loginUri: string;
  loginUserName: string;
  loginPassword: string;
  loginExtraFields: { [key: string]: string[] }[];
  [key: string]:
    | string[]
    | boolean
    | string
    | { [key: string]: string[] | undefined }[]
    | Map<string, string>;
}

interface SINGLE_STRING_COMMANDS {
  login_username_field: boolean;
  login_password_field: boolean;
  not_logged_in: boolean;
  login_uri: boolean;
  [key: string]: boolean;
}

const SINGLE_STRING_COMMANDS: SINGLE_STRING_COMMANDS = {
  login_password_field: true,
  login_uri: true,
  not_logged_in: true,
  login_username_field: true
};

interface BOOLEAN_COMMANDS {
  prune: boolean;
  autodetect_on_failure: boolean;
  requires_login: boolean;
  [key: string]: boolean;
}

const BOOLEAN_COMMANDS: BOOLEAN_COMMANDS = {
  prune: true,
  autodetect_on_failure: true,
  requires_login: true
};

interface MULTI_COMMANDS {
  title: boolean;
  body: boolean;
  strip: boolean;
  strip_id_or_class: boolean;
  strip_image_src: boolean;
  single_page_link: boolean;
  next_page_link: boolean;
  test_url: boolean;
  login_extra_fields: boolean;
  native_ad_clue: boolean;
  date: boolean;
  author: boolean;
  [key: string]: boolean | undefined;
}
const MULTI_COMMANDS: MULTI_COMMANDS = {
  title: true,
  body: true,
  strip: true,
  strip_id_or_class: true,
  strip_image_src: true,
  single_page_link: true,
  next_page_link: true,
  test_url: true,
  login_extra_fields: true,
  native_ad_clue: true,
  date: true,
  author: true
};

export default class ConfigBuilder {
  public siteConfigsDir: string;
  public siteConfigs: Map<string, SiteConfig>;
  constructor(siteConfigsDir: string) {
    this.siteConfigsDir = siteConfigsDir;
  }
  async loadConfig(file: string): Promise<SiteConfig> {
    const fileContents = await readFile(file, "utf-8");
    return this.parseConfigLines(fileContents);
  }
  parseConfigLines(rawConfig: string): SiteConfig {
    const lines = rawConfig.split("\n");
    const config: SiteConfig = {
      title: [],
      body: [],
      author: [],
      date: [],
      strip: [],
      stripIDOrClass: [],
      stripImageSrc: [],
      nativeAdClue: [],
      httpHeaders: new Map(),
      autodetectOnfailure: false,
      requiresLogin: false,
      loginExtraFields: [{}],
      loginPassword: "",
      loginUri: "",
      loginUserName: "",
      notLoggedIn: "",
      stringReplacer: new Map()
    };
    let skip = false;
    lines.forEach((l, idx, arr) => {
      if (skip === true) {
        skip = false;
        return;
      }
      const line = l.trim();
      // Skip comments and empty lines
      if (line === "" || line.startsWith("#")) return;
      const lineChunks = line.split(":").map(c => c.trim());
      if (lineChunks.length < 2) return;
      const cmd = lineChunks[0];
      const cmdValue = lineChunks[1];
      if (cmd === "" || cmdValue === "") return;

      if (MULTI_COMMANDS[cmd]) {
        logger.addField("COMMAND", cmd).info("Command used");
        (config[cmd] as string[]).push(cmdValue);
        return;
      }

      if (BOOLEAN_COMMANDS[cmd]) {
        config[cmd] = cmd === "yes" || cmd === "true";
        return;
      }

      if (SINGLE_STRING_COMMANDS[cmd]) {
        config[cmd] = cmdValue;
        return;
      }
      if (line.startsWith("find_string")) {
        // Peek at the next line to get the replace_string:
        const nextLine = arr[idx + 1] || "";
        // dont add find if there is no replace
        if (!nextLine.trim().startsWith("replace_string:")) return;
        const findString = line.substring(line.indexOf(":") + 1);
        const replaceString = nextLine.substring(nextLine.indexOf(":") + 1);
        if (replaceString === "") {
          skip = true;
          return;
        }
        config.stringReplacer.set(findString, replaceString);
        return;
      }
      if (line.startsWith("replace_string(")) {
        const res = this.callParser("replace_string", line);
        if (res.key === "") return;
        config.stringReplacer.set(res.key, res.value);
        return;
      }
      if (line.startsWith("http_header(")) {
        const res = this.callParser("http_header", line);
        if (res.key === "") return;
        config.httpHeaders.set(res.key, res.value);
        return;
      }
    });
    return config;
  }

  callParser(prefix: string, line: string): { key: string; value: string } {
    let key = "";
    let value = "";
    if (!line.startsWith(prefix + "(")) return { key, value };
    let rest = line.substring(line.indexOf("(") + 1);
    let lastChar = "";
    let add = true;
    let endingParenIndex = -1;
    for (let i = 0; i < rest.length; i++) {
      const char = rest[i];
      if (char === ")" && lastChar != "\\") {
        endingParenIndex = i;
        break;
      }
      if (char === "\\" && rest[i + 1] == ")") {
        add = false;
      }
      if (add) {
        key += char;
      }
      lastChar = char;
      add = true;
    }
    // invalid syntax leave
    if (endingParenIndex === -1) return { key: "", value };
    if (rest[endingParenIndex + 1] != ":") {
      return { key: "", value };
    }
    value = rest.substring(endingParenIndex + 2);
    return { key, value };
  }

  async loadConfigs(dir: string) {
    const files = (await readdir(dir, { encoding: "utf-8" })) as string[];
    const configData = await pMap(
      files,
      async f => {
        logger.addField("PATH", f).info("STARITNG THIS");
        const path = resolve(dir, f);
        const contents = await readFile(path, "utf-8");
        const config = this.parseConfigLines(contents);
        const name = basename(f);
        this.siteConfigs.set(name, config);
        return { path, config, name };
      },
      { concurrency: 1 }
    );
  }
}
