import { MetadataRoute } from 'next'
import { getScholarships } from '@/app/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://bursarly.com'

  let scholarships = []
  try {
    scholarships = await getScholarships()
  } catch (err) {
    console.error("Failed to fetch scholarships for sitemap:", err)
  }
  
  const scholarshipUrls: MetadataRoute.Sitemap = scholarships.map((sch) => ({
    url: `${baseUrl}/scholarship/${sch.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...scholarshipUrls,
  ]
}
