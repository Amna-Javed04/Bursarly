import { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'Bursarly — Home',
  description: 'Track real scholarship deadlines from verified sources. Browse opportunities, check requirements, and apply on time.',
}

export default function Page() {
  return <HomeClient />
}
