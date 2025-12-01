"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";

export default function NavbarWrapper() {
  const pathname = usePathname();

  // Pages where navbar should NOT show
  const hideOn = ["/signin", "/signup", "/auth", '/profileEditor'];

  if (hideOn.includes(pathname)) {
    return null; // hide it
  }

  return <Navbar />;
}
