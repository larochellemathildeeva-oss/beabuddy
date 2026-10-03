export const isIP = () => 0; export const lookup = async () => []; export default {};
// Server handlers must never execute in the browser preview.
export const createHash = () => { throw new Error("Server hashing reached the browser preview"); };
