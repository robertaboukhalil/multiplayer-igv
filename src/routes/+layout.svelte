<script>
import { page } from "$app/stores";
import { Collapse, Container, Nav, Navbar, NavbarBrand, NavbarToggler, NavItem, NavLink, Styles } from "sveltestrap";

// State
let isNavbarOpen = false;
$: path = $page.url.pathname.split("/")[1];
</script>

<Styles />

<!-- Navbar -->
<Navbar color="light" expand="xs" light container>
	<NavbarBrand>Multiplayer IGV</NavbarBrand>
	<NavbarToggler on:click={() => (isNavbarOpen = !isNavbarOpen)} />
	<Collapse navbar expand="xs" isOpen={isNavbarOpen} on:update={(evt) => (isNavbarOpen = evt.detail.isNavbarOpen)}>
		<Nav navbar>
			<!-- <NavItem><NavLink href="/" active={path === ""}>Home</NavLink></NavItem> -->
			<!-- <NavItem><NavLink href="/browse" active={path === "browse"}>Browse</NavLink></NavItem> -->
			<!-- <NavItem><NavLink href="/about" active={path === "about"}>About</NavLink></NavItem> -->
		</Nav>
	</Collapse>
</Navbar>

<!-- Page Content -->
<Container xl={true} class="mt-4">
	<slot />
</Container>
