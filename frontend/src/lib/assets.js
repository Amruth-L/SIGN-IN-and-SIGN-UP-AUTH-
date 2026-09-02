export const webImages = {
  campus: 'https://images.unsplash.com/photo-1564981797816-1043664bf78d?auto=format&fit=crop&w=1800&q=85',
  calculator: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?auto=format&fit=crop&w=900&q=80',
  books: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80',
  lab: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=900&q=80',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  print: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=900&q=80',
};
export const listingFallback = webImages.books;

const demoListingImages = {
  'Casio FX-991ES Plus': 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?auto=format&fit=crop&w=900&q=80',
  'Engineering Mathematics Textbook': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80',
  'Digital Multimeter Lab Kit': 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=900&q=80',
  'Laptop Stand': 'https://images.unsplash.com/photo-1652198144911-4f204ccf35e6?auto=format&fit=crop&w=900&q=80',
  'Badminton Racquet Pair': 'https://images.unsplash.com/photo-1559309106-ed14040fd35d?auto=format&fit=crop&w=900&q=80',
};

export function listingImage(listing) {
  const image = listing?.image_url;
  const isOriginalDemoImage = image?.includes('photo-1516321318423-f06f85e504b3');
  return (isOriginalDemoImage || !image) && demoListingImages[listing?.title]
    ? demoListingImages[listing.title]
    : image || listingFallback;
}
