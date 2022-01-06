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

function sha256ToHex (str) {
  return crypto.createHash("sha256").update(str).digest("hex");
};

const static_noise=sha256ToHex("dummy_method:dummy_uri");

function complementAuthParams (authParams,username,pass) {

  authParams.username = username;
  authParams.nonce = parseInt(authParams.nonce, 16);
  authParams.cnonce = Math.floor(Math.random() * 10e8);

  let resp = '';
  resp+=sha256ToHex(username+":"+authParams.realm+":"+pass);
  resp+=":"+authParams.nonce;
  resp+=":1";
  resp+=":"+authParams.cnonce;
  resp+=":auth";
  resp+=":"+static_noise;

  authParams.response = sha256ToHex(resp);

};

const match_dquote_re=/\"/g;

function shellyHttpCall (options, postdata) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, async (response) => {
      let buffer = new Buffer.alloc(0);
      // Not authenticated, so look up the challenge header
      if (response.statusCode == 401) {
        console.error("calculating digest auth...");
        let authHeaderParams = response.headers["www-authenticate"]
          .replace(match_dquote_re, "")
          .split(", ");
        let authParams = {};
        for (param of authHeaderParams) {
          let [_key, _value] = param.split("=");
          authParams[_key.trim()] = _value.trim();
        }
        // Retry with challenge response object
        complementAuthParams(authParams, username, password);
        postdata.auth=authParams;
        try {
          return resolve(await shellyHttpCall(options, postdata));
        } catch (e) {
          return reject(e);
        }
      }
      response.on("error", (error) => {
        reject(error);
      });
      response.on("timeout", () => {
        reject(new Error("Timeout"));
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
      reject(new Error("Timeout"));
    });
    req.on("error",(error)=>{
      reject(new Error("Request error"));
    })
    req.write(JSON.stringify(postdata));
    req.end();
  });
};

console.error("Calling metod "+postData.method+" on "+options.hostname);
shellyHttpCall(options, postData)
  .then((data) => {
    console.error("Device response: ");
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  })
  .catch((err) => {
    console.error("Request failed :", err);
  });
