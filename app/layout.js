export const metadata = {
  title: 'Stok Es Nachima Food',
  description: 'Catat stok dan pendapatan penjualan es',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F0A04B',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
