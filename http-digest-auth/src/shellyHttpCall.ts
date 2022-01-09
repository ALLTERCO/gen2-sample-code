/**
 * Sample HTTP request implementation of client communication
 * with Gen2 Shelly device with or without authorization enabled
 * https://datatracker.ietf.org/doc/html/rfc7616
 *
 * Some assumptions:
 *   Algorithm is SHA-256 (as of time of writing this is the case)
 *   Auth name is always "admin" per design
 */


import http from "http";
import crypto from "crypto";

export interface authParams_t {
  username?: string;
  nonce: string;
  cnonce?: string;
  realm: string;
  algorithm: string;
  response?: string;
}

export interface JRPCPost_t {
  id: number,
  method: string;
  params?: Record<string, unknown>;
  auth?: authParams_t;
}


export const shellyHttpHashAlgo = "sha256";

export function HexHash(str: string) {
  return crypto.createHash(shellyHttpHashAlgo).update(str).digest("hex");
};

const static_noise_sha256 = ':auth:6370ec69915103833b5222b368555393393f098bfbfbb59f47e0590af135f062'; // = ':auth:'+HexHash("dummy_method:dummy_uri");


export function isauthParams(p: any): p is authParams_t {
  return (
    p && typeof (p) == 'object'
    && typeof (p.nonce) == 'string'
    && typeof (p.realm) == 'string'
    && typeof (p.algorithm) == 'string'
  );
}

export function complementAuthParams(authParams: authParams_t, username: string, password: string) {

  authParams.username = username;
  authParams.nonce = String(parseInt(authParams.nonce, 16));
  authParams.cnonce = String(Math.floor(Math.random() * 10e8));

  let resp = HexHash(username + ":" + authParams.realm + ":" + password);
  resp += ":" + authParams.nonce;
  resp += ":1:" + authParams.cnonce + static_noise_sha256;

  authParams.response = HexHash(resp);

};


export const shellyHttpUsername = "admin"; // always


const match_dquote_re = /^\"|\"$/g;
const match_coma_space_re = /,? /;

//throws error on unexpected algos or missing/invalid header parts!
export function extractAuthParams(authHeader: string): authParams_t {

  let [authType, ...auth_parts] = authHeader.trim().split(match_coma_space_re);

  if (authType.toLocaleLowerCase() != 'digest') {
    throw new Error("WWW-Authenticate header is requesting unusial auth type " + authType + "instead of Digest");
  }

  let authParams: Record<string, string> = {};
  for (let part of auth_parts) {
    let [_key, _value] = part.split("=");
    _value = _value.replace(match_dquote_re, '');

    if (_key == 'algorithm' && _value != 'SHA-256') {
      throw new Error("WWW-Authenticate header is requesting unusial algorithm:" + _value + " instead of SHA-256");
    }

    if (_key == 'qop') {
      if (_value != 'auth') {
        throw new Error("WWW-Authenticate header is requesting unusial qop:" + _value + " instead of auth");
      }
      continue;
    }

    authParams[_key.trim()] = _value.trim();
  }
  if (!isauthParams(authParams)) {
    throw new Error("invalid WWW-Authenticate header from device?!");
  }
  return authParams;
}

export function shellyHttpCall(postdata: JRPCPost_t, host: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {

    const options: http.RequestOptions = {
      hostname: host,
      port: 80,
      path: "/rpc",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 500
    };

    const req = http.request(options, async (response) => {
      let buffer = Buffer.alloc(0);

      if (response.statusCode == 401) {
        // Not authenticated
        if (password=='') {
          return reject(new Error("Failed to authenticate!"));
        }
        //look up the challenge header
        let authHeader = response.headers["www-authenticate"];
        if (authHeader == undefined) {
          return reject(new Error("WWW-Authenticate header is missing in the response?!"));
        }
        try {
          const authParams = extractAuthParams(authHeader);
          complementAuthParams(authParams, shellyHttpUsername, password);
          //Retry with challenge response object
          postdata.auth = authParams;
          return resolve(await shellyHttpCall(postdata, host, ''));
        } catch (e) {
          if (!(e instanceof Error)) e = new Error(String(e));
          return reject(e);
        }
      }

      //Authenticated, or no auth needed! fetch data:

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

    //setup request error listeners, write post data, indicate write end:

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });

    req.on("error", (error: unknown) => {
      reject(new Error("Request error:" + String(error)));
    })

    req.write(JSON.stringify(postdata));
    req.end();
  });
};