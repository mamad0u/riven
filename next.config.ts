import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pour Electron, vous avez deux options :
  
  // Option 1 : Export statique (pour production)
  // Décommentez cette ligne pour générer des fichiers statiques
  // output: 'export',
  
  // Option 2 : Utiliser le serveur Next.js (pour développement)
  // Laissez cette option par défaut pour le développement
  
  // Désactiver l'optimisation des images si vous utilisez output: 'export'
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
  },
  
  // Configuration pour Electron
  // Désactiver certaines optimisations qui peuvent causer des problèmes
  reactStrictMode: true,
  
  // Si vous utilisez des assets statiques
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,
};

export default nextConfig;
