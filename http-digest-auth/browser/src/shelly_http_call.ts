import {RawSha256} from './RawSha256.js';

const hexab = '0123456789abcdef';
//const hexab = '0123456789ABCDEF';


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
export type log_f=(msg:string)=>void;

let log:log_f;

export function setlog(logfn:log_f) {
	log=logfn
}

export function HexHash(s:string):string {
	const h=new RawSha256();
	h.update(new TextEncoder().encode(s));
	let res='';
	const digb=h.digest();
	for (let b of digb) {
		res+= hexab[b >> 4] + hexab[b & 15];;
	}
	return res;
}

export const shellyHttpHashAlgo = "sha256";


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
	log("complementAuthParams initial params: "+JSON.stringify(authParams))
	authParams.username = username;
	authParams.nonce = String(parseInt(authParams.nonce, 16));
	authParams.cnonce = String(Math.floor(Math.random() * 10e8));

	let resp = HexHash(username + ":" + authParams.realm + ":" + password);
	log("complementAuthParams resp start:"+resp);
	resp += ":" + authParams.nonce;
	resp += ":1:" + authParams.cnonce + static_noise_sha256;

	authParams.response = HexHash(resp);
	log("complementAuthParams final params: "+JSON.stringify(authParams))

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
  
export function shellyHttpCall(postdata: JRPCPost_t, host: string, port:number, password: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let fetch_params={
			headers: [["Content-Type","application/json"]],
			body:JSON.stringify(postdata)
		};


		const req=new XMLHttpRequest();
		req.withCredentials=true;
		req.addEventListener("readystatechange", ()=>{

			if (req.readyState==req.OPENED) {
				console.log("ev: readystatechange  state:OPENED");
				for (let h of fetch_params.headers) {
					try {
						req.setRequestHeader(h[0],h[1]);
					} catch (err){
						console.log("failed to set header "+h[0]+" to "+h[1]+" e:",err);
					}
				}
				req.send(fetch_params.body);
				return;
			}
			if(req.readyState==req.HEADERS_RECEIVED) {
				console.log("ev: readystatechange  state:HEADERS_RECEIVED h:"+req.getAllResponseHeaders());
				return;
			}


			if(req.readyState==req.DONE) {
				console.log("ev: readystatechange  state:DONE status:"+req.status);
				return;
			}

			console.log("ev: readystatechange  ?? state:"+req.readyState);

		});
		req.open("POST",'http://'+host+':'+port+'/rpc/'+postdata.method);

		return;

		const freq=fetch('http://'+host+':'+port+'/rpc/'+postdata.method,fetch_params).then((response)=>{;
			if (response.status == 401) {
				// Not authenticated
				if (password=='') {
					return reject(new Error("Failed to authenticate!"));
				}
				//look up the challenge header
				let authHeader:string|undefined;
				let _all_h:string[][]=[];
				response.headers.forEach((v,k)=>{
					_all_h.push([k,v]);
					if(k.toLowerCase()=='www-authenticate') authHeader=v;
				});

				if (authHeader == undefined) {
					console.log("fetch fails to report www-authenticate header keys:",JSON.stringify(Array.from((<any>(response.headers)).keys())));
					console.log("fetch fails to report www-authenticate header response:",response);
					return reject(new Error("WWW-Authenticate header is missing in the response?! : h:"+JSON.stringify(_all_h)));
				}
				try {
					const authParams = extractAuthParams(authHeader);
					complementAuthParams(authParams, shellyHttpUsername, password);
					//Retry with challenge response object
					postdata.auth = authParams;
					return resolve(shellyHttpCall(postdata, host,port, ''));
				} catch (e) {
					if (!(e instanceof Error)) e = new Error(String(e));
					return reject(e);
				}
			}
			resolve(response.text());
		}).catch((error)=>{
			reject(new Error("Request error:" + String(error)));
		});
		/*
		const options: http.RequestOptions = {
			hostname: host,
			port: port,
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
					return resolve(await shellyHttpCall(postdata, host,port, ''));
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
	*/
	});
};