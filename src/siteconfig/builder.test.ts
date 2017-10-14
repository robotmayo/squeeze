import test from "ava";

import Builder from "./builder";

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
        line: "http_header(good-/)paren): PHP/5.3"
      },
      expect: {
        result: {
          key: "good-)paren",
          value: " PHP/5.3"
        }
      }
    }
  ];
  const b = new Builder("");
  testTable.slice(-1).map(tt => {
    const res = b.callParser(tt.args.prefix, tt.args.line);
    console.log(res.key);
    t.deepEqual(res, tt.expect.result);
  });
});
