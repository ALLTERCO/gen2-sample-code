## Authorization sample
Sample code for http requests to a Shelly device that supports authorization, if enabled

## To use:
 * npm run build
 * `$ cp .env_example .env`
 * edit .env file to match your device addres and password
 * for usage info do `$ node . --help`

## Quick examples that assume proper HOST and PASS in .env:

Call a method with params, show only results:

```
$ node . -m Switch.GetConfig -a '{"id":0}' --quiet
{
  "id": 1,
  "src": "shellyplus1pm-c4dd5787708c",
  "result": {
    "id": 0,
    "name": null,
    "in_mode": "follow",
    "initial_state": "match_input",
    "auto_on": false,
    "auto_on_delay": 60,
    "auto_off": false,
    "auto_off_delay": 60,
    "power_limit": null,
    "voltage_limit": 280,
    "current_limit": 16
  }
}
```

Using a [jq](https://stedolan.github.io/jq/) CLI tool, extract specific key from the result:

```
$ node . -m Switch.GetConfig -a '{"id":0}' --no-format -q  | jq -r .result.initial_state
match_input
```