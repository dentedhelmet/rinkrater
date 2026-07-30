// Shared list of selectable profile character avatars — used at signup
// (AuthModal) and when changing your avatar later (Profile page). Kept in
// one place so adding new characters over time only requires updating here.
export const AVATARS = Array.from({ length: 70 }, (_, i) => `/characters/profile_photo${i + 1}.png`)
