import { Metadata } from 'next'
import BrowseClient from './BrowseClient'

export const metadata: Metadata = {
  title: 'Browse Scholarships — Bursarly',
  description: 'Explore verified scholarship opportunities worldwide. Filter by country, degree level, and funding type.',
}

export default function Page() {
  return <BrowseClient />
}
