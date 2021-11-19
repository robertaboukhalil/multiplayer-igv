# Multiplayer IGV

Work in progress.

### Preview

* https://twitter.com/RobAboukhalil/status/1458835953280163850

### Deploy

* First time: `wrangler publish --new-class IGVRoom`
* Every other time: `wrangler publish`

### Notes

#### Docs

* https://github.com/cloudflare/workers-chat-demo
* https://developers.cloudflare.com/workers/learning/using-durable-objects
* https://developers.cloudflare.com/workers/runtime-apis/durable-objects

#### List objects

```bash
CF_ACCOUNT_ID=
CF_DURABLE_OBJECT_ID=
TOKEN=$(grep "oauth" ~/.wrangler/config/default.toml | awk -F '"' '{ print $(NF-1) }')
curl -X GET "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/durable_objects/namespaces/${CF_DURABLE_OBJECT_ID}/objects" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer $TOKEN" | jq .
```
