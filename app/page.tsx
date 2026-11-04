import { redirect } from "next/navigation";

// This page only redirects, so there is no UI for Next.js to validate as an instant navigation target.
export const instant = false;

// The product opens on the sign-in page. A visitor who is already signed in is offered "Continue" there.
export default function HomePage() {
  redirect("/login");
}
