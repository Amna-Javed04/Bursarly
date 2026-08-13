import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/onboarding', '/login', '/signup', '/auth/'],
    },
    sitemap: 'https://bursarly.com/sitemap.xml',
  }
}
