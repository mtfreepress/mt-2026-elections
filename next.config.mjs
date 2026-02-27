const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
