// Presentation only: keep arbitrary-size integer strings exact.
export function formatCredits(value) {
 return String(value).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
