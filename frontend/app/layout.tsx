import "./globals.css";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import { WishlistProvider } from "./context/WishlistContext";

export const metadata = {
  title: "Site Hub",
  description: "Property Listing App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-100" suppressHydrationWarning>
        <AuthProvider>
          <WishlistProvider>
            <Navbar />
            {children}
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
