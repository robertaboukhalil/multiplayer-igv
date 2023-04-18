<script>
import { Container, Navbar, NavbarBrand, Styles } from "sveltestrap";
</script>

<Styles />

<!-- Navbar -->
<Navbar color="light" expand="xs" light container>
	<NavbarBrand>Multiplayer IGV</NavbarBrand>
</Navbar>

<!-- Page Content -->
<Container xl={true} class="mt-4">
	<slot />
</Container>
