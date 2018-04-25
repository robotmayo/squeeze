import test from "ava";

import Builder from "./builder";
import { resolve } from "path";
const FIXTURES = resolve(__dirname, "../", "fixtures");

test("parsesCall", t => {
  interface TestTableInput {
    args: {
      prefix: string;
      line: string;
    };
    expect: {
      result: {
        key: string;
        value: string;
      };
    };
  }
  const testTable = [
    {
      args: {
        prefix: "replace_string",
        line: 'replace_string(<span class="description">): <em>'
      },
      expect: {
        result: {
          key: '<span class="description">',
          value: " <em>"
        }
      }
    },
    {
      args: {
        prefix: "replace_string",
        line: "replace_string(<![CDATA[): _"
      },
      expect: {
        result: {
          key: "<![CDATA[",
          value: " _"
        }
      }
    },
    {
      args: {
        prefix: "http_header",
        line: "http_header(user-agent): PHP/5.3"
      },
      expect: {
        result: {
          key: "user-agent",
          value: " PHP/5.3"
        }
      }
    },
    {
      args: {
        prefix: "http_header",
        line: "http_header(user)-agent): PHP/5.3"
      },
      expect: {
        result: {
          key: "",
          value: ""
        }
      }
    },
    {
      args: {
        prefix: "http_header",
        line: "http_header(good-\\)paren): PHP/5.3"
      },
      expect: {
        result: {
          key: "good-)paren",
          value: " PHP/5.3"
        }
      }
    },
    {
      args: {
        prefix: "http_header",
        line: "http_header(bad colon) : PHP/5.3"
      },
      expect: {
        result: {
          key: "",
          value: ""
        }
      }
    }
  ];
  const b = new Builder("");
  testTable.map(tt => {
    const res = b.callParser(tt.args.prefix, tt.args.line);

    t.deepEqual(res, tt.expect.result);
  });
});

test.only("using testconfigs ", async t => {
  const b = new Builder(resolve(FIXTURES, "testconfigs"));
  await b.loadConfigs(b.siteConfigsDir);
  t.fail("Not Yet Implemented");
});
