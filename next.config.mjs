const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        // 'primary' or 'general' — controls how legislative candidates display
        // primary: shows all candidates (multiple per party possible)
        // general: shows one candidate per party per race
        ELECTION_MODE: process.env.ELECTION_MODE || 'primary',
        // Always expose the base path so client code can prefix static assets
        NEXT_PUBLIC_BASE_PATH: '/election-guide-2026',
    },
    output: 'export',
    distDir: 'build',
    assetPrefix: isProd ? 'https://projects.montanafreepress.org/election-guide-2026' : undefined,
    basePath: '/election-guide-2026',
    trailingSlash: true,
    compiler: {
        emotion: true,
    },
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'projects.montanafreepress.org',
                port: '',
                pathname: '/maps/legislative-districts/**',
            }
        ]
    },
};

export default nextConfig;
