import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'En su lugar · Organiza tu recepción',description:'Un lugar para tus 90 invitados. Organiza las mesas de tu recepción con un plano interactivo.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="es"><body>{children}</body></html>;}
