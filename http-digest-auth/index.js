const http = require("http");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

const username = "admin"; // always
const password = process.env.PASS;

const postData = {
  id: 1,
  method: "Shelly.GetStatus",
};

const options = {
  hostname: process.env.HOST,
  port: 80,
  path: "/rpc",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

const sha256ToHex = (str) => {
  return crypto.createHash("sha256").update(str).digest("hex");
};

const getAuthResponse = (authParams, pass) => {
  let respAuthParams = { ...authParams };

  respAuthParams.username = username;
  respAuthParams.nonce = parseInt(respAuthParams.nonce, 16);
  respAuthParams.cnonce = Math.floor(Math.random() * Math.pow(10, 8));

  let respArray = [];
  respArray.push(
    sha256ToHex([username, respAuthParams.realm, pass].join(":"))
  );
  respArray.push(respAuthParams.nonce.toString());
  respArray.push("1");
  respArray.push(respAuthParams.cnonce.toString());
  respArray.push("auth");
  respArray.push(sha256ToHex("dummy_method:dummy_uri"));
  respAuthParams.response = sha256ToHex(respArray.join(":"));
  return respAuthParams;
};

const shellyHttpCall = (options, postdata) => {
  return new Promise((resolve, reject) => {
    options.headers["Content-Length"] = Buffer.byteLength(
      JSON.stringify(postdata)
    );
    const req = http.request(options, (res) => {
      let buffer = new Buffer.alloc(0);
      if (res.statusCode == 401) {
        let authHeaderParams = res.headers["www-authenticate"]
          .replace(/\"/g, "")
          .split(", ");
        let challengeAuth = {};
        for (param of authHeaderParams) {
          let [_key, _value] = param.split("=");
          challengeAuth[_key] = _value;
        }
        return resolve(
          shellyHttpCall(options, {
            ...postdata,
            auth: getAuthResponse(challengeAuth, password),
          })
        );
      }
      res.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
      });
      res.on("end", () => {
        return resolve(buffer.toString("utf8"));
      });
    });
    req.write(JSON.stringify(postdata));
    req.end();
  });
};

shellyHttpCall(options, postData)
  .then((data) => {
    console.log("Device response: ");
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  })
  .catch((err) => {
    console.log("Request failed");
  });
