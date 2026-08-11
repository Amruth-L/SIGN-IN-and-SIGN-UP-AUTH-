import Home from './Home';

// The marketplace intentionally reuses the established listing, filtering,
// wishlist, and rental components from Home while keeping the public landing
// page focused on explaining CampusMesh.
const Marketplace = () => <Home marketplaceOnly />;

export default Marketplace;
