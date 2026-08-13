import { Metadata } from 'next'
import SearchClient from './SearchClient'

export const metadata: Metadata = {
  title: 'Search Scholarships — Bursarly',
  description: 'Search for verified scholarship opportunities by name, country, or degree.',
}

export default function Page() {
  return <SearchClient />
}
