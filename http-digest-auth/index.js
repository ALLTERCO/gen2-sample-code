/**
 * Sample HTTP request implementation of client communication
 * with Gen2 Shelly device with or without authorization enabled
 * https://datatracker.ietf.org/doc/html/rfc7616
 *
 * Some assumptions:
 *   Algorithm is SHA-256 (as of time of writing this is the case)
 */

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
  timeout: 500
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
  respArray.push(sha256ToHex([username, respAuthParams.realm, pass].join(":")));
  respArray.push(respAuthParams.nonce.toString());
  respArray.push("1");
  respArray.push(respAuthParams.cnonce.toString());
  respArray.push("auth");
  respArray.push(sha256ToHex("dummy_method:dummy_uri"));

  respAuthParams.response = sha256ToHex(respArray.join(":"));

  return respAuthParams;
};

const shellyHttpCall = async (options, postdata) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (response) => {
      let buffer = new Buffer.alloc(0);
      // Not authenticated, so look up the challenge header
      if (response.statusCode == 401) {
        let authHeaderParams = response.headers["www-authenticate"]
          .replace(/\"/g, "")
          .split(", ");
        let challengeAuth = {};
        for (param of authHeaderParams) {
          let [_key, _value] = param.split("=");
          challengeAuth[_key] = _value;
        }
        // Retry with challenge response object
        return resolve(
          shellyHttpCall(options, {
            ...postdata,
            auth: getAuthResponse(challengeAuth, password),
          })
        );
      }
      response.on("error", (error) => {
        reject(error);
      });
      response.on("timeout", () => {
        reject();
      });
      response.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
      });
      response.on("end", () => {
        resolve(buffer.toString("utf8"));
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject("Timeout");
    });
    req.on("error",(error)=>{
      reject("Request error");
    })
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
    console.log("Request failed :", err);
  });
