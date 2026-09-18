import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docly | Your team's second brain",
  description: "A secure, searchable knowledge base for modern teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
