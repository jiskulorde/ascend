// src/components/Navbar.tsx

import { getCurrentUser } from "@/lib/auth/role";
import NavbarClient from "./NavbarClient";

export default async function Navbar() {
  const currentUser = await getCurrentUser();

  return (
    <NavbarClient
      initialSignedIn={!!currentUser}
      initialRole={currentUser?.role}
    />
  );
}