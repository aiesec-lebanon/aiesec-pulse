"use server";

import { redirect } from "next/navigation";

// TODO: implement adminLogin, adminLogout.
// adminLogin: validate credentials → bcrypt.compare → sign admin JWT →
//   set admin_session cookie → redirect /admin/queue.
// adminLogout: clear admin_session cookie → redirect /admin/login.

export async function adminLogin(_formData: FormData) {
  throw new Error("adminLogin not yet implemented");
}

export async function adminLogout() {
  // placeholder: will clear admin_session cookie
  redirect("/admin/login");
}
