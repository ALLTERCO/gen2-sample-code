# Browser based HTTP/JRPC call with optional authentication

## How to get the code

```
$ git clone https://github.com/ALLTERCO/gen2-sample-code.git
$ cd gen2-sample-code
```

To test a feature branch you will need to check it out first:

```
$ #git branch -a 
$ git remote show origin
$ git checkout <a_branch_name>
```

## How to build and use

This demo uses some nodejs/npm tooling that it tries to inherit from the parent directory. You will need to do a `npm install` first in parent directory and then use `tsc` to build the source and `http-server` to "host" the web page.

```
$ cd http-digest-auth
$ npm install
$ cd browser
$ ./tsc
$ ./http-server
```

If you get `EADDRINUSE` error from `http-server` you should change the port for the testing server with `--port` option

You can now access the demo webpage at `http://127.0.0.1:8080` or the port you've specified with `--port`