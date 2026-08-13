import { useEffect } from 'react'
import { expert, identity, meta, objections, plans } from '../config/site'

/**
 * SEO local. Les données structurées sont générées depuis `site.ts` : rebrander
 * le cabinet met à jour le JSON-LD, le titre et la description sans y toucher.
 *
 * `index.html` contient la copie statique du titre et de la description pour le
 * premier paint et pour les robots qui n'exécutent pas le script.
 */
export function Head() {
  useEffect(() => {
    document.title = meta.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', meta.description)

    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': ['AccountingService', 'LocalBusiness'],
          '@id': `${identity.url}/#cabinet`,
          name: identity.legalName,
          description: meta.description,
          url: identity.url,
          telephone: identity.phoneHref,
          email: identity.email,
          image: `${identity.url}${meta.ogImage}`,
          priceRange: `${plans[plans.length - 1].monthly}–${plans[0].monthly} € / mois`,
          address: {
            '@type': 'PostalAddress',
            streetAddress: identity.address.street,
            postalCode: identity.address.postalCode,
            addressLocality: identity.address.city,
            addressCountry: 'FR',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: identity.geo.lat,
            longitude: identity.geo.lng,
          },
          areaServed: expert.towns.map((name) => ({ '@type': 'City', name })),
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '08:30',
            closes: '18:00',
          },
          employee: [
            {
              '@type': 'Person',
              name: expert.person.name,
              jobTitle: expert.person.role,
              identifier: expert.person.number,
            },
            {
              '@type': 'Person',
              name: expert.partner.name,
              jobTitle: expert.partner.role,
              identifier: expert.partner.number,
            },
          ],
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Honoraires',
            itemListElement: plans.map((p) => ({
              '@type': 'Offer',
              name: p.name,
              price: p.monthly,
              priceCurrency: 'EUR',
              description: p.tagline,
              eligibleCustomerType: p.audience,
            })),
          },
        },
        {
          '@type': 'FAQPage',
          '@id': `${identity.url}/#objections`,
          mainEntity: objections.items.map((o) => ({
            '@type': 'Question',
            name: o.q,
            acceptedAnswer: { '@type': 'Answer', text: o.a },
          })),
        },
      ],
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(graph)
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  return null
}
