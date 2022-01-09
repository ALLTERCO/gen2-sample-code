import dotenv from "dotenv";

import { JRPCPost_t, shellyHttpCall } from "./shellyHttpCall";

dotenv.config();


let password = process.env['PASS'] ?? "";
let host = process.env['HOST'] ?? "";
let noformat=false;

const postData: JRPCPost_t = {
  id: 1,
  method: "Shelly.GetStatus",
};

function usage(): never {
  console.error(
    `To modify the JRPC call you can use this parameters:

  --host|-h <host>
      the host to call to, ip addres or DNS resolvable name this is also
      loaded from .env or HOST envirnoment variable

  --pass|-p <password>
      the passwod to use. Better store this in .env or pass via envirnoment
      variable PASS

  --method|-m <method>
      The method to be envoked on the device, if not set 
      Shelly.GetStatus is called.

  --params|--args|-a '<parameters>'
      JSON formated parameters to pass to the remote method. This must be 
      strict JSON parsable: strings and keys always doble quoted, no trailing
      coma. Most probably the parameters JSON must be surrownded with single
      quotes as shown.

  -q
      Print only result on stdout. N.B. this is almost equivalent 
      to 2>/dev/null

  --no-format|--noformat
      explicityl strip any formating from device response. This should
      collapse the response to single line.

Any unknown param is considered error and this help is shown
`);
  process.exit(-1);
}

let i = 2; 
const argl=process.argv.length;
for (; i < argl; i++) {

  let opt = process.argv[i];
  let opt_arg:string|undefined=process.argv[i+1];
  switch (opt) {
    case "--host":
    case "-h": {
      if (opt_arg==undefined) usage();
      host = opt_arg.trim();
      i++;
      continue;
    }
    case "--pass":
    case "-p": {
      if (opt_arg==undefined) usage();
      password = opt_arg.trim();
      i++;
      continue;
    }
    case "--method":
    case "-m": {
      postData.method = opt_arg.trim();
      i++;
      continue;
    }
    case "--params":
    case "--args":
    case "-a": {
      if (opt_arg==undefined) usage();
      try {
        postData.params = JSON.parse(opt_arg)
      } catch (err) {
        console.error("Params fail to parse. This MUST be strinct JSON. Check if you need to wrap the params in ' ");
        process.exit(-1);
      };
      i++;
      continue;
    }
    case "--quiet":
    case "-q": {
      console.error=()=>{};
      continue;
    }
    case "--noformat":
    case "--no-format": {
      noformat=true;
      continue;
    }
    default: {
      usage();
    }
  }
}

if ( host == '') {
  console.error("You need to provide host via .env file or  envirnoment variable HOST or via --host parameter!");
  usage();
}

console.error("Calling metod " + postData.method + " on " + host);

shellyHttpCall(postData, host, password).then((data) => {
  if (postData.auth) {
    console.error("Device response post auth: ");
  } else {
    console.error("Device response pre auth: ");
  }
  try {
    if (noformat) {
      console.log(JSON.stringify(JSON.parse(data)));
    } else {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    }
  } catch (e) {
    console.error("failed to parse the responce from the device!");
    console.error(data);
    process.exit(-3);
  }
}).catch((err) => {
  console.error("Request failed :", String(err));
  process.exit(-1);
});
