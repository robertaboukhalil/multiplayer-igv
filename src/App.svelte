<script>
import { ulid } from "ulid";
import IGV from "./IGV.svelte";

let username = `${ulid()}:robert`;
let roomname = "test";
</script>

<IGV {username} {roomname} />
