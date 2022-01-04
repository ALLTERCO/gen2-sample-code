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

const __sha256ToHex = async (str) => {
  return crypto.createHash("sha256").update(str).digest("hex");
};

const _getAuthResponse = async (authParams, pass = null) => {
  let _respAuthParams = { ...authParams };

  _respAuthParams.username = username;
  _respAuthParams.nonce = parseInt(_respAuthParams.nonce, 16);
  _respAuthParams.cnonce = Math.floor(Math.random() * Math.pow(10, 8));

  let _respArray = [];
  _respArray.push(
    await __sha256ToHex([username, _respAuthParams.realm, pass].join(":"))
  );
  _respArray.push(_respAuthParams.nonce.toString());
  _respArray.push("1");
  _respArray.push(_respAuthParams.cnonce.toString());
  _respArray.push("auth");
  _respArray.push(await __sha256ToHex("dummy_method:dummy_uri"));
  _respAuthParams.response = await __sha256ToHex(_respArray.join(":"));
  return _respAuthParams;
};

const shellyHttpCall = async (options, postdata) => {
  return new Promise((resolve, reject) => {
    options.headers["Content-Length"] = Buffer.byteLength(
      JSON.stringify(postdata)
    );
    const req = http.request(options, async (res) => {
      let buffer = new Buffer.alloc(0);
      if (res.statusCode == 401) {
        let _challengeAuthParams = {};
        let _auth_header_params = res.headers["www-authenticate"]
          .replace(/\"/g, "")
          .split(", ");
        for (_param of _auth_header_params) {
          let [_key, _value] = _param.split("=");
          _challengeAuthParams[_key] = _value;
        }
        let _authParams = await _getAuthResponse(
          _challengeAuthParams,
          password
        );
        return resolve(
          shellyHttpCall(options, { ...postdata, auth: _authParams })
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
    console.log("Device response: ", data);
  })
  .catch((err) => {
    console.log("Request failed");
  });
