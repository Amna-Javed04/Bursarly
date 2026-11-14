import { Metadata } from 'next'
import { getScholarshipById } from '@/app/lib/api'
import ScholarshipClient from './ScholarshipClient'
import { notFound } from 'next/navigation'

// Deadlines and verification state change often, so this route is never cached.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const scholarship = await getScholarshipById(id)
    return {
      title: `${scholarship.name} — Deadline, Eligibility & Documents`,
      description: `Apply for the ${scholarship.name} in ${scholarship.country}. Funding: ${scholarship.funding_type.replace('_', ' ')}. Degree: ${scholarship.degree_level}.`,
    }
  } catch (error) {
    return {
      title: 'Scholarship Not Found — Bursarly'
    }
  }
}

export default async function ScholarshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  let scholarship
  try {
    scholarship = await getScholarshipById(id)
  } catch (error) {
    console.error(`[scholarship:${id}] detail fetch failed:`, error)
    notFound()
  }

  // Construct JSON-LD Structured Data for Google SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalProgram',
    name: scholarship.name,
    provider: {
      '@type': 'Organization',
      name: scholarship.country,
    },
    educationalCredentialAwarded: scholarship.degree_level,
    financialAidEligible: scholarship.funding_type === 'fully_funded' ? 'Full Funding' : scholarship.funding_type === 'partially_funded' ? 'Partial Funding' : 'Unknown',
    applicationDeadline: scholarship.deadlines.length > 0 ? scholarship.deadlines[0].deadline_date : undefined,
    url: scholarship.official_url || `https://bursarly.com/scholarship/${scholarship.id}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScholarshipClient initialData={scholarship} />
    </>
  )
}
